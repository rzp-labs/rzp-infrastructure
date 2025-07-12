/**
 * Staging environment deployment with proper provider architecture
 */

//import * as command from "@pulumi/command";
import * as k8s from "@pulumi/kubernetes";
import * as pulumi from "@pulumi/pulumi";

import * as Components from "../../components";
import { getStagingConfig } from "../../config/staging";
import { createArgoCdApplication } from "../../helpers/argocd/application-factory";
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
    dependsOn: [masterInstall.k3sHealthCheck, ...workerInstalls],
  },
);

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
    httpsPort: 443, // Staging uses port 443 for direct traffic
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
    domain: `argocd.stg.${domain}`,
  },
  {
    dependsOn: [certManagerBootstrap.clusterIssuer],
    provider: stagingK8sProvider,
  },
);

// =============================================================================
// GITOPS PHASE: ArgoCD Applications (using Kubernetes CustomResource approach)
// =============================================================================
// These ArgoCD Applications will manage the same components that were bootstrapped,
// completing the bootstrap-to-GitOps transition with identical configurations.
// Using Kubernetes CustomResource instead of ArgoCD provider to avoid proxy/cert issues.

// MetalLB ArgoCD Application - using helper factory
export const metallbApp = createArgoCdApplication(
  "stg-metallb-app",
  {
    name: "metallb",
    sources: [
      {
        repoURL: "https://metallb.github.io/metallb",
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
  },
  argoCd.namespace.metadata.name,
  {
    dependsOn: [argoCd.chart],
    provider: stagingK8sProvider,
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

// Utility function for role determination
export const getVmRoleFromId = (vmId: number): IK3sNodeConfig["role"] => {
  const role = getVmRole(vmId, config.k3s.masterVmidStart, config.k3s.workerVmidStart);
  if (role === null) {
    throw new Error(`VM ${vmId} is not a managed K3s node`);
  }
  return role;
};
