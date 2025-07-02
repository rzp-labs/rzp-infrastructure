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

/**
 * Builds VM identity configuration including name, node, ID, and description
 */
function getVmIdentity(nodeConfig: IK3sNodeConfig, config: IProxmoxConfig) {
  const capitalize = (str: string): string => str.charAt(0).toUpperCase() + str.slice(1);

  return {
    name: nodeConfig.name, // Explicit VM name to override Pulumi auto-generation
    nodeName: config.node,
    vmId: nodeConfig.vmId,
    description: `K3s ${capitalize(nodeConfig.role)} Node ${nodeConfig.roleIndex + 1}`,
  };
}

/**
 * Builds VM state configuration for startup and template settings
 */
function getVmState() {
  return {
    // Build from fresh cloud image instead of cloning
    template: false,
    started: true,
    onBoot: true,
  };
}

/**
 * Builds VM tags array based on node configuration
 */
function getVmTags(nodeConfig: IK3sNodeConfig) {
  return {
    tags: ["stg", "k3s", nodeConfig.role],
  };
}

/**
 * Composes the final VM configuration from all component parts
 */
/**
 * Composes the final VM configuration from all component parts
 */
function composeVmConfiguration(parts: {
  identity: ReturnType<typeof getVmIdentity>;
  state: ReturnType<typeof getVmState>;
  tags: ReturnType<typeof getVmTags>;
  hardware: ReturnType<typeof getVmHardwareConfig>;
  disks: ReturnType<typeof getVmDiskConfig>;
  network: { bridge: string; model: string }[];
  cloudInit: ReturnType<typeof getVmCloudInitConfig>;
}) {
  return {
    ...parts.identity,
    ...parts.state,
    ...parts.tags,
    ...parts.hardware,
    disks: parts.disks,
    networkDevices: parts.network,
    initialization: parts.cloudInit,
  };
}

export function buildVmConfiguration(args: IVmConfigArgs) {
  return composeVmConfiguration({
    identity: getVmIdentity(args.nodeConfig, args.config),
    state: getVmState(),
    tags: getVmTags(args.nodeConfig),
    hardware: getVmHardwareConfig(args.nodeConfig),
    disks: getVmDiskConfig(args.nodeConfig, args.config, args.cloudImage),
    network: [{ bridge: args.config.bridge, model: VM_DEFAULTS.NETWORK_MODEL }],
    cloudInit: getVmCloudInitConfig({
      nodeConfig: args.nodeConfig,
      config: args.config,
      metadataFile: args.metadataFile,
      userDataFile: args.userDataFile,
    }),
  });
}
