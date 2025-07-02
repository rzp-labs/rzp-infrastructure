/**
 * Staging environment deployment
 */

import { K3sCluster } from "../../components/K3sCluster";
import { getStagingConfig } from "../../config/staging";
import { getVmRole } from "../../shared/utils";

// Get staging configuration
const config = getStagingConfig();

// Deploy K3s cluster using template VM 9000
export const cluster = new K3sCluster("stg-k3s", {
  config,
  templateVmId: 9000, // Clone from your existing k3s template
});

// Export cluster information
export const masterIps = cluster.masterIps;
export const workerIps = cluster.workerIps;
export const allNodes = cluster.allNodes;

// Export utility function for role determination
export const getVmRoleFromId = (vmId: number) =>
  getVmRole(vmId, config.k3s.masterVmidStart, config.k3s.workerVmidStart);
