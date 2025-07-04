import type * as proxmoxve from "@muhlba91/pulumi-proxmoxve";
import * as pulumi from "@pulumi/pulumi";

/**
 * Phase 3: Native Pulumi Unit Tests for ProxmoxNode Component
 *
 * Following official Pulumi testing patterns with proper dependency mocking
 */

// Set up mocks FIRST
void pulumi.runtime.setMocks({
  newResource: (args: pulumi.runtime.MockResourceArgs): pulumi.runtime.MockResourceResult => {
    return {
      id: `${args.name}-mock-id`,
      state: args.inputs as Record<string, unknown>,
    };
  },
  call: (args: pulumi.runtime.MockCallArgs): pulumi.runtime.MockCallResult => {
    return { outputs: args.inputs as Record<string, unknown> };
  },
});

// Mock the config module to avoid SSH key requirement
jest.mock("../../../config/base", () => ({
  getSshPublicKey: () => pulumi.output("ssh-rsa AAAAB3NzaC1yc2ETEST test@example.com"),
}));

// NOW import infrastructure after mocks
import { type IProxmoxNodeArgs, ProxmoxNode } from "../../../components/proxmox-node";
import type { IK3sNodeConfig, IProxmoxConfig } from "../../../shared/types";

describe("ProxmoxNode - Phase 3 Native Testing", () => {
  let mockProxmoxConfig: IProxmoxConfig;
  let mockNodeConfig: IK3sNodeConfig;
  let mockProvider: proxmoxve.Provider;

  beforeEach(() => {
    // Create proper Provider mock
    mockProvider = {
      version: "1.0.0",
      getPackage: () => ({ name: "proxmoxve", version: "1.0.0" }),
      urn: pulumi.output("urn:pulumi:test::test::proxmoxve:index:Provider::test-provider"),
      id: pulumi.output("test-provider-id"),
      create: async () => ({ id: "mock-resource-id" }),
      delete: async () => {},
      update: async () => {},
      diff: async () => ({ changes: [] }),
      read: async () => ({ inputs: {}, outputs: {} }),
      check: async () => ({ inputs: {} }),
      invoke: async () => ({ outputs: {} }),
      call: async () => ({ outputs: {} }),
    } as unknown as proxmoxve.Provider;
    mockProxmoxConfig = {
      endpoint: "https://test-proxmox:8006/api2/json",
      username: pulumi.output("test-user"),
      password: pulumi.output("test-pass"),
      insecure: true,
      node: "test-node",
      isoStore: "local",
      vmStore: "local-lvm",
      bridge: "vmbr0",
    };

    mockNodeConfig = {
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
  });

  describe("ComponentResource Pattern Validation", () => {
    it("should create ProxmoxNode with VmConfiguration ComponentResource", () => {
      // Arrange
      const nodeArgs: IProxmoxNodeArgs = {
        config: mockProxmoxConfig,
        nodeConfig: mockNodeConfig,
        provider: mockProvider,
      };

      // Act
      const node = new ProxmoxNode("test-node", nodeArgs);

      // Assert - Validate Phase 2 ComponentResource architecture
      expect(node).toBeInstanceOf(ProxmoxNode);
      expect(node.config).toBe(mockNodeConfig);
      expect(node.vmId).toBe(100);
      expect(node.role).toBe("master");
      expect(node.ip4).toBe("10.10.0.20");
      expect(node.ip6).toBe("fd00:10:10::20");
    });

    it("should handle worker node configuration", () => {
      // Arrange
      const workerConfig: IK3sNodeConfig = {
        ...mockNodeConfig,
        vmId: 101,
        role: "worker",
        roleIndex: 1,
        name: "worker-node",
      };

      const nodeArgs: IProxmoxNodeArgs = {
        config: mockProxmoxConfig,
        nodeConfig: workerConfig,
        provider: mockProvider,
      };

      // Act
      const node = new ProxmoxNode("worker-node", nodeArgs);

      // Assert
      expect(node.vmId).toBe(101);
      expect(node.role).toBe("worker");
      expect(node.config.name).toBe("worker-node");
    });
  });

  describe("ComponentResource Architecture", () => {
    it("should use VmConfiguration ComponentResource not factory functions", () => {
      // Arrange
      const nodeArgs: IProxmoxNodeArgs = {
        config: mockProxmoxConfig,
        nodeConfig: mockNodeConfig,
        provider: mockProvider,
      };

      // Act
      const node = new ProxmoxNode("test-node", nodeArgs);

      // Assert - Uses ComponentResource pattern, not buildVmConfiguration factory
      expect(node.vmConfiguration).toBeDefined();
      expect(node.vmConfiguration.constructor.name).toBe("VmConfiguration");
      expect(node.vm).toBeDefined();
      expect(node.vm.constructor.name).toBe("VirtualMachine");
    });

    it("should apply VM transformations through ComponentResource", () => {
      // Arrange
      const customConfig: IK3sNodeConfig = {
        vmId: 200,
        role: "master",
        roleIndex: 0,
        name: "custom-node",
        ip4: "10.10.0.30",
        ip6: "fd00:10:10::30",
        resources: {
          cores: 4,
          memory: 8192,
          osDiskSize: 40,
          dataDiskSize: 120,
        },
      };

      const nodeArgs: IProxmoxNodeArgs = {
        config: mockProxmoxConfig,
        nodeConfig: customConfig,
        provider: mockProvider,
      };

      // Act
      const node = new ProxmoxNode("custom-node", nodeArgs);

      // Assert - ComponentResource handles transformations properly
      expect(node.config).toBe(customConfig);
      expect(node.vmId).toBe(200);
      expect(node.ip4).toBe("10.10.0.30");

      // Verify VmConfiguration receives configuration correctly
      expect(node.vmConfiguration.vm).toBeDefined();
      expect(node.vmConfiguration.nodeConfig).toBe(customConfig);
    });

    it("should compose VM configuration through ComponentResource hierarchy", () => {
      // Arrange - Test high-resource configuration
      const highResourceConfig: IK3sNodeConfig = {
        ...mockNodeConfig,
        vmId: 300,
        name: "high-resource-node",
        resources: {
          cores: 8,
          memory: 16384,
          osDiskSize: 100,
          dataDiskSize: 500,
        },
      };

      const nodeArgs: IProxmoxNodeArgs = {
        config: mockProxmoxConfig,
        nodeConfig: highResourceConfig,
        provider: mockProvider,
      };

      // Act
      const node = new ProxmoxNode("high-resource-node", nodeArgs);

      // Assert - ComponentResource properly composes VM configuration
      expect(node.vmConfiguration).toBeDefined();
      expect(node.vmConfiguration.nodeConfig.resources.cores).toBe(8);
      expect(node.vmConfiguration.nodeConfig.resources.memory).toBe(16384);

      // Verify ComponentResource composition works for complex configurations
      expect(node.vm).toBeDefined();
      expect(typeof node.vmConfiguration).toBe("object");
    });
  });
});
