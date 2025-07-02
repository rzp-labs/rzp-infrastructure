/**
 * VM configuration builder utilities
 */

import type { IK3sNodeConfig, IProxmoxConfig } from "../../shared/types";
import { VM_DEFAULTS } from "../../shared/constants";
import type { DebianCloudImage } from "../../resources/storage/images";
import type * as proxmoxve from "@muhlba91/pulumi-proxmoxve";
import { getVmHardwareConfig } from "./vm-hardware";
import { getVmDiskConfig } from "./vm-storage";
import { getVmCloudInitConfig } from "./vm-cloud-init";

interface IVmConfigArgs {
  readonly nodeConfig: IK3sNodeConfig;
  readonly config: IProxmoxConfig;
  readonly cloudImage: DebianCloudImage;
  readonly metadataFile: proxmoxve.storage.File;
  readonly userDataFile: proxmoxve.storage.File;
}

// TODO: Break up buildVmConfiguration into logical functions:
// - getVmIdentity(nodeConfig, config) -> {name, nodeName, vmId, description}
// - getVmState() -> {template: false, started: true, onBoot: true}
// - getVmTags(nodeConfig) -> {tags: [...]}
// - composeVmConfiguration(identity, state, tags, hardware, disks, network, cloudInit)
export function buildVmConfiguration(args: IVmConfigArgs) {
  const capitalize = (str: string): string => str.charAt(0).toUpperCase() + str.slice(1);

  return {
    name: args.nodeConfig.name, // Explicit VM name to override Pulumi auto-generation
    nodeName: args.config.node,
    vmId: args.nodeConfig.vmId,

    // Build from fresh cloud image instead of cloning
    template: false,

    started: true,
    onBoot: true,
    tags: ["stg", "k3s", args.nodeConfig.role],
    description: `K3s ${capitalize(args.nodeConfig.role)} Node ${args.nodeConfig.roleIndex + 1}`,

    // VM hardware configuration
    ...getVmHardwareConfig(args.nodeConfig),

    // Storage configuration
    disks: getVmDiskConfig(args.nodeConfig, args.config, args.cloudImage),

    networkDevices: [{ bridge: args.config.bridge, model: VM_DEFAULTS.NETWORK_MODEL }],

    // Cloud-init configuration with separate metadata and user data files
    initialization: getVmCloudInitConfig({
      nodeConfig: args.nodeConfig,
      config: args.config,
      metadataFile: args.metadataFile,
      userDataFile: args.userDataFile,
    }),
  };
}
