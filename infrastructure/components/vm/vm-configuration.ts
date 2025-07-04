import * as proxmoxve from "@muhlba91/pulumi-proxmoxve";
import * as pulumi from "@pulumi/pulumi";

import type { DebianCloudImage } from "../../resources/storage/images";
import { VM_DEFAULTS } from "../../shared/constants";
import { applyVmTransformations } from "../../shared/transformations";
import type { IK3sNodeConfig, IProxmoxConfig } from "../../shared/types";
import { capitalize } from "../../shared/utils";

import { getVmCloudInitConfig } from "./vm-cloud-init";
import { getVmHardwareConfig } from "./vm-hardware";
import { getVmDiskConfig } from "./vm-storage";

interface IVmConfigurationProps {
  nodeConfig: IK3sNodeConfig;
  config: IProxmoxConfig;
  cloudImage: DebianCloudImage;
  metadataFile: proxmoxve.storage.File;
  userDataFile: proxmoxve.storage.File;
  provider: proxmoxve.Provider;
}

/**
 * VM Configuration Component
 *
 * Native Pulumi ComponentResource that creates a complete VM configuration.
 * Replaces the buildVmConfiguration builder pattern with proper component architecture.
 */
export class VmConfiguration extends pulumi.ComponentResource {
  public readonly vm: proxmoxve.vm.VirtualMachine;
  public readonly nodeConfig: IK3sNodeConfig;

  constructor(name: string, props: IVmConfigurationProps, opts?: pulumi.ComponentResourceOptions) {
    super("rzp:vm:Configuration", name, {}, opts);

    this.nodeConfig = props.nodeConfig;
    this.vm = this.createVirtualMachine(name, props);

    this.registerOutputs({
      vm: this.vm,
      nodeConfig: this.nodeConfig,
    });
  }

  private createVirtualMachine(name: string, props: IVmConfigurationProps): proxmoxve.vm.VirtualMachine {
    const vmConfig = this.buildVmConfiguration(props);

    return new proxmoxve.vm.VirtualMachine(name, vmConfig, {
      provider: props.provider,
      parent: this,
      transformations: [applyVmTransformations],
      // Remove customTimeouts - not supported by proxmoxve VMs
    });
  }

  private buildVmConfiguration(props: IVmConfigurationProps) {
    return {
      // Identity configuration
      ...this.getVmIdentity(props.nodeConfig, props.config),

      // State configuration
      ...this.getVmState(),

      // Tags configuration
      ...this.getVmTags(props.nodeConfig),

      // Hardware configuration
      ...getVmHardwareConfig(props.nodeConfig),

      // Storage configuration
      disks: getVmDiskConfig(props.nodeConfig, props.config, props.cloudImage),

      // Network configuration
      networkDevices: this.getNetworkDevices(props.config),

      // Cloud-init configuration
      initialization: getVmCloudInitConfig({
        nodeConfig: props.nodeConfig,
        config: props.config,
        metadataFile: props.metadataFile,
        userDataFile: props.userDataFile,
      }),
    };
  }

  private getVmIdentity(nodeConfig: IK3sNodeConfig, config: IProxmoxConfig) {
    return {
      name: nodeConfig.name,
      nodeName: config.node,
      vmId: nodeConfig.vmId,
      description: `K3s ${capitalize(nodeConfig.role)} Node ${nodeConfig.roleIndex + 1}`,
    };
  }

  private getVmState() {
    return {
      template: false,
      started: true,
      onBoot: true,
    };
  }

  private getVmTags(nodeConfig: IK3sNodeConfig) {
    return {
      tags: ["stg", "k3s", nodeConfig.role],
    };
  }

  private getNetworkDevices(config: IProxmoxConfig) {
    return [{ bridge: config.bridge, model: VM_DEFAULTS.NETWORK_MODEL }];
  }

  get vmId(): number {
    return this.nodeConfig.vmId;
  }
}
