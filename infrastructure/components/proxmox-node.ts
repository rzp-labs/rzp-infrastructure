/**
 * Individual Proxmox VM node component
 */

import * as proxmoxve from "@muhlba91/pulumi-proxmoxve";
import type { ComponentResourceOptions } from "@pulumi/pulumi";
import * as pulumi from "@pulumi/pulumi";

import { getSshPublicKey } from "../config/base";
import { getInlineCloudInitConfig } from "../resources/storage/cloud-init";
import { DebianCloudImage } from "../resources/storage/images";
import type { IK3sNodeConfig, IProxmoxNodeArgs } from "../shared/types";

import { VmConfiguration } from "./vm/vm-configuration";

export class ProxmoxNode extends pulumi.ComponentResource {
  public readonly vmConfiguration!: VmConfiguration;
  public readonly vm!: proxmoxve.vm.VirtualMachine;
  public readonly config: IK3sNodeConfig;
  public readonly cloudImage: DebianCloudImage;
  private metadataFile!: proxmoxve.storage.File;
  private userDataFile!: proxmoxve.storage.File;

  constructor(name: string, args: IProxmoxNodeArgs, opts?: ComponentResourceOptions) {
    super("rzp-infra:proxmox:ProxmoxNode", name, {}, opts);

    this.config = args.nodeConfig;
    this.cloudImage = new DebianCloudImage(`${args.nodeConfig.name}-cloud-image`, args.config, args.provider);

    // Create cloud-init files and VM configuration
    this.createCloudInitFiles(args);
    this.createVmConfiguration(name, args);

    this.registerOutputs({
      vm: this.vm,
      config: this.config,
      cloudImage: this.cloudImage,
    });
  }

  private createCloudInitFiles(args: IProxmoxNodeArgs): void {
    this.metadataFile = this.createMetadataFile(args);
    this.userDataFile = this.createUserDataFile(args);
  }

  private createVmConfiguration(name: string, args: IProxmoxNodeArgs): void {
    const vmConfiguration = new VmConfiguration(
      name,
      {
        nodeConfig: args.nodeConfig,
        config: args.config,
        cloudImage: this.cloudImage,
        metadataFile: this.metadataFile,
        userDataFile: this.userDataFile,
        provider: args.provider,
      },
      { parent: this },
    );

    // Use Object.defineProperty to assign to readonly properties
    Object.defineProperty(this, "vmConfiguration", { value: vmConfiguration, writable: false });
    Object.defineProperty(this, "vm", { value: vmConfiguration.vm, writable: false });
  }

  private createMetadataFile(args: IProxmoxNodeArgs): proxmoxve.storage.File {
    const metadataContent = `#cloud-config
local-hostname: ${args.nodeConfig.name}`;

    return new proxmoxve.storage.File(
      `${args.nodeConfig.name}-metadata`,
      {
        nodeName: args.config.node,
        datastoreId: args.config.isoStore,
        contentType: "snippets",
        sourceRaw: {
          fileName: `metadata-${args.nodeConfig.vmId}.yaml`,
          data: metadataContent,
        },
      },
      this.getStorageFileOptions(args.provider),
    );
  }

  private createUserDataFile(args: IProxmoxNodeArgs): proxmoxve.storage.File {
    // Use pulumi.secret to preserve SSH key secrecy
    const userDataContent = getSshPublicKey().apply((key) => getInlineCloudInitConfig(key));

    return new proxmoxve.storage.File(
      `${args.nodeConfig.name}-userdata`,
      {
        nodeName: args.config.node,
        datastoreId: args.config.isoStore,
        contentType: "snippets",
        sourceRaw: {
          fileName: `userdata-${args.nodeConfig.vmId}.yaml`,
          data: pulumi.secret(userDataContent),
        },
      },
      this.getStorageFileOptions(args.provider),
    );
  }

  private getStorageFileOptions(provider: proxmoxve.Provider): ComponentResourceOptions {
    return {
      provider,
      parent: this,
    };
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
