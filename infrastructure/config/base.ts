/**
 * Base configuration shared across all environments
 */

import * as pulumi from "@pulumi/pulumi";
import type { INetworkConfig, IProxmoxConfig, IVmResourceConfig } from "../shared/types";
import { DEFAULT_VM_RESOURCES } from "../shared/constants";

export function getProxmoxConfig(): IProxmoxConfig {
  const cfg = new pulumi.Config();

  return {
    endpoint: cfg.require("proxmoxEndpoint"),
    username: cfg.requireSecret("proxmoxUsername"),
    password: cfg.requireSecret("proxmoxPassword"),
    insecure: cfg.getBoolean("proxmoxInsecure") ?? false,
    node: cfg.get("proxmoxNode") ?? "rzp-net",
    isoStore: cfg.get("isoStore") ?? "local",
    vmStore: cfg.get("vmStore") ?? "local-zfs",
    bridge: cfg.get("bridge") ?? "vmbr0",
    ssh: {
      agent: cfg.getBoolean("sshAgent") ?? false,
      privateKey: cfg.getSecret("sshPrivateKey"),
      username: cfg.get("sshUsername") ?? "root",
    },
  };
}

export function getNetworkConfig(): INetworkConfig {
  const cfg = new pulumi.Config();

  return {
    net4Prefix: cfg.get("net4Prefix") ?? "10.10.0.",
    net6Prefix: cfg.get("net6Prefix") ?? "fd00:10:10::",
    gateway4: cfg.get("gateway4") ?? "10.10.0.1",
    gateway6: cfg.get("gateway6") ?? "fd00:10:10::1",
    ipHostBase: cfg.getNumber("ipHostBase") ?? 20,
  };
}

export function getVmResourceConfig(): IVmResourceConfig {
  const cfg = new pulumi.Config();

  return {
    cores: cfg.getNumber("vmCores") ?? DEFAULT_VM_RESOURCES.CORES,
    memory: cfg.getNumber("vmMemory") ?? DEFAULT_VM_RESOURCES.MEMORY,
    osDiskSize: cfg.getNumber("vmOsDiskSize") ?? DEFAULT_VM_RESOURCES.OS_DISK_SIZE,
    dataDiskSize: cfg.getNumber("vmDataDiskSize") ?? DEFAULT_VM_RESOURCES.DATA_DISK_SIZE,
  };
}

export function getSshPublicKey(): pulumi.Output<string> {
  const cfg = new pulumi.Config();
  return cfg.requireSecret("sshPublicKey");
}
