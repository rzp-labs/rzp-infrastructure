/**
 * Shared type definitions for the infrastructure project
 */

import type * as proxmoxve from "@muhlba91/pulumi-proxmoxve";
import type * as k8s from "@pulumi/kubernetes";
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

/**
 * Ingress access type for components
 * - external: Accessible from public internet
 * - internal: Accessible only from internal network
 * - none: No ingress/web interface
 */
export type IngressType = "external" | "internal" | "none";

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

export interface ICertManagerSecretProps {
  readonly config: ICertManagerBootstrapConfig;
  readonly namespace: k8s.core.v1.Namespace;
}

export interface ICertManagerClusterIssuerProps {
  readonly config: ICertManagerBootstrapConfig;
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

// ArgoCD Configuration Types
export interface IArgoCdBootstrapConfig {
  readonly repositoryUrl: string;
  readonly domain?: string;
  readonly createIngress?: boolean; // NEW: Optional ingress creation
}

export interface IArgoCdChartValues {
  readonly installCRDs: boolean;
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
    extraArgs?: string[]; // Add support for extra server arguments
  };
  readonly configs: {
    secret: { createSecret: boolean };
    params?: Record<string, string>; // Add support for server params
  };
  readonly dex: { enabled: boolean };
}

// ArgoCD Application Source Configuration
export interface IArgoCdApplicationSource {
  readonly repoUrl: string;
  readonly chart?: string;
  readonly targetRevision: string;
  readonly path?: string;
  readonly helm?: {
    readonly values?: string; // YAML string
    readonly valuesObject?: Record<string, unknown>; // Typed object
    readonly valueFiles?: string[];
  };
}

// ArgoCD Application Sync Policy
export interface IArgoCdSyncPolicy {
  readonly automated?: {
    readonly prune?: boolean;
    readonly selfHeal?: boolean;
  };
  readonly syncOptions?: string[];
}

// ArgoCD Application Destination
export interface IArgoCdApplicationDestination {
  readonly server: string;
  readonly namespace: string;
}

// ArgoCD Application Spec
export interface IArgoCdApplicationSpec {
  readonly project: string;
  readonly sources: IArgoCdApplicationSource[];
  readonly destination: IArgoCdApplicationDestination;
  readonly syncPolicy?: IArgoCdSyncPolicy;
}

export interface ICloudflareConfig {
  apiToken: pulumi.Input<string>;
  zoneId: string;
  domain: string;
  email: string;
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
  environment: "dev" | "stg" | "prd";
  cloudflareApiToken: pulumi.Input<string>;
}

export interface ICertManagerChartValues {
  readonly installCRDs: boolean;
  readonly global: {
    readonly rbac: {
      readonly create: boolean;
    };
  };
}

export interface IMetalLBBootstrapConfig {
  ipRange: string;
}

export interface IMetalLBChartValues {
  readonly controller: { enabled: boolean };
  readonly speaker: { enabled: boolean };
  readonly webhook: { enabled: boolean };
  readonly extraResources: unknown[];
}

// Traefik Configuration Types
export interface ITraefikBootstrapConfig {
  readonly domain?: string;
  readonly email?: string;
  readonly environment: "dev" | "stg" | "prd";
  readonly dashboard?: boolean;
}

export interface ITraefikChartValues {
  readonly deployment: { replicas: number };
  readonly service: { type: string };
  readonly ports: {
    readonly web: {
      readonly port: number;
      readonly expose: { readonly default: boolean };
      readonly protocol: string;
    };
    readonly websecure: {
      readonly port: number;
      readonly expose: { readonly default: boolean };
      readonly exposedPort: number;
      readonly protocol: string;
    };
  };
  readonly ingressRoute: {
    readonly dashboard: {
      readonly enabled: boolean;
      readonly annotations: Record<string, string>;
    };
  };
  readonly certificatesResolvers: Record<string, never>;
  readonly globalArguments: string[];
  readonly additionalArguments: string[];
  readonly providers: {
    readonly kubernetesIngress: {
      readonly enabled: boolean;
      readonly publishedService: {
        readonly enabled: boolean;
        readonly pathOverride: string;
      };
    };
  };
}
