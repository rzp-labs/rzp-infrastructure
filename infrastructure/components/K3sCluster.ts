/**
 * Complete K3s cluster component
 */

import * as proxmoxve from "@muhlba91/pulumi-proxmoxve";
import type { ComponentResourceOptions } from "@pulumi/pulumi";
import { ComponentResource } from "@pulumi/pulumi";
import type { IClusterOutput, IEnvironmentConfig, IK3sNodeConfig, INodeInfo } from "../shared/types";
import { calculateNetworkIndex, generateIpv4, generateIpv6, generateVmName } from "../shared/utils";
import { ProxmoxNode } from "./ProxmoxNode";

export interface IK3sClusterArgs {
  readonly config: IEnvironmentConfig;
}

export class K3sCluster extends ComponentResource {
  public readonly provider: proxmoxve.Provider;
  public readonly masters: readonly ProxmoxNode[];
  public readonly workers: readonly ProxmoxNode[];

  constructor(name: string, args: IK3sClusterArgs, opts?: ComponentResourceOptions) {
    super("custom:k3s:K3sCluster", name, {}, opts);

    const { config } = args;

    this.provider = this.createProvider(name, config);
    this.masters = this.createMasterNodes(config);
    this.workers = this.createWorkerNodes(config);
  }

  private createProvider(name: string, config: IEnvironmentConfig): proxmoxve.Provider {
    return new proxmoxve.Provider(
      `${name}-provider`,
      {
        endpoint: config.proxmox.endpoint,
        username: config.proxmox.username,
        password: config.proxmox.password,
        insecure: config.proxmox.insecure,
        ssh: config.proxmox.ssh
          ? {
              agent: config.proxmox.ssh.agent,
              privateKey: config.proxmox.ssh.privateKey,
              username: config.proxmox.ssh.username,
            }
          : undefined,
      },
      { parent: this },
    );
  }

  private createMasterNodes(config: IEnvironmentConfig): ProxmoxNode[] {
    return this.createNodes("master", config.k3s.masterCount, config);
  }

  private createWorkerNodes(config: IEnvironmentConfig): ProxmoxNode[] {
    return this.createNodes("worker", config.k3s.workerCount, config);
  }

  private createNodes(role: "master" | "worker", count: number, config: IEnvironmentConfig): ProxmoxNode[] {
    return Array.from({ length: count }, (_, i) => {
      const nodeConfig = this.createNodeConfig(role, i, config);
      return new ProxmoxNode(
        nodeConfig.name,
        {
          config: config.proxmox,
          nodeConfig,
          provider: this.provider,
        },
        { parent: this },
      );
    });
  }

  private createNodeConfig(role: "master" | "worker", roleIndex: number, config: IEnvironmentConfig): IK3sNodeConfig {
    const vmId = role === "master" ? config.k3s.masterVmidStart + roleIndex : config.k3s.workerVmidStart + roleIndex;

    const name = generateVmName(role, roleIndex);
    const networkIndex = calculateNetworkIndex(role, roleIndex, config.k3s.masterCount);

    const ip4 = generateIpv4(config.k3s.network.net4Prefix, config.k3s.network.ipHostBase, networkIndex);
    const ip6 = generateIpv6(config.k3s.network.net6Prefix, config.k3s.network.ipHostBase, networkIndex);

    return {
      vmId,
      role,
      roleIndex,
      name,
      ip4,
      ip6,
      resources: config.k3s.vmResources,
    };
  }

  /**
   * Get master IP addresses as a record
   */
  get masterIps(): Record<string, string> {
    return this.masters.reduce(
      (acc, master) => {
        acc[master.config.name] = master.ip4;
        return acc;
      },
      {} as Record<string, string>,
    );
  }

  /**
   * Get worker IP addresses as a record
   */
  get workerIps(): Record<string, string> {
    return this.workers.reduce(
      (acc, worker) => {
        acc[worker.config.name] = worker.ip4;
        return acc;
      },
      {} as Record<string, string>,
    );
  }

  /**
   * Get all nodes information
   */
  get allNodes(): IClusterOutput {
    const mapNodeToInfo = (node: ProxmoxNode): INodeInfo => ({
      name: node.config.name,
      vmId: node.config.vmId,
      ip: node.ip4,
      ipv6: node.ip6,
      cores: node.config.resources.cores,
      memory: node.config.resources.memory,
      osDisk: node.config.resources.osDiskSize,
      dataDisk: node.config.resources.dataDiskSize,
    });

    return {
      masters: this.masters.map(mapNodeToInfo),
      workers: this.workers.map(mapNodeToInfo),
    };
  }
}
