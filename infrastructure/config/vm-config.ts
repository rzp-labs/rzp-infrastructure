/**
 * VM configuration utilities
 *
 * Centralized VM configuration including Proxmox provider settings,
 * network configuration, and hardware specifications.
 */

import * as pulumi from "@pulumi/pulumi";

import { DEFAULT_VM_RESOURCES } from "../shared/constants";
import type {
  IIpv4Config,
  IIpv6Config,
  INetworkBase,
  INetworkConfig,
  IProxmoxConfig,
  IVmResourceConfig,
} from "../shared/types";

import { getNodeConfig, getProviderAuth, getVmStorage } from "./provider-config";

// =============================================================================
// NETWORK CONFIGURATION
// =============================================================================

export function getNetworkBase(): INetworkBase {
  const cfg = new pulumi.Config();

  return {
    bridge: cfg.get("bridge") ?? "vmbr0",
    ipHostBase: cfg.getNumber("ipHostBase") ?? 0,
  };
}

export function getIpv4Config(): IIpv4Config {
  const cfg = new pulumi.Config();

  return {
    net4Prefix: cfg.get("net4Prefix") ?? "10.10.0.",
    gateway4: cfg.get("gateway4") ?? "10.10.0.1",
  };
}

export function getIpv6Config(): IIpv6Config {
  const cfg = new pulumi.Config();

  return {
    net6Prefix: cfg.get("net6Prefix") ?? "fd00:10:10::",
    gateway6: cfg.get("gateway6") ?? "fd00:10:10::1",
  };
}

// =============================================================================
// VM HARDWARE CONFIGURATION
// =============================================================================

export function getVmResourceConfig(): IVmResourceConfig {
  const cfg = new pulumi.Config();

  return {
    cores: cfg.getNumber("vmCores") ?? DEFAULT_VM_RESOURCES.CORES,
    memory: cfg.getNumber("vmMemory") ?? DEFAULT_VM_RESOURCES.MEMORY,
    osDiskSize: cfg.getNumber("vmOsDiskSize") ?? DEFAULT_VM_RESOURCES.OS_DISK_SIZE,
    dataDiskSize: cfg.getNumber("vmDataDiskSize") ?? DEFAULT_VM_RESOURCES.DATA_DISK_SIZE,
  };
}

// =============================================================================
// AGGREGATED CONFIGURATION
// =============================================================================

export function getProxmoxConfig(): IProxmoxConfig {
  const auth = getProviderAuth();
  const nodeConfig = getNodeConfig();
  const storage = getVmStorage();
  const network = getNetworkBase();

  return {
    ...nodeConfig,
    ...auth,
    ...storage,
    bridge: network.bridge,
  };
}

export function getNetworkConfig(): INetworkConfig {
  const ipv4 = getIpv4Config();
  const ipv6 = getIpv6Config();
  const network = getNetworkBase();

  return {
    ...ipv4,
    ...ipv6,
    ipHostBase: network.ipHostBase,
  };
}

// =============================================================================
// SSH CONFIGURATION
// =============================================================================

export function getSshPublicKey(): pulumi.Output<string> {
  const cfg = new pulumi.Config();
  return cfg.requireSecret("sshPublicKey");
}
