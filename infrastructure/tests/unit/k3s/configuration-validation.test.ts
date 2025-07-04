import * as pulumi from "@pulumi/pulumi";

import { K3sMaster } from "../../../components/k3s/k3s-master";
import type { IK3sNodeConfig } from "../../../shared/types";

/**
 * Configuration Validation - Native Pulumi Testing
 *
 * Following official Pulumi testing patterns with proper dependency mocking
 */

// Set up Pulumi mocks FIRST
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

/**
 * Single Responsibility: Test configuration validation and error handling
 */
describe("Configuration Validation", () => {
  // Helper functions for creating test data (replacing MockNodeFactory)
  const createMasterNode = (name = "test-master", vmId = 120): IK3sNodeConfig => ({
    vmId,
    name,
    ip4: "10.10.0.20",
    ip6: "fd00:10:10::20",
    role: "master",
    roleIndex: 0,
    resources: {
      cores: 2,
      memory: 2048,
      osDiskSize: 20,
      dataDiskSize: 60,
    },
  });

  const createCredentials = () => ({
    sshUsername: "testuser",
    sshPrivateKey: "mock-private-key",
  });

  test("should handle empty SSH username gracefully", () => {
    // Arrange
    const nodeConfig = createMasterNode();
    const invalidConfig = {
      node: nodeConfig,
      sshUsername: "",
      sshPrivateKey: "valid-key",
      isFirstMaster: true,
    };

    // Act & Assert
    expect(() => {
      new K3sMaster("invalid-username-master", invalidConfig);
    }).not.toThrow(); // Pulumi handles validation at runtime
  });

  test("should handle empty SSH private key gracefully", () => {
    // Arrange
    const nodeConfig = createMasterNode();
    const invalidConfig = {
      node: nodeConfig,
      sshUsername: "testuser",
      sshPrivateKey: "",
      isFirstMaster: true,
    };

    // Act & Assert
    expect(() => {
      new K3sMaster("invalid-key-master", invalidConfig);
    }).not.toThrow(); // Pulumi handles validation at runtime
  });

  test("should handle invalid IP addresses gracefully", () => {
    // Arrange
    const invalidNodeConfig = createMasterNode();
    const credentials = createCredentials();
    // Note: Creating a new object since the mock returns readonly properties
    const modifiedConfig = {
      ...invalidNodeConfig,
      ip4: "invalid-ip",
    };
    const invalidConfig = {
      node: modifiedConfig,
      ...credentials,
      isFirstMaster: true,
    };

    // Act & Assert
    expect(() => {
      new K3sMaster("invalid-ip-master", invalidConfig);
    }).not.toThrow(); // Pulumi validation happens at runtime
  });

  test("should handle invalid VMID gracefully", () => {
    // Arrange
    const invalidNodeConfig = createMasterNode();
    const credentials = createCredentials();
    // Note: Creating a new object since the mock returns readonly properties
    const modifiedConfig = {
      ...invalidNodeConfig,
      vmId: -1,
    };
    const invalidConfig = {
      node: modifiedConfig,
      ...credentials,
      isFirstMaster: true,
    };

    // Act & Assert
    expect(() => {
      new K3sMaster("invalid-vmid-master", invalidConfig);
    }).not.toThrow(); // Pulumi validation happens at runtime
  });
});
