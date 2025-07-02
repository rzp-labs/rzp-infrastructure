/**
 * Shared type definitions for the infrastructure project
 */

import type * as pulumi from "@pulumi/pulumi";

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
  readonly vmResources: IVmResourceConfig;
}

export interface IEnvironmentConfig {
  readonly name: string;
  readonly proxmox: IProxmoxConfig;
  readonly k3s: IK3sClusterConfig;
}

export type VmRole = "master" | "worker";

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
