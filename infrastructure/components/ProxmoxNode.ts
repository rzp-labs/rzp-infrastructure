/**
 * Individual Proxmox VM node component
 */

import * as proxmoxve from "@muhlba91/pulumi-proxmoxve";
import * as pulumi from "@pulumi/pulumi";
import type { ComponentResourceOptions } from "@pulumi/pulumi";
import { ComponentResource } from "@pulumi/pulumi";
import type { IK3sNodeConfig, IProxmoxConfig } from "../shared/types";
import { VM_DEFAULTS } from "../shared/constants";
import { getSshPublicKey } from "../config/base";
import { getInlineCloudInitConfig } from "../resources/storage/cloud-init";

export interface IProxmoxNodeArgs {
  readonly config: IProxmoxConfig;
  readonly nodeConfig: IK3sNodeConfig;
  readonly templateVmId: number; // Template to clone from
  readonly provider: proxmoxve.Provider;
}

export class ProxmoxNode extends ComponentResource {
  public readonly vm: proxmoxve.vm.VirtualMachine;
  public readonly config: IK3sNodeConfig;
  public readonly cloudInitFile: proxmoxve.storage.File;

  constructor(name: string, args: IProxmoxNodeArgs, opts?: ComponentResourceOptions) {
    super("custom:proxmox:ProxmoxNode", name, {}, opts);

    this.config = args.nodeConfig;

    // Create cloud-init vendor data file with full configuration
    this.cloudInitFile = this.createCloudInitFile(args);

    // Create VM with hybrid cloud-init approach
    this.vm = this.createVirtualMachine(args);
  }

  private createCloudInitFile(args: IProxmoxNodeArgs): proxmoxve.storage.File {
    // Use pulumi.secret to preserve SSH key secrecy
    const cloudInitData = getSshPublicKey().apply((key) => getInlineCloudInitConfig(key));

    return new proxmoxve.storage.File(
      `${args.nodeConfig.name}-cloud-init`,
      {
        nodeName: args.config.node,
        datastoreId: args.config.isoStore,
        contentType: "snippets",
        sourceRaw: {
          fileName: `cloud-init-${args.nodeConfig.vmId}.yaml`,
          data: pulumi.secret(cloudInitData), // Keep the entire cloud-init config as secret
        },
      },
      { provider: args.provider, parent: this },
    );
  }

  private createVirtualMachine(args: IProxmoxNodeArgs): proxmoxve.vm.VirtualMachine {
    return new proxmoxve.vm.VirtualMachine(
      args.nodeConfig.name,
      {
        name: args.nodeConfig.name, // Explicit VM name to override Pulumi auto-generation
        nodeName: args.config.node,
        vmId: args.nodeConfig.vmId,

        // Clone from template instead of building from scratch
        clone: {
          nodeName: args.config.node,
          vmId: args.templateVmId,
          full: true, // Full clone (not linked clone)
        },

        started: true,
        onBoot: true,
        tags: ["stg", "k3s", args.nodeConfig.role],
        description: `K3s ${this.capitalize(args.nodeConfig.role)} Node ${args.nodeConfig.roleIndex + 1}`,

        // VM hardware configuration
        ...this.getHardwareConfig(args),

        // Storage configuration
        disks: this.getDiskConfig(args),

        networkDevices: [{ bridge: args.config.bridge, model: VM_DEFAULTS.NETWORK_MODEL }],

        // Cloud-init hybrid approach: inline for network/user, file for system config
        initialization: this.getCloudInitConfig(args),
      },
      { provider: args.provider, parent: this },
    );
  }

  private getHardwareConfig(args: IProxmoxNodeArgs) {
    return {
      machine: VM_DEFAULTS.MACHINE,
      bios: VM_DEFAULTS.BIOS,
      scsiHardware: VM_DEFAULTS.SCSI_HARDWARE,
      tabletDevice: false,
      bootOrders: [...VM_DEFAULTS.BOOT_ORDERS], // Create mutable copy for type compatibility
      startup: {
        order: args.nodeConfig.role === "master" ? 1 : 2,
        upDelay: args.nodeConfig.role === "master" ? 30 : 10,
      },
      operatingSystem: { type: VM_DEFAULTS.OS_TYPE },
      agent: { enabled: true, trim: true, type: "virtio", timeout: "15m" },
      cpu: { type: "host", cores: args.nodeConfig.resources.cores },
      memory: { dedicated: args.nodeConfig.resources.memory },
    };
  }

  private getDiskConfig(args: IProxmoxNodeArgs) {
    return [
      {
        datastoreId: args.config.vmStore,
        interface: "scsi0",
        size: args.nodeConfig.resources.osDiskSize, // Resize from template
        ssd: true,
        cache: VM_DEFAULTS.DISK_CACHE,
        discard: VM_DEFAULTS.DISK_DISCARD,
        aio: VM_DEFAULTS.DISK_AIO,
      },
      {
        // Add additional data disk
        datastoreId: args.config.vmStore,
        interface: "scsi1",
        size: args.nodeConfig.resources.dataDiskSize,
        ssd: true,
        cache: VM_DEFAULTS.DISK_CACHE,
        discard: VM_DEFAULTS.DISK_DISCARD,
      },
    ];
  }

  private getCloudInitConfig(args: IProxmoxNodeArgs) {
    return {
      type: "nocloud",
      datastoreId: args.config.vmStore,
      dns: {
        servers: ["1.1.1.1"],
        domain: "local",
      },
      ipConfigs: [
        {
          ipv4: {
            address: `${args.nodeConfig.ip4}/24`,
            gateway: args.config.bridge === "vmbr0" ? "10.10.0.1" : undefined,
          },
          ipv6: {
            address: `${args.nodeConfig.ip6}/64`,
            gateway: args.config.bridge === "vmbr0" ? "fd00:10:10::1" : undefined,
          },
        },
      ],
      userAccount: {
        username: "admin_ops",
        keys: [getSshPublicKey()], // This remains a secret Output
      },
      // Reference the cloud-init file for advanced system configuration
      vendorDataFileId: this.cloudInitFile.id,
    };
  }

  private capitalize(str: string): string {
    return str.charAt(0).toUpperCase() + str.slice(1);
  }

  get vmId(): number {
    return this.config.vmId;
  }

  get role(): "master" | "worker" {
    return this.config.role;
  }

  get ip4(): string {
    return this.config.ip4;
  }

  get ip6(): string {
    return this.config.ip6;
  }
}
