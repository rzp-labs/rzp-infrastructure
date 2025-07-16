/**
 * Staging environment deployment with proper provider architecture
 */

import * as k8s from "@pulumi/kubernetes";
import * as pulumi from "@pulumi/pulumi";

import * as Components from "../../components";
import { getStagingConfig } from "../../config/staging";
import type { IK3sNodeConfig } from "../../shared/types";
import { getVmRole } from "../../shared/utils";

// Get staging configuration
const config = getStagingConfig();

// Get Cloudflare configuration directly
const cloudflareConfig = new pulumi.Config("cloudflare");

const domain = cloudflareConfig.require("domain");
const email = cloudflareConfig.require("email");
const apiToken = cloudflareConfig.requireSecret("apiToken");

// Get Longhorn configuration
const projectConfig = new pulumi.Config("rzp-infra");
const longhornPassword = projectConfig.requireSecret("longhornPassword");

// =============================================================================
// INFRASTRUCTURE DEPLOYMENT
// =============================================================================

// Deploy K3s cluster infrastructure (VMs only)
export const cluster = new Components.K3sCluster("stg-k3s", {
  config,
});

// Install K3s master
export const masterInstall = new Components.K3sMaster("stg-k3s-master", {
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
      `stg-k3s-worker-${index}`,
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
  "stg-k8s-provider",
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
  "metallb",
  {
    namespace: "stg-metallb",
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
  "traefik",
  {
    namespace: "stg-traefik",
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
  "cert-manager",
  {
    namespace: "stg-cert-manager",
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

// 4. Deploy Longhorn for distributed storage with enhanced RBAC and validation
export const longhornBootstrap = new Components.LonghornComponent(
  "longhorn",
  {
    namespace: "stg-longhorn",
    chartVersion: "1.7.2",
    environment: "stg",
    domain: `longhorn.stg.${domain}`,
    defaultStorageClass: true,
    replicaCount: 2,
    adminPassword: longhornPassword,
    // Enhanced uninstaller RBAC configuration
    enableUninstallerRbac: true,
    uninstallerTimeoutSeconds: 900, // 15 minutes for staging environment
    // Prerequisite validation for staging environment
    validatePrerequisites: true,
    // Enhanced deployment monitoring and error handling
    enableDeploymentMonitoring: true,
    deploymentTimeoutSeconds: 2400, // 40 minutes for staging (longer than production)
    maxRetries: 5, // More retries for staging environment
    enableStatusTracking: true,
  },
  {
    dependsOn: [certManagerBootstrap],
    provider: stagingK8sProvider,
  },
);

// 5. Deploy ArgoCD for GitOps
export const argoCd = new Components.ArgoCdComponent(
  "argocd",
  {
    namespace: "stg-argocd",
    chartVersion: "5.51.6",
    environment: "stg",
    domain: `argocd.stg.${domain}`,
  },
  {
    dependsOn: [longhornBootstrap],
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

// Enhanced Longhorn exports for staging environment monitoring
export const longhornUrl = longhornBootstrap.ingress.spec.rules[0].host.apply((host) => `https://${host}`);
export const longhornUninstallerRbac = longhornBootstrap.uninstallerRbac;
export const longhornPrerequisiteValidation = longhornBootstrap.prerequisiteValidation;
export const longhornDeploymentStatus = longhornBootstrap.statusConfigMap;
export const longhornHelmValues = longhornBootstrap.helmValuesOutput;

// Utility function for role determination
export const getVmRoleFromId = (vmId: number): IK3sNodeConfig["role"] => {
  const role = getVmRole(vmId, config.k3s.masterVmidStart, config.k3s.workerVmidStart);
  if (role === null) {
    throw new Error(`VM ${vmId} is not a managed K3s node`);
  }
  return role;
};
