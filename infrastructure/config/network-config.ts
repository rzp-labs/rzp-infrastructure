/**
 * Network configuration utilities
 */

import * as pulumi from "@pulumi/pulumi";

interface INetworkBase {
  readonly bridge: string;
  readonly ipHostBase: number;
}

interface IIpv4Config {
  readonly net4Prefix: string;
  readonly gateway4: string;
}

interface IIpv6Config {
  readonly net6Prefix: string;
  readonly gateway6: string;
}

export function getNetworkBase(): INetworkBase {
  const cfg = new pulumi.Config();

  return {
    bridge: cfg.get("bridge") ?? "vmbr0",
    ipHostBase: cfg.getNumber("ipHostBase") ?? 20,
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
