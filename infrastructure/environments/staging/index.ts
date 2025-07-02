/**
 * Staging environment deployment
 */

import { K3sCluster } from "../../components/K3sCluster";
import { getStagingConfig } from "../../config/staging";
import { getVmRole } from "../../shared/utils";

// Get staging configuration
const config = getStagingConfig();

// Deploy K3s cluster using fresh cloud images
export const cluster = new K3sCluster("stg-k3s", {
  config,
});

// Export cluster information
export const masterIps = cluster.masterIps;
export const workerIps = cluster.workerIps;
export const allNodes = cluster.allNodes;

// Export utility function for role determination
export const getVmRoleFromId = (vmId: number) =>
  getVmRole(vmId, config.k3s.masterVmidStart, config.k3s.workerVmidStart);
