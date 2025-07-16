/**
 * Shared type definitions for the infrastructure project
 */

import type * as proxmoxve from "@muhlba91/pulumi-proxmoxve";
import type * as pulumi from "@pulumi/pulumi";

import type { DebianCloudImage } from "../resources/storage/images";

export interface IProxmoxConfig {
  readonly endpoint: string;
  readonly username: pulumi.Output<string>;
  readonly password: pulumi.Output<string>;
  readonly insecure: boolean;
  readonly node: string;
  readonly isoStore: string;
  readonly vmStore: string;
  readonly bridge: string;
  readonly ssh?: {
    readonly agent?: boolean;
    readonly privateKey?: pulumi.Output<string>;
    readonly username?: string;
  };
}

export interface INetworkConfig {
  readonly net4Prefix: string;
  readonly net6Prefix: string;
  readonly gateway4: string;
  readonly gateway6: string;
  readonly ipHostBase: number;
}

export interface IVmResourceConfig {
  readonly cores: number;
  readonly memory: number;
  readonly osDiskSize: number;
  readonly dataDiskSize: number;
}

export interface IK3sNodeConfig {
  readonly vmId: number;
  readonly role: "master" | "worker";
  readonly roleIndex: number;
  readonly name: string;
  readonly ip4: string;
  readonly ip6: string;
  readonly resources: IVmResourceConfig;
}

export interface IK3sClusterConfig {
  readonly masterCount: number;
  readonly workerCount: number;
  readonly vmidBase: number;
  readonly masterVmidStart: number;
  readonly workerVmidStart: number;
  readonly network: INetworkConfig;
  readonly masterVmResources: IVmResourceConfig;
  readonly workerVmResources: IVmResourceConfig;
}

// Configuration interfaces moved from /config files for consistency

export interface IProviderAuth {
  readonly username: pulumi.Output<string>;
  readonly password: pulumi.Output<string>;
  readonly ssh: {
    readonly agent: boolean;
    readonly privateKey?: pulumi.Output<string>;
    readonly username: string;
  };
}

export interface INodeConfig {
  readonly endpoint: string;
  readonly insecure: boolean;
  readonly node: string;
}

export interface IVmStorage {
  readonly isoStore: string;
  readonly vmStore: string;
}

export interface IProxmoxNodeArgs {
  readonly config: IProxmoxConfig;
  readonly nodeConfig: IK3sNodeConfig;
  readonly provider: proxmoxve.Provider;
  readonly cloudImage: DebianCloudImage;
}

export interface IVmCloudInitArgs {
  readonly nodeConfig: IK3sNodeConfig;
  readonly config: IProxmoxConfig;
  readonly metadataFile: proxmoxve.storage.File;
  readonly userDataFile: proxmoxve.storage.File;
}

export interface IVmConfigurationProps {
  readonly nodeConfig: IK3sNodeConfig;
  readonly config: IProxmoxConfig;
  readonly cloudImage: DebianCloudImage;
  readonly metadataFile: proxmoxve.storage.File;
  readonly userDataFile: proxmoxve.storage.File;
  readonly provider: proxmoxve.Provider;
}

export interface INetworkBase {
  readonly bridge: string;
  readonly ipHostBase: number;
}

export interface IIpv4Config {
  readonly net4Prefix: string;
  readonly gateway4: string;
}

export interface IIpv6Config {
  readonly net6Prefix: string;
  readonly gateway6: string;
}

export interface IEnvironmentConfig {
  readonly name: string;
  readonly proxmox: IProxmoxConfig;
  readonly k3s: IK3sClusterConfig;
}

export interface INodeInfo {
  readonly name: string;
  readonly vmId: number;
  readonly ip: string;
  readonly ipv6: string;
  readonly cores: number;
  readonly memory: number;
  readonly osDisk: number;
  readonly dataDisk: number;
}

export interface IClusterOutput {
  readonly masters: readonly INodeInfo[];
  readonly workers: readonly INodeInfo[];
}

export interface ICloudflareDNSConfig {
  zoneId: string;
  environment: string;
  loadBalancerIP?: string;
  services: Array<{
    name: string;
    subdomain?: string;
  }>;
}

/**
 * Shared environment type used across all components
 */
export type Environment = "dev" | "stg" | "prd";
