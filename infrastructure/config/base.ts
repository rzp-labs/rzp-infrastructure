/**
 * Base configuration shared across all environments
 */

import * as pulumi from "@pulumi/pulumi";
import type { INetworkConfig, IProxmoxConfig, IVmResourceConfig } from "../shared/types";

import { getNodeConfig, getProviderAuth, getVmStorage } from "./provider-config";
import { getIpv4Config, getIpv6Config, getNetworkBase } from "./network-config";
import { getVmDiskSizes, getVmHardware } from "./vm-resources";

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

export function getVmResourceConfig(): IVmResourceConfig {
  const hardware = getVmHardware();
  const diskSizes = getVmDiskSizes();

  return {
    ...hardware,
    ...diskSizes,
  };
}

export function getSshPublicKey(): pulumi.Output<string> {
  const cfg = new pulumi.Config();
  return cfg.requireSecret("sshPublicKey");
}
