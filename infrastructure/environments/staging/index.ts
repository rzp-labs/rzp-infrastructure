/**
 * Staging environment deployment with proper provider architecture
 */
import * as proxmoxve from "@muhlba91/pulumi-proxmoxve";
import * as k8s from "@pulumi/kubernetes";

import * as Components from "../../components";
import { getStagingConfig } from "../../config/staging";
import type { IK3sNodeConfig } from "../../shared/types";
import { getVmRole } from "../../shared/utils";

// Get staging configuration
const config = getStagingConfig();

export const proxmoxProvider = new proxmoxve.Provider("proxmox", {
  endpoint: config.proxmox.endpoint,
  username: config.proxmox.username,
  password: config.proxmox.password,
  insecure: config.proxmox.insecure,
  ssh: config.proxmox.ssh,
});

// Deploy K3s cluster infrastructure (VMs only)
export const cluster = new Components.K3sCluster(
  "stg-k3s",
  {
    config,
  },
  { provider: proxmoxProvider },
);

// Install K3s masters with dynamic addition pattern
// First master (always present, creates the cluster)
export const firstMaster = new Components.K3sMaster(
  "stg-k3s-master",
  {
    node: cluster.masters[0].config,
    sshUsername: config.proxmox.ssh!.username!,
    sshPrivateKey: config.proxmox.ssh!.privateKey!,
    isFirstMaster: true,
  },
  {
    parent: cluster.masters[0], // Make K3sMaster a child of its VM
  },
);

// Retrieve K3s credentials
export const credentials = new Components.K3sCredentials(
  "k3s-credentials",
  {
    masterNode: cluster.masters[0].config,
    sshUsername: config.proxmox.ssh!.username!,
    sshPrivateKey: config.proxmox.ssh!.privateKey!,
  },
  {
    parent: cluster.masters[0], // Make credentials a child of the first master VM
    dependsOn: [firstMaster],
  },
);

// Additional masters (only when masterCount > 1)
export const additionalMasters = cluster.masters.slice(1).map(
  (master, index) =>
    new Components.K3sMaster(
      `stg-k3s-master-${index + 1}`,
      {
        node: master.config,
        sshUsername: config.proxmox.ssh!.username!,
        sshPrivateKey: config.proxmox.ssh!.privateKey!,
        isFirstMaster: false,
        serverEndpoint: `https://${cluster.masters[0].config.ip4}:6443`,
        token: credentials.result.token,
      },
      {
        parent: master, // Make K3sMaster a child of its VM
        dependsOn: [firstMaster, credentials],
      },
    ),
);

// All masters for dependency management
export const allMasters = [firstMaster, ...additionalMasters];

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
        masterEndpoint: cluster.masters[0].config.ip4,
      },
      {
        parent: worker, // Make K3sWorker a child of its VM
        dependsOn: [credentials],
      },
    ),
);

// Kubernetes provider for all K8s resources (created after components are ready)
const stagingK8sProvider = new k8s.Provider(
  "stg-k8s-provider",
  { kubeconfig: credentials.result.kubeconfig },
  {
    dependsOn: [firstMaster.k3sHealthCheck, ...additionalMasters.map((m) => m.k3sHealthCheck), ...workerInstalls],
  },
);

// =============================================================================
// BOOTSTRAP PHASE: ArgoCD Deployment
// =============================================================================

// 5. Deploy ArgoCD for GitOps
export const argoCd = new Components.ArgoCdComponent(
  "argocd",
  {
    namespace: "argocd",
    chartVersion: "5.51.6",
    environment: "stg",
    domain: `argocd.stg.rzp.one`,
  },
  {
    dependsOn: [stagingK8sProvider],
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

// Utility function for role determination
export const getVmRoleFromId = (vmId: number): IK3sNodeConfig["role"] => {
  const role = getVmRole(vmId, config.k3s.masterVmidStart, config.k3s.workerVmidStart);
  if (role === null) {
    throw new Error(`VM ${vmId} is not a managed K3s node`);
  }
  return role;
};
