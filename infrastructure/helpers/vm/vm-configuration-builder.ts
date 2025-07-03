/**
 * VM configuration builder utilities
 *
 * Provides helper functions to compose complete VM configurations
 * from various configuration sources and component builders.
 */

import type * as proxmoxve from "@muhlba91/pulumi-proxmoxve";

import { getVmCloudInitConfig } from "../../components/vm/vm-cloud-init";
import { getVmHardwareConfig } from "../../components/vm/vm-hardware";
import { getVmDiskConfig } from "../../components/vm/vm-storage";
import type { DebianCloudImage } from "../../resources/storage/images";
import { VM_DEFAULTS } from "../../shared/constants";
import type { IK3sNodeConfig, IProxmoxConfig } from "../../shared/types";
import { capitalize } from "../../shared/utils";

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
  return {
    name: nodeConfig.name,
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

/**
 * Builds complete VM configuration by composing all necessary parts
 */
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
