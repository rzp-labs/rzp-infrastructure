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

// ArgoCD Configuration Types
export interface IArgoCdBootstrapConfig {
  readonly repositoryUrl: string;
  readonly adminPassword?: pulumi.Output<string>;
  readonly domain?: string;
}

export interface IArgoCdChartValues {
  readonly global: { domain: string };
  readonly server: {
    service: { type: string };
    ingress: { enabled: boolean };
    config: {
      repositories: Record<
        string,
        {
          url: string;
          name: string;
          type: string;
        }
      >;
    };
  };
  readonly configs: { secret: { createSecret: boolean } };
}

// Traefik Configuration Types
export interface ITraefikBootstrapConfig {
  readonly domain?: string;
  readonly email?: string;
  readonly staging?: boolean;
  readonly dashboard?: boolean;
}

export interface ICloudflareConfig {
  apiToken: pulumi.Input<string>;
  zoneId: string;
  domain: string;
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

export interface ICertManagerBootstrapConfig {
  email: string;
  staging: boolean;
  cloudflareApiToken: pulumi.Input<string>;
}

export interface IMetalLBBootstrapConfig {
  ipRange: string;
}

export interface IMetalLBChartValues {
  readonly controller: { enabled: boolean };
  readonly speaker: { enabled: boolean };
  readonly extraResources: unknown[];
}

export interface ITraefikChartValues {
  readonly deployment: { replicas: number };
  readonly service: { type: string };
  readonly ports: unknown;
  readonly ingressRoute: unknown;
  readonly certificatesResolvers: unknown;
  readonly globalArguments: string[];
  readonly additionalArguments: string[];
}
