/**
 * Proxmox provider configuration utilities
 */

import * as pulumi from "@pulumi/pulumi";

interface IProviderAuth {
  readonly username: pulumi.Output<string>;
  readonly password: pulumi.Output<string>;
  readonly ssh: {
    readonly agent: boolean;
    readonly privateKey?: pulumi.Output<string>;
    readonly username: string;
  };
}

interface INodeConfig {
  readonly endpoint: string;
  readonly insecure: boolean;
  readonly node: string;
}

interface IVmStorage {
  readonly isoStore: string;
  readonly vmStore: string;
}

export function getProviderAuth(): IProviderAuth {
  const cfg = new pulumi.Config();

  return {
    username: cfg.requireSecret("proxmoxUsername"),
    password: cfg.requireSecret("proxmoxPassword"),
    ssh: {
      agent: cfg.getBoolean("sshAgent") ?? false,
      privateKey: cfg.getSecret("sshPrivateKey"),
      username: cfg.get("sshUsername") ?? "root",
    },
  };
}

export function getNodeConfig(): INodeConfig {
  const cfg = new pulumi.Config();

  return {
    endpoint: cfg.require("proxmoxEndpoint"),
    insecure: cfg.getBoolean("proxmoxInsecure") ?? false,
    node: cfg.get("proxmoxNode") ?? "rzp-net",
  };
}

export function getVmStorage(): IVmStorage {
  const cfg = new pulumi.Config();

  return {
    isoStore: cfg.get("isoStore") ?? "local",
    vmStore: cfg.get("vmStore") ?? "local-zfs",
  };
}
