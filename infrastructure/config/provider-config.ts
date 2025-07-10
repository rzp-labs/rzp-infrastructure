/**
 * Proxmox provider configuration utilities
 */

import * as pulumi from "@pulumi/pulumi";

import type { INodeConfig, IProviderAuth, IVmStorage } from "../shared/types";

export function getProviderAuth(): IProviderAuth {
  const cfg = new pulumi.Config();

  return {
    username: cfg.requireSecret("proxmoxUsername"),
    password: cfg.requireSecret("proxmoxPassword"),
    ssh: {
      agent: cfg.requireBoolean("sshAgent"),
      privateKey: cfg.getSecret("sshPrivateKey"),
      username: cfg.require("sshUsername"),
    },
  };
}

export function getNodeConfig(): INodeConfig {
  const cfg = new pulumi.Config();

  return {
    endpoint: cfg.require("proxmoxEndpoint"),
    insecure: cfg.requireBoolean("proxmoxInsecure"),
    node: cfg.require("proxmoxNode"),
  };
}

export function getVmStorage(): IVmStorage {
  const cfg = new pulumi.Config();

  return {
    isoStore: cfg.require("isoStore"),
    vmStore: cfg.require("vmStore"),
  };
}
