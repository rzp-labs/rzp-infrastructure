/**
 * VM storage and disk configuration utilities
 */

import type { IK3sNodeConfig, IProxmoxConfig } from "../../shared/types";
import { VM_DEFAULTS } from "../../shared/constants";
import type { DebianCloudImage } from "../../resources/storage/images";

export function getVmDiskConfig(nodeConfig: IK3sNodeConfig, config: IProxmoxConfig, cloudImage: DebianCloudImage) {
  return [createOsDisk(nodeConfig, config, cloudImage), createDataDisk(nodeConfig, config)];
}

function createOsDisk(nodeConfig: IK3sNodeConfig, config: IProxmoxConfig, cloudImage: DebianCloudImage) {
  return {
    datastoreId: config.vmStore,
    interface: "scsi0",
    size: nodeConfig.resources.osDiskSize,
    ssd: true,
    cache: VM_DEFAULTS.DISK_CACHE,
    discard: VM_DEFAULTS.DISK_DISCARD,
    aio: VM_DEFAULTS.DISK_AIO,
    fileFormat: "raw",
    fileId: cloudImage.id, // Use fresh cloud image
  };
}

function createDataDisk(nodeConfig: IK3sNodeConfig, config: IProxmoxConfig) {
  return {
    // Add additional data disk
    datastoreId: config.vmStore,
    interface: "scsi1",
    size: nodeConfig.resources.dataDiskSize,
    ssd: true,
    cache: VM_DEFAULTS.DISK_CACHE,
    discard: VM_DEFAULTS.DISK_DISCARD,
  };
}
