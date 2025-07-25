/**
 * Production environment configuration
 */

import * as pulumi from "@pulumi/pulumi";

import { VM_ID_RANGES } from "../shared/constants";
import type { IEnvironmentConfig, IK3sClusterConfig } from "../shared/types";

import { getNetworkConfig, getProxmoxConfig, getVmResourceConfig } from "./vm-config";

function getK3sClusterConfig(): IK3sClusterConfig {
  const cfg = new pulumi.Config();
  const network = getNetworkConfig();
  const vmResources = getVmResourceConfig();

  // Production masters get 4GB, workers get 8GB
  const productionMasterResources = {
    ...vmResources,
    cores: vmResources.cores * 2, // 4 cores for masters
    memory: vmResources.memory * 8, // 16GB for masters
  };

  const productionWorkerResources = {
    ...vmResources,
    cores: vmResources.cores * 2, // 4 cores for workers
    memory: vmResources.memory * 8, // 16GB for workers
  };

  const vmidBase = cfg.getNumber("vmidBase") ?? 220;
  const masterCount = cfg.getNumber("masterCount") ?? 2;
  const workerCount = cfg.getNumber("workerCount") ?? 2;

  return {
    masterCount,
    workerCount,
    vmidBase,
    masterVmidStart: vmidBase + VM_ID_RANGES.MASTERS.OFFSET,
    workerVmidStart: vmidBase + VM_ID_RANGES.WORKERS.OFFSET,
    network,
    masterVmResources: productionMasterResources,
    workerVmResources: productionWorkerResources,
  };
}

export function getProductionConfig(): IEnvironmentConfig {
  return {
    name: "production",
    proxmox: getProxmoxConfig(),
    k3s: getK3sClusterConfig(),
  };
}
