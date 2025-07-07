/**
 * Staging environment deployment with proper provider architecture
 */

// import * as proxmoxve from "@muhlba91/pulumi-proxmoxve";
import * as k8s from "@pulumi/kubernetes";
import * as pulumi from "@pulumi/pulumi";
import * as argocd from "@three14/pulumi-argocd";

import { ArgoCdSimple } from "../../components/argocd/argocd-simple";
import { CertManagerArgoCdApp } from "../../components/cert-manager/cert-manager-argocd-app";
import { K3sCluster } from "../../components/k3s/k3s-cluster";
import { K3sCredentials } from "../../components/k3s/k3s-credentials";
import { K3sMaster } from "../../components/k3s/k3s-master";
import { K3sWorker } from "../../components/k3s/k3s-worker";
import { MetalLBArgoCdApp } from "../../components/metallb/metallb-argocd-app";
import { MetalLBPools } from "../../components/metallb/metallb-pools";
import { TraefikArgoCdApp } from "../../components/traefik/traefik-argocd-app";
import { getCloudflareConfig } from "../../config/cloudflare-config";
import { getStagingConfig } from "../../config/staging";
import { METALLB_DEFAULTS } from "../../shared/constants";
import type { IK3sNodeConfig } from "../../shared/types";
import { getVmRole } from "../../shared/utils";

// Get staging configuration
const config = getStagingConfig();
const cloudflareConfig = getCloudflareConfig();

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

// Kubernetes provider for all K8s resources
const stagingK8sProvider = new k8s.Provider("stg-k8s", {
  kubeconfig: credentials.result.kubeconfig,
});

// Install K3s workers
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

// =============================================================================
// CORE PLATFORM (Pulumi Deployment)
// =============================================================================

// Deploy ArgoCD for GitOps
export const argoCd = new ArgoCdSimple(
  "stg-argocd",
  {
    repositoryUrl: "https://github.com/rzp-labs/rzp-infrastructure.git",
    domain: `stg.argocd.${cloudflareConfig.domain}`,
  },
  {
    dependsOn: workerInstalls,
    provider: stagingK8sProvider,
  },
);

// =============================================================================
// ARGOCD PROVIDER CONFIGURATION
// =============================================================================

// Capture ArgoCD auto-generated admin password
const argoCdAdminSecret = k8s.core.v1.Secret.get(
  "argocd-admin-secret",
  pulumi.interpolate`${argoCd.namespace.metadata.name}/argocd-initial-admin-secret`,
  {
    dependsOn: [argoCd.chart],
    provider: stagingK8sProvider,
  },
);

const argoCdAdminPassword = argoCdAdminSecret.data.password.apply((p) => Buffer.from(p, "base64").toString());

// ArgoCD provider for GitOps application management
const stagingArgoCdProvider = new argocd.Provider(
  "stg-argocd-provider",
  {
    serverAddr: argoCd.ingress.spec.rules[0].host.apply((host) => `https://${host}`),
    username: "admin",
    password: argoCdAdminPassword,
    insecure: true, // staging only
  },
  {
    dependsOn: [argoCd.chart],
  },
);

// =============================================================================
// GITOPS APPLICATIONS (ArgoCD Managed)
// =============================================================================

// Deploy cert-manager via ArgoCD
export const certManagerApp = new CertManagerArgoCdApp("stg-cert-manager", {
  targetRevision: "v1.18.2",
  namespace: "cert-manager",
  argoCdProvider: stagingArgoCdProvider,
});

// Deploy Traefik via ArgoCD
export const traefikApp = new TraefikArgoCdApp("stg-traefik", {
  targetRevision: "36.3.0",
  namespace: "traefik",
  argoCdProvider: stagingArgoCdProvider,
});

// Deploy MetalLB via ArgoCD
export const metallbApp = new MetalLBArgoCdApp("stg-metallb", {
  targetRevision: "0.15.2",
  namespace: "metallb-system",
  argoCdProvider: stagingArgoCdProvider,
});

// MetalLB IP pools (still via Pulumi - chart doesn't support this)
export const metallbPools = new MetalLBPools(
  "stg-metallb-pools",
  {
    ipRange: METALLB_DEFAULTS.STAGING_IP_RANGE,
  },
  {
    dependsOn: [metallbApp.application],
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
export const argoCdPassword = argoCdAdminPassword;

// Utility function for role determination
export const getVmRoleFromId = (vmId: number): IK3sNodeConfig["role"] => {
  const role = getVmRole(vmId, config.k3s.masterVmidStart, config.k3s.workerVmidStart);
  if (role === null) {
    throw new Error(`VM ${vmId} is not a managed K3s node`);
  }
  return role;
};
