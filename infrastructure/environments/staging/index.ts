/**
 * Staging environment deployment
 */

import * as k8s from "@pulumi/kubernetes";

import { ArgoCdBootstrap } from "../../components/argocd/argocd-bootstrap";
import { K3sCluster } from "../../components/k3s/k3s-cluster";
import { K3sCredentials } from "../../components/k3s/k3s-credentials";
import { K3sMaster } from "../../components/k3s/k3s-master";
import { K3sWorker } from "../../components/k3s/k3s-worker";
import { MetalLBBootstrap } from "../../components/metallb";
import { TraefikBootstrap } from "../../components/traefik/traefik-bootstrap";
import { getCloudflareConfig } from "../../config/cloudflare-config";
import { getStagingConfig } from "../../config/staging";
import { isDashboardEnabled } from "../../config/traefik-config";
import { METALLB_DEFAULTS } from "../../shared/constants";
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

// Deploy Traefik ingress controller (bootstrap)
// Use simple chart dependency instead of custom readiness gate
export const traefik = new TraefikBootstrap(
  "stg-traefik",
  {
    domain: cloudflareConfig.domain,
    email: cloudflareConfig.email,
    staging: true, // Use Let's Encrypt staging for testing
    dashboard: isDashboardEnabled(),
  },
  {
    dependsOn: [metallb.chart], // Wait for MetalLB chart to be ready
    providers: { kubernetes: defaultK8sProvider },
  },
);

// Deploy ArgoCD for GitOps
export const argocd = new ArgoCdBootstrap(
  "stg-argocd",
  {
    repositoryUrl: "https://github.com/rzp-labs/rzp-infrastructure.git",
    // adminPassword will be read from Pulumi config: pulumi config set --secret argoCdAdminPassword
    domain: `stg.argocd.${cloudflareConfig.domain}`,
  },
  {
    dependsOn: [traefik],
    providers: { kubernetes: defaultK8sProvider },
  },
);

// Export cluster information
export const masterIps = cluster.masterIps;
export const workerIps = cluster.workerIps;
export const allNodes = cluster.allNodes;
export const kubeconfig = credentials.result.kubeconfig;
export const argoCdUrl = argocd.ingress.spec.rules[0].host.apply((host) => `https://${host}`);
export const traefikDashboardUrl = traefik.dashboard
  ? traefik.dashboard.spec.rules[0].host.apply((host) => `https://${host}`)
  : undefined;

// Export utility function for role determination
export const getVmRoleFromId = (vmId: number) =>
  getVmRole(vmId, config.k3s.masterVmidStart, config.k3s.workerVmidStart);
