/**
 * Staging environment deployment
 */

import * as k8s from "@pulumi/kubernetes";
// import * as argoCdProvider from "@three14/pulumi-argocd";

import { ArgoCdBootstrap } from "../../components/argocd/argocd-bootstrap";
import { CertManagerBootstrap } from "../../components/cert-manager";
import { K3sCluster } from "../../components/k3s/k3s-cluster";
import { K3sCredentials } from "../../components/k3s/k3s-credentials";
import { K3sMaster } from "../../components/k3s/k3s-master";
import { K3sWorker } from "../../components/k3s/k3s-worker";
import { MetalLBBootstrap, MetalLBPools } from "../../components/metallb";
import { TraefikBootstrap } from "../../components/traefik/traefik-bootstrap";
import { getCloudflareConfig } from "../../config/cloudflare-config";
import { getStagingConfig } from "../../config/staging";
import { METALLB_DEFAULTS } from "../../shared/constants";
import type { IK3sNodeConfig } from "../../shared/types";
import { getVmRole } from "../../shared/utils";

// Get staging configuration
const config = getStagingConfig();
const cloudflareConfig = getCloudflareConfig();

// Deploy K3s cluster infrastructure (VMs only)
export const cluster = new K3sCluster("stg-k3s", {
  config,
});

// Install K3s master
export const masterInstall = new K3sMaster(
  "k3s-master",
  {
    node: cluster.masters.map((m) => m.config)[0],
    sshUsername: config.proxmox.ssh!.username!,
    sshPrivateKey: config.proxmox.ssh!.privateKey!,
    isFirstMaster: true,
  },
  {
    dependsOn: [...cluster.masters],
  },
);

// Retrieve K3s credentials
export const credentials = new K3sCredentials(
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

// Configure default Kubernetes provider for all resources
const defaultK8sProvider = new k8s.Provider("default-k8s", {
  kubeconfig: credentials.result.kubeconfig,
});

// Install K3s workers - use individual worker dependencies instead of array spreading
export const workerInstalls = cluster.workers.map(
  (worker, index) =>
    new K3sWorker(
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

// Deploy MetalLB load balancer (idempotent)
export const metallb = new MetalLBBootstrap(
  "stg-metallb",
  {
    ipRange: METALLB_DEFAULTS.STAGING_IP_RANGE,
  },
  {
    // Fix: Avoid array spreading which can cause promise leaks on failure
    dependsOn: workerInstalls,
    providers: { kubernetes: defaultK8sProvider },
  },
);
// Deploy MetalLB IP pools (required for load balancer functionality)
// Cannot be created via Helm extraResources due to CRD timing limitations
export const metallbPools = new MetalLBPools(
  "stg-metallb-pools",
  {
    ipRange: METALLB_DEFAULTS.STAGING_IP_RANGE,
  },
  {
    dependsOn: [metallb.chart], // Wait for MetalLB chart and CRDs to be ready
    providers: { kubernetes: defaultK8sProvider },
  },
);
// Deploy cert-manager for TLS certificate provisioning
// Independent of MetalLB, can start in parallel after K8s cluster is ready
export const certManager = new CertManagerBootstrap(
  "stg-cert-manager",
  {
    email: cloudflareConfig.email,
    environment: "stg", // Uses staging Let's Encrypt server
    cloudflareApiToken: cloudflareConfig.apiToken,
  },
  {
    dependsOn: workerInstalls, // Wait for K8s cluster to be ready
    providers: { kubernetes: defaultK8sProvider },
  },
);

// Deploy Traefik ingress controller (bootstrap)
// Use simple chart dependency instead of custom readiness gate
export const traefik = new TraefikBootstrap(
  "stg-traefik",
  {
    domain: cloudflareConfig.domain,
    email: cloudflareConfig.email,
    environment: "stg", // Use staging environment
    dashboard: false,
  },
  {
    dependsOn: [metallbPools], // Wait for MetalLB IP allocation to be ready
    providers: { kubernetes: defaultK8sProvider },
  },
);

// Deploy ArgoCD for GitOps
export const argocd = new ArgoCdBootstrap(
  "stg-argocd",
  {
    repositoryUrl: "https://github.com/rzp-labs/rzp-infrastructure.git",
    domain: `stg.argocd.${cloudflareConfig.domain}`,
  },
  {
    dependsOn: [traefik, certManager.clusterIssuer], // Wait for both ingress controller and TLS certificate capability
    providers: { kubernetes: defaultK8sProvider },
  },
);

// Export cluster information
export const masterIps = cluster.masterIps;
export const workerIps = cluster.workerIps;
export const allNodes = cluster.allNodes;
export const kubeconfig = credentials.result.kubeconfig;
export const argoCdUrl = argocd.ingress.spec.rules[0].host.apply((host) => `https://${host}`);
// Note: Password capture removed - use kubectl to get admin password when needed

// Note: ArgoCD admin password can be retrieved with kubectl when needed
// Dashboard URL not available via Pulumi exports when managed by Helm chart
export const traefikDashboardUrl = undefined;

// Export utility function for role determination
export const getVmRoleFromId = (vmId: number): IK3sNodeConfig["role"] => {
  const role = getVmRole(vmId, config.k3s.masterVmidStart, config.k3s.workerVmidStart);
  if (role === null) {
    throw new Error(`VM ${vmId} is not a managed K3s node`);
  }
  return role;
};
