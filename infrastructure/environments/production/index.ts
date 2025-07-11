/**
 * Production environment deployment with proper provider architecture
 */

import * as command from "@pulumi/command";
import * as k8s from "@pulumi/kubernetes";
import * as pulumi from "@pulumi/pulumi";
import * as argocd from "@three14/pulumi-argocd";
import * as yaml from "js-yaml";

import * as Components from "../../components";
import { getProductionConfig } from "../../config/production";
import { getArgoCdAdminPassword } from "../../helpers";
import type { IK3sNodeConfig } from "../../shared/types";
import { getVmRole } from "../../shared/utils";

// Get production configuration
const config = getProductionConfig();

// Get Cloudflare configuration directly
const cloudflareConfig = new pulumi.Config("cloudflare");

const domain = cloudflareConfig.require("domain");
const email = cloudflareConfig.require("email");
const apiToken = cloudflareConfig.requireSecret("apiToken");

// =============================================================================
// PROVIDER CONFIGURATION
// =============================================================================

// Proxmox provider for VM infrastructure
// Note: Currently using provider from config, but this shows how to create environment-specific providers
// const productionProxmoxProvider = new proxmoxve.Provider("prd-proxmox", {
//   endpoint: config.proxmox.endpoint,
//   username: config.proxmox.username,
//   password: config.proxmox.password,
//   insecure: config.proxmox.insecure,
// });

// =============================================================================
// INFRASTRUCTURE DEPLOYMENT
// =============================================================================

// Deploy K3s cluster infrastructure (VMs only)
export const cluster = new Components.K3sCluster("prd-k3s", {
  config,
});

// Install K3s master
export const masterInstall = new Components.K3sMaster("k3s-master", {
  node: cluster.masters.map((m) => m.config)[0],
  sshUsername: config.proxmox.ssh!.username!,
  sshPrivateKey: config.proxmox.ssh!.privateKey!,
  isFirstMaster: true,
});

// Retrieve K3s credentials
export const credentials = new Components.K3sCredentials(
  "k3s-credentials",
  {
    masterNode: cluster.masters.map((m) => m.config)[0],
    sshUsername: config.proxmox.ssh!.username!,
    sshPrivateKey: config.proxmox.ssh!.privateKey!,
  },
  {
    dependsOn: [masterInstall],
  },
);

// Install K3s workers
export const workerInstalls = cluster.workers.map(
  (worker, index) =>
    new Components.K3sWorker(
      `k3s-worker-${index}`,
      {
        node: worker.config,
        sshUsername: config.proxmox.ssh!.username!,
        sshPrivateKey: config.proxmox.ssh!.privateKey!,
        token: credentials.result.token,
        masterEndpoint: cluster.masters.map((m) => m.config)[0].ip4,
      },
      {
        dependsOn: [credentials],
      },
    ),
);

// Kubernetes provider for all K8s resources (created after components are ready)
const productionK8sProvider = new k8s.Provider(
  "prd-k8s",
  { kubeconfig: credentials.result.kubeconfig },
  {
    dependsOn: [masterInstall.k3sHealthCheck, ...workerInstalls],
  },
);

// =============================================================================
// BOOTSTRAP PHASE: Direct Pulumi Deployment
// =============================================================================

// 1. Deploy MetalLB for LoadBalancer support
export const metallbBootstrap = new Components.MetalLBComponent(
  "prd-metallb-bootstrap",
  {
    namespace: "metallb-system",
    chartVersion: "0.15.2",
    environment: "prd",
    ipRange: "10.10.0.202-10.10.0.205",
  },
  {
    dependsOn: workerInstalls,
    provider: productionK8sProvider,
  },
);

// 2. Deploy Traefik for ingress controller
export const traefikBootstrap = new Components.TraefikComponent(
  "prd-traefik-bootstrap",
  {
    namespace: "traefik",
    chartVersion: "36.3.0",
    environment: "prd",
    httpsPort: 8443, // Production uses 8443 for router forwarding
  },
  {
    dependsOn: [metallbBootstrap],
    provider: productionK8sProvider,
  },
);

// 3. Deploy cert-manager for TLS certificates
export const certManagerBootstrap = new Components.CertManagerComponent(
  "prd-cert-manager-bootstrap",
  {
    namespace: "cert-manager",
    chartVersion: "v1.16.1",
    environment: "prd",
    cloudflareApiToken: apiToken,
    email: email,
  },
  {
    dependsOn: [traefikBootstrap],
    provider: productionK8sProvider,
  },
);

// 4. Deploy ArgoCD for GitOps
export const argoCd = new Components.ArgoCdComponent(
  "prd-argocd",
  {
    namespace: "argocd",
    chartVersion: "5.51.6",
    environment: "prd",
    domain: `argocd.${domain}`, // Clean domain without prefix for production
  },
  {
    dependsOn: [certManagerBootstrap.clusterIssuer],
    provider: productionK8sProvider,
  },
);

// Get ArgoCD admin password using helper
const argoCdAdminPasswordResult = getArgoCdAdminPassword(
  "argocd-get-admin-password",
  {
    masterNode: cluster.masters.map((m) => m.config)[0],
    ssh: {
      username: config.proxmox.ssh!.username!,
      privateKey: config.proxmox.ssh!.privateKey!,
    },
    deploymentName: "prd-argocd-chart-server",
    namespace: "argocd",
  },
  { dependsOn: [argoCd.chart, masterInstall.k3sHealthCheck] },
);

// =============================================================================
// ARGOCD PROVIDER CONFIGURATION
// =============================================================================

// Add production cluster to existing kubeconfig using kubectl config commands
const kubeconfigFile = new command.local.Command("add-prd-cluster", {
  create: credentials.result.kubeconfig.apply((config) => {
    const kubeconfigObj = yaml.load(config) as {
      clusters: Array<{ cluster: { server: string; "certificate-authority-data": string } }>;
      users: Array<{ user: { "client-certificate-data": string; "client-key-data": string } }>;
    };
    const cluster = kubeconfigObj.clusters[0].cluster;
    const user = kubeconfigObj.users[0].user;

    return `
# Add production cluster
kubectl config set-cluster prd-k3s \\
  --server="${cluster.server}" \\
  --certificate-authority-data="${cluster["certificate-authority-data"]}" \\
  --embed-certs=true

# Add production user
kubectl config set-credentials prd-k3s-admin \\
  --client-certificate-data="${user["client-certificate-data"]}" \\
  --client-key-data="${user["client-key-data"]}" \\
  --embed-certs=true

# Add production context
kubectl config set-context prd-k3s \\
  --cluster=prd-k3s \\
  --user=prd-k3s-admin

# Use production context
kubectl config use-context prd-k3s

echo "Added prd-k3s cluster and set as current context"
    `;
  }),
});

// ArgoCD provider for GitOps application management
const productionArgoCdProvider = new argocd.Provider(
  "prd-argocd-provider",
  {
    authToken: argoCdAdminPasswordResult.token,
    portForwardWithNamespace: "argocd",
    // Production uses proper TLS validation
  },
  {
    dependsOn: [argoCd.chart, argoCd.ingress, argoCdAdminPasswordResult.command, kubeconfigFile],
  },
);

// =============================================================================
// GITOPS PHASE: ArgoCD Applications Using Same Components
// =============================================================================

// Now deploy ArgoCD applications that use the same components with identical configs
// This completes the bootstrap-to-GitOps transition pattern

// MetalLB ArgoCD Application
export const metallbApp = new argocd.Application(
  "prd-metallb-app",
  {
    metadata: {
      name: "metallb",
      namespace: "argocd",
    },
    spec: {
      project: "default",
      sources: [
        {
          repoUrl: "https://metallb.github.io/metallb",
          chart: "metallb",
          targetRevision: "0.15.2",
          helm: {
            values: metallbBootstrap.helmValuesOutput,
          },
        },
      ],
      destination: {
        server: "https://kubernetes.default.svc",
        namespace: "metallb-system",
      },
      syncPolicy: {
        automated: { prune: true, selfHeal: true },
        syncOptions: ["CreateNamespace=true"],
      },
    },
  },
  {
    provider: productionArgoCdProvider,
    dependsOn: [argoCd.chart, argoCd.ingress],
  },
);

// Traefik ArgoCD Application
export const traefikApp = new argocd.Application(
  "prd-traefik-app",
  {
    metadata: {
      name: "traefik",
      namespace: "argocd",
    },
    spec: {
      project: "default",
      sources: [
        {
          repoUrl: "https://traefik.github.io/charts",
          chart: "traefik",
          targetRevision: "36.3.0",
          helm: {
            values: traefikBootstrap.helmValuesOutput,
          },
        },
      ],
      destination: {
        server: "https://kubernetes.default.svc",
        namespace: "traefik",
      },
      syncPolicy: {
        automated: { prune: true, selfHeal: true },
        syncOptions: ["CreateNamespace=true"],
      },
    },
  },
  {
    provider: productionArgoCdProvider,
    dependsOn: [argoCd.chart, argoCd.ingress],
  },
);

// cert-manager ArgoCD Application
export const certManagerApp = new argocd.Application(
  "prd-cert-manager-app",
  {
    metadata: {
      name: "cert-manager",
      namespace: "argocd",
    },
    spec: {
      project: "default",
      sources: [
        {
          repoUrl: "https://charts.jetstack.io",
          chart: "cert-manager",
          targetRevision: "v1.16.1",
          helm: {
            values: certManagerBootstrap.helmValuesOutput,
          },
        },
      ],
      destination: {
        server: "https://kubernetes.default.svc",
        namespace: "cert-manager",
      },
      syncPolicy: {
        automated: { prune: true, selfHeal: true },
        syncOptions: ["CreateNamespace=true"],
      },
    },
  },
  {
    provider: productionArgoCdProvider,
    dependsOn: [argoCd.chart, argoCd.ingress],
  },
);

// =============================================================================
// EXPORTS
// =============================================================================

export const masterIps = cluster.masterIps;
export const workerIps = cluster.workerIps;
export const allNodes = cluster.allNodes;
export const kubeconfig = credentials.result.kubeconfig;
export const argoCdUrl = argoCd.ingress.spec.rules[0].host.apply((host) => `https://${host}`);
export const argoCdToken = argoCdAdminPasswordResult.token;

// Utility function for role determination
export const getVmRoleFromId = (vmId: number): IK3sNodeConfig["role"] => {
  const role = getVmRole(vmId, config.k3s.masterVmidStart, config.k3s.workerVmidStart);
  if (role === null) {
    throw new Error(`VM ${vmId} is not a managed K3s node`);
  }
  return role;
};
