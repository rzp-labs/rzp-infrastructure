/**
 * Staging environment configuration
 */

import * as pulumi from "@pulumi/pulumi";

import { VM_ID_RANGES } from "../shared/constants";
import type { IEnvironmentConfig, IK3sClusterConfig } from "../shared/types";

import { getNetworkConfig, getProxmoxConfig, getVmResourceConfig } from "./vm-config";

function getK3sClusterConfig(): IK3sClusterConfig {
  const cfg = new pulumi.Config();
  const network = getNetworkConfig();
  const vmResources = getVmResourceConfig();

  const vmidBase = cfg.getNumber("vmidBase") ?? 120;
  const masterCount = cfg.getNumber("masterCount") ?? 1;
  const workerCount = cfg.getNumber("workerCount") ?? 1;

  return {
    masterCount,
    workerCount,
    vmidBase,
    masterVmidStart: vmidBase + VM_ID_RANGES.MASTERS.OFFSET,
    workerVmidStart: vmidBase + VM_ID_RANGES.WORKERS.OFFSET,
    network,
    masterVmResources: vmResources,
    workerVmResources: vmResources,
  };
}

export function getStagingConfig(): IEnvironmentConfig {
  return {
    name: "staging",
    proxmox: getProxmoxConfig(),
    k3s: getK3sClusterConfig(),
  };
}
