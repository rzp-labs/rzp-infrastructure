/**
 * Individual Proxmox VM node component
 */

import * as proxmoxve from "@muhlba91/pulumi-proxmoxve";
import type { ComponentResourceOptions } from "@pulumi/pulumi";
import * as pulumi from "@pulumi/pulumi";
import { ComponentResource } from "@pulumi/pulumi";

import { getSshPublicKey } from "../config/base";
import { getInlineCloudInitConfig } from "../resources/storage/cloud-init";
import { DebianCloudImage } from "../resources/storage/images";
import type { IK3sNodeConfig, IProxmoxConfig } from "../shared/types";

import { buildVmConfiguration } from "./vm/vm-config";

export interface IProxmoxNodeArgs {
  readonly config: IProxmoxConfig;
  readonly nodeConfig: IK3sNodeConfig;
  readonly provider: proxmoxve.Provider;
}

export class ProxmoxNode extends ComponentResource {
  public readonly vm: proxmoxve.vm.VirtualMachine;
  public readonly config: IK3sNodeConfig;
  public readonly cloudImage: DebianCloudImage;
  public readonly metadataFile: proxmoxve.storage.File;
  public readonly userDataFile: proxmoxve.storage.File;

  constructor(name: string, args: IProxmoxNodeArgs, opts?: ComponentResourceOptions) {
    super("custom:proxmox:ProxmoxNode", name, {}, opts);

    this.config = args.nodeConfig;

    // Download fresh Debian cloud image
    this.cloudImage = new DebianCloudImage(`${args.nodeConfig.name}-cloud-image`, args.config, args.provider);

    // Create cloud-init metadata and user data files
    this.metadataFile = this.createMetadataFile(args);
    this.userDataFile = this.createUserDataFile(args);

    // Create VM from fresh cloud image
    this.vm = this.createVirtualMachine(args);
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
      { provider: args.provider, parent: this },
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
      { provider: args.provider, parent: this },
    );
  }

  private createVirtualMachine(args: IProxmoxNodeArgs): proxmoxve.vm.VirtualMachine {
    const vmConfig = buildVmConfiguration({
      nodeConfig: args.nodeConfig,
      config: args.config,
      cloudImage: this.cloudImage,
      metadataFile: this.metadataFile,
      userDataFile: this.userDataFile,
    });

    return new proxmoxve.vm.VirtualMachine(args.nodeConfig.name, vmConfig, { provider: args.provider, parent: this });
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
