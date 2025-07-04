import * as pulumi from "@pulumi/pulumi";

import { K3sMaster } from "../../../components/k3s/k3s-master";
import type { IK3sNodeConfig } from "../../../shared/types";

/**
 * K3sMaster Component - Native Pulumi Testing
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
 * Single Responsibility: Test K3sMaster component only
 */
describe("K3sMaster Component", () => {
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

  test("should create first master with correct configuration", async () => {
    // Arrange
    const nodeConfig = createMasterNode();
    const credentials = createCredentials();
    const masterConfig = {
      node: nodeConfig,
      ...credentials,
      isFirstMaster: true,
    };

    // Act
    const master = new K3sMaster("test-master", masterConfig);
    const result = master.result.installComplete;

    // Assert
    expect(master).toBeInstanceOf(K3sMaster);
    expect(result).toBeDefined();
  });

  test("should create additional master with server endpoint", async () => {
    // Arrange
    const nodeConfig = createMasterNode("test-master-2", 121);
    const credentials = createCredentials();
    const additionalMasterConfig = {
      node: nodeConfig,
      ...credentials,
      isFirstMaster: false,
      serverEndpoint: "https://10.10.0.20:6443",
    };

    // Act
    const additionalMaster = new K3sMaster("test-master-2", additionalMasterConfig);

    // Assert
    expect(additionalMaster).toBeInstanceOf(K3sMaster);
  });

  test("should handle missing server endpoint for additional masters", () => {
    // Arrange
    const nodeConfig = createMasterNode("test-master-3", 122);
    const credentials = createCredentials();
    const configWithoutEndpoint = {
      node: nodeConfig,
      ...credentials,
      isFirstMaster: false,
      // Missing serverEndpoint - should be handled gracefully
    };

    // Act & Assert
    expect(() => {
      new K3sMaster("test-master-3", configWithoutEndpoint);
    }).not.toThrow();
  });
});
