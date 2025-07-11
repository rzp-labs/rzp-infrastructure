/**
 * VM hardware configuration utilities
 *
 * Retrieves VM hardware specifications (CPU, memory, disk sizes)
 * from Pulumi configuration with sensible defaults.
 */

import * as pulumi from "@pulumi/pulumi";

import { DEFAULT_VM_RESOURCES } from "../shared/constants";
import type { IVmResourceConfig } from "../shared/types";

export function getVmResourceConfig(): IVmResourceConfig {
  const cfg = new pulumi.Config();

  return {
    cores: cfg.getNumber("vmCores") ?? DEFAULT_VM_RESOURCES.CORES,
    memory: cfg.getNumber("vmMemory") ?? DEFAULT_VM_RESOURCES.MEMORY,
    osDiskSize: cfg.getNumber("vmOsDiskSize") ?? DEFAULT_VM_RESOURCES.OS_DISK_SIZE,
    dataDiskSize: cfg.getNumber("vmDataDiskSize") ?? DEFAULT_VM_RESOURCES.DATA_DISK_SIZE,
  };
}
