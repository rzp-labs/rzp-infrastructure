/**
 * VM hardware configuration utilities
 */

import type { IK3sNodeConfig } from "../../shared/types";
import { VM_DEFAULTS } from "../../shared/constants";

export function getVmHardwareConfig(nodeConfig: IK3sNodeConfig) {
  return {
    machine: VM_DEFAULTS.MACHINE,
    bios: VM_DEFAULTS.BIOS,
    scsiHardware: VM_DEFAULTS.SCSI_HARDWARE,
    tabletDevice: false,
    bootOrders: [...VM_DEFAULTS.BOOT_ORDERS], // Create mutable copy for type compatibility
    startup: getStartupConfig(nodeConfig),
    operatingSystem: { type: VM_DEFAULTS.OS_TYPE },
    agent: { enabled: true, trim: true, type: "virtio", timeout: "15m" },
    cpu: { type: "host", cores: nodeConfig.resources.cores },
    memory: { dedicated: nodeConfig.resources.memory },
  };
}

function getStartupConfig(nodeConfig: IK3sNodeConfig) {
  return {
    order: nodeConfig.role === "master" ? 1 : 2,
    upDelay: nodeConfig.role === "master" ? 30 : 10,
  };
}
