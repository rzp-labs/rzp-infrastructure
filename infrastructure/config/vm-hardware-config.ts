/**
 * VM hardware configuration utilities
 *
 * Retrieves VM hardware specifications (CPU, memory, disk sizes)
 * from Pulumi configuration with sensible defaults.
 */

import * as pulumi from "@pulumi/pulumi";

import { DEFAULT_VM_RESOURCES } from "../shared/constants";

interface IVmHardware {
  readonly cores: number;
  readonly memory: number;
}

interface IVmDiskSizes {
  readonly osDiskSize: number;
  readonly dataDiskSize: number;
}

export function getVmHardware(): IVmHardware {
  const cfg = new pulumi.Config();

  return {
    cores: cfg.getNumber("vmCores") ?? DEFAULT_VM_RESOURCES.CORES,
    memory: cfg.getNumber("vmMemory") ?? DEFAULT_VM_RESOURCES.MEMORY,
  };
}

export function getVmDiskSizes(): IVmDiskSizes {
  const cfg = new pulumi.Config();

  return {
    osDiskSize: cfg.getNumber("vmOsDiskSize") ?? DEFAULT_VM_RESOURCES.OS_DISK_SIZE,
    dataDiskSize: cfg.getNumber("vmDataDiskSize") ?? DEFAULT_VM_RESOURCES.DATA_DISK_SIZE,
  };
}
