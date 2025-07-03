/**
 * Staging environment deployment
 */

import { ArgoCdBootstrap } from "../../components/argocd/argocd-bootstrap";
import { K3sCluster } from "../../components/k3s/k3s-cluster";
import { K3sCredentials } from "../../components/k3s/k3s-credentials";
import { K3sMaster } from "../../components/k3s/k3s-master";
import { K3sWorker } from "../../components/k3s/k3s-worker";
import { getStagingConfig } from "../../config/staging";
import { getVmRole } from "../../shared/utils";

// Get staging configuration
const config = getStagingConfig();

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

// Deploy ArgoCD for GitOps
export const argocd = new ArgoCdBootstrap(
  "stg-argocd",
  {
    kubeconfig: credentials.result.kubeconfig,
    repositoryUrl: "https://github.com/stephen/rzp-infra.git", // Update with actual repo URL
    // adminPassword will be read from Pulumi config: pulumi config set --secret argoCdAdminPassword
    domain: "argocd.staging.rzp.local",
  },
  {
    dependsOn: [...workerInstalls],
  },
);

// Export cluster information
export const masterIps = cluster.masterIps;
export const workerIps = cluster.workerIps;
export const allNodes = cluster.allNodes;
export const kubeconfig = credentials.result.kubeconfig;
export const argoCdUrl = `https://${argocd.ingress.spec.rules[0].host}`;

// Export utility function for role determination
export const getVmRoleFromId = (vmId: number) =>
  getVmRole(vmId, config.k3s.masterVmidStart, config.k3s.workerVmidStart);
