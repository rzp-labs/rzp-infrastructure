import type * as proxmoxve from "@muhlba91/pulumi-proxmoxve";
import * as pulumi from "@pulumi/pulumi";

import { type IProxmoxNodeArgs, ProxmoxNode } from "../../../components/proxmox-node";
import type { IK3sNodeConfig, IProxmoxConfig } from "../../../shared/types";
import { PulumiTestSetup } from "../../helpers/k3s/pulumi-test-setup";
// import { MockVmFactory } from "../../helpers/proxmox/mock-vm-factory"; // TODO: Use when implementing ProxmoxNode tests

/**
 * Single Responsibility: Test ProxmoxNode component only
 */
describe("ProxmoxNode Component", () => {
  let pulumiSetup: PulumiTestSetup;

  beforeAll(() => {
    pulumiSetup = new PulumiTestSetup();
    pulumiSetup.initialize();
  });

  test("should create Proxmox VM with correct configuration", async () => {
    // Arrange
    const mockProxmoxConfig: IProxmoxConfig = {
      endpoint: "https://test-proxmox:8006/api2/json",
      username: pulumi.output("test-user"),
      password: pulumi.output("test-pass"),
      insecure: true,
      node: "test-node",
      isoStore: "local",
      vmStore: "local-lvm",
      bridge: "vmbr0",
    };

    const mockNodeConfig: IK3sNodeConfig = {
      vmId: 100,
      role: "master",
      roleIndex: 0,
      name: "test-node",
      ip4: "10.10.0.20",
      ip6: "fd00:10:10::20",
      resources: {
        cores: 2,
        memory: 2048,
        osDiskSize: 20,
        dataDiskSize: 60,
      },
    };

    const mockProvider = {
      getPackage: () => ({ name: "proxmoxve", version: "1.0.0" }),
    } as unknown as proxmoxve.Provider;

    const nodeArgs: IProxmoxNodeArgs = {
      config: mockProxmoxConfig,
      nodeConfig: mockNodeConfig,
      provider: mockProvider,
    };

    // Act
    const proxmoxNode = new ProxmoxNode("test-proxmox-node", nodeArgs);

    // Assert
    expect(proxmoxNode).toBeInstanceOf(ProxmoxNode);
    expect(proxmoxNode.vmId).toBe(100);
  });

  test("should handle different VM resource configurations", async () => {
    // Arrange
    const mockProxmoxConfig: IProxmoxConfig = {
      endpoint: "https://test-proxmox:8006/api2/json",
      username: pulumi.output("test-user"),
      password: pulumi.output("test-pass"),
      insecure: true,
      node: "test-node",
      isoStore: "local",
      vmStore: "local-lvm",
      bridge: "vmbr0",
    };

    const highResourceNodeConfig: IK3sNodeConfig = {
      vmId: 101,
      role: "worker",
      roleIndex: 0,
      name: "high-resource-node",
      ip4: "10.10.0.21",
      ip6: "fd00:10:10::21",
      resources: {
        cores: 8,
        memory: 16384,
        osDiskSize: 40,
        dataDiskSize: 200,
      },
    };

    const lowResourceNodeConfig: IK3sNodeConfig = {
      vmId: 102,
      role: "worker",
      roleIndex: 1,
      name: "low-resource-node",
      ip4: "10.10.0.22",
      ip6: "fd00:10:10::22",
      resources: {
        cores: 1,
        memory: 1024,
        osDiskSize: 10,
        dataDiskSize: 20,
      },
    };

    const mockProvider = {
      getPackage: () => ({ name: "proxmoxve", version: "1.0.0" }),
    } as unknown as proxmoxve.Provider;

    const highResourceArgs: IProxmoxNodeArgs = {
      config: mockProxmoxConfig,
      nodeConfig: highResourceNodeConfig,
      provider: mockProvider,
    };

    const lowResourceArgs: IProxmoxNodeArgs = {
      config: mockProxmoxConfig,
      nodeConfig: lowResourceNodeConfig,
      provider: mockProvider,
    };

    // Act
    const highResourceProxmoxNode = new ProxmoxNode("high-resource-node", highResourceArgs);
    const lowResourceProxmoxNode = new ProxmoxNode("low-resource-node", lowResourceArgs);

    // Assert
    expect(highResourceProxmoxNode).toBeInstanceOf(ProxmoxNode);
    expect(lowResourceProxmoxNode).toBeInstanceOf(ProxmoxNode);
    expect(highResourceProxmoxNode.vmId).toBe(101);
    expect(lowResourceProxmoxNode.vmId).toBe(102);
  });
});
