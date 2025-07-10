/**
 * Staging environment deployment with proper provider architecture
 */

// import * as proxmoxve from "@muhlba91/pulumi-proxmoxve";

import * as k8s from "@pulumi/kubernetes";
import * as pulumi from "@pulumi/pulumi";
//import * as argocd from "@three14/pulumi-argocd";

import * as Components from "../../components";
import { getStagingConfig } from "../../config/staging";
//import { getArgoCdAdminPassword } from "../../helpers";
import type { IK3sNodeConfig } from "../../shared/types";
import { getVmRole } from "../../shared/utils";

// Get staging configuration
const config = getStagingConfig();

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
// const stagingProxmoxProvider = new proxmoxve.Provider("stg-proxmox", {
//   endpoint: config.proxmox.endpoint,
//   username: config.proxmox.username,
//   password: config.proxmox.password,
//   insecure: config.proxmox.insecure,
// });

// =============================================================================
// INFRASTRUCTURE DEPLOYMENT
// =============================================================================

// Deploy K3s cluster infrastructure (VMs only)
export const cluster = new Components.K3sCluster("stg-k3s", {
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
const stagingK8sProvider = new k8s.Provider(
  "stg-k8s",
  { kubeconfig: credentials.result.kubeconfig },
  {
    dependsOn: [masterInstall, ...workerInstalls],
  },
);
// =============================================================================
// NAMESPACE CREATION (No longer needed - components create their own namespaces)
// =============================================================================

// =============================================================================
// BOOTSTRAP PHASE: Direct Pulumi Deployment
// =============================================================================

// 1. Deploy MetalLB for LoadBalancer support
export const metallbBootstrap = new Components.MetalLBComponent(
  "stg-metallb-bootstrap",
  {
    namespace: "metallb-system",
    chartVersion: "0.15.2",
    environment: "stg",
    ipRange: "10.10.0.200-10.10.0.201",
  },
  {
    dependsOn: workerInstalls,
    provider: stagingK8sProvider,
  },
);

// 2. Deploy Traefik for ingress controller
export const traefikBootstrap = new Components.TraefikComponent(
  "stg-traefik-bootstrap",
  {
    namespace: "traefik",
    chartVersion: "36.3.0",
    environment: "stg",
  },
  {
    dependsOn: [metallbBootstrap],
    provider: stagingK8sProvider,
  },
);

// 3. Deploy cert-manager for TLS certificates
export const certManagerBootstrap = new Components.CertManagerComponent(
  "stg-cert-manager-bootstrap",
  {
    namespace: "cert-manager",
    chartVersion: "v1.16.1",
    environment: "stg",
    cloudflareApiToken: apiToken,
    email: email,
  },
  {
    dependsOn: [traefikBootstrap],
    provider: stagingK8sProvider,
  },
);

// 4. Deploy ArgoCD for GitOps
export const argoCd = new Components.ArgoCdComponent(
  "stg-argocd",
  {
    namespace: "argocd",
    chartVersion: "5.51.6",
    environment: "stg",
    domain: `stg.argocd.${domain}`,
  },
  {
    dependsOn: [certManagerBootstrap.clusterIssuer],
    provider: stagingK8sProvider,
  },
);
// Get ArgoCD admin password using helper (TEMPORARILY COMMENTED OUT)
// const argoCdAdminPassword = getArgoCdAdminPassword(
//   "argocd-get-admin-password",
//   {
//     masterNode: cluster.masters.map((m) => m.config)[0],
//     ssh: {
//       username: config.proxmox.ssh!.username!,
//       privateKey: config.proxmox.ssh!.privateKey!,
//     },
//     deploymentName: "stg-argocd-chart-server",
//     namespace: "argocd",
//   },
//   { dependsOn: [argoCd.chart] },
// );
// =============================================================================
// ARGOCD PROVIDER CONFIGURATION
// =============================================================================

// ArgoCD provider for GitOps application management (TEMPORARILY COMMENTED OUT)
/*const stagingArgoCdProvider = new argocd.Provider(
  "stg-argocd-provider",
  {
    serverAddr: `https://stg.argocd.${domain}`, // External ingress URL
    username: "admin",
    password: argoCdAdminPassword, // Retrieved via helper after deployment
    insecure: false, // Use proper TLS validation with Let's Encrypt certificates
    // Note: Client certificates not needed for external HTTPS access
  },
  {
    dependsOn: [argoCd.ingress], // Wait for ingress to be ready and accessible
  },
);

// =============================================================================
// GITOPS PHASE: ArgoCD Applications Using Same Components
// =============================================================================

// Now deploy ArgoCD applications that use the same components with identical configs
// This completes the bootstrap-to-GitOps transition pattern

// MetalLB ArgoCD Application
export const metallbApp = new argocd.Application(
  "stg-metallb-app",
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
            values: metallbBootstrap.helmValuesOutput, // Reference bootstrap component values
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
  { provider: stagingArgoCdProvider },
);

// Traefik ArgoCD Application
export const traefikApp = new argocd.Application(
  "stg-traefik-app",
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
            values: traefikBootstrap.helmValuesOutput, // Reference bootstrap component values
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
  { provider: stagingArgoCdProvider },
);

// cert-manager ArgoCD Application
export const certManagerApp = new argocd.Application(
  "stg-cert-manager-app",
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
            values: certManagerBootstrap.helmValuesOutput, // Reference bootstrap component values
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
  { provider: stagingArgoCdProvider },
);
*/
// =============================================================================
// EXPORTS
// =============================================================================

export const masterIps = cluster.masterIps;
export const workerIps = cluster.workerIps;
export const allNodes = cluster.allNodes;
export const kubeconfig = credentials.result.kubeconfig;
export const argoCdUrl = argoCd.ingress.spec.rules[0].host.apply((host) => `https://${host}`);
// export const argoCdPassword = argoCdAdminPassword; // Commented out with password retrieval

// Utility function for role determination
export const getVmRoleFromId = (vmId: number): IK3sNodeConfig["role"] => {
  const role = getVmRole(vmId, config.k3s.masterVmidStart, config.k3s.workerVmidStart);
  if (role === null) {
    throw new Error(`VM ${vmId} is not a managed K3s node`);
  }
  return role;
};
