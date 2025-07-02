/**
 * Staging environment deployment
 */

import { K3sCluster } from "../../components/k3s/k3s-cluster";
import { K3sInstaller } from "../../components/k3s/k3s-installer";
import { getStagingConfig } from "../../config/staging";
import { getVmRole } from "../../shared/utils";

// Get staging configuration
const config = getStagingConfig();

// Deploy K3s cluster infrastructure (VMs only)
export const cluster = new K3sCluster("stg-k3s", {
  config,
});

// Install K3s on the cluster
export const k3sInstaller = new K3sInstaller(
  "k3s-installer",
  {
    masterNodes: cluster.masters.map((m) => m.config),
    workerNodes: cluster.workers.map((w) => w.config),
    sshPrivateKey: config.proxmox.ssh!.privateKey!,
    sshUsername: config.proxmox.ssh!.username!,
  },
  {
    dependsOn: [...cluster.masters, ...cluster.workers],
  },
);

// Export cluster information
export const masterIps = cluster.masterIps;
export const workerIps = cluster.workerIps;
export const allNodes = cluster.allNodes;
export const kubeconfig = k3sInstaller.result.kubeconfig;

// Export utility function for role determination
export const getVmRoleFromId = (vmId: number) =>
  getVmRole(vmId, config.k3s.masterVmidStart, config.k3s.workerVmidStart);
