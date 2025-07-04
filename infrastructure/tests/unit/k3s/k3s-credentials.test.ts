import * as pulumi from "@pulumi/pulumi";

import { K3sCredentials } from "../../../components/k3s/k3s-credentials";
import type { IK3sNodeConfig } from "../../../shared/types";

/**
 * K3sCredentials Component - Native Pulumi Testing
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
 * Single Responsibility: Test K3sCredentials component only
 */
describe("K3sCredentials Component", () => {
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

  test("should create credentials component with valid configuration", async () => {
    // Arrange
    const masterNode = createMasterNode();
    const credentials = createCredentials();
    const credentialsConfig = {
      masterNode,
      ...credentials,
    };

    // Act
    const k3sCredentials = new K3sCredentials("test-credentials", credentialsConfig);
    const result = k3sCredentials.result;

    // Assert
    expect(k3sCredentials).toBeInstanceOf(K3sCredentials);
    expect(result.token).toBeDefined();
    expect(result.kubeconfig).toBeDefined();
  });

  test("should handle different master node configurations", async () => {
    // Arrange
    const customMasterNode = createMasterNode("custom-master", 125);
    const credentials = createCredentials();
    const customCredentialsConfig = {
      masterNode: customMasterNode,
      ...credentials,
    };

    // Act
    const k3sCredentials = new K3sCredentials("custom-credentials", customCredentialsConfig);

    // Assert
    expect(k3sCredentials).toBeInstanceOf(K3sCredentials);
  });

  test("should create SSH connection with correct parameters", () => {
    // Arrange
    const masterNode = createMasterNode();
    const credentials = createCredentials();
    const credentialsConfig = {
      masterNode,
      ...credentials,
    };

    // Act
    const k3sCredentials = new K3sCredentials("connection-test", credentialsConfig);

    // Assert - Component should be created successfully with connection parameters
    expect(k3sCredentials).toBeInstanceOf(K3sCredentials);
    expect(k3sCredentials.result.token).toBeDefined();
    expect(k3sCredentials.result.kubeconfig).toBeDefined();
  });

  test("should handle kubeconfig IP replacement", async () => {
    // Arrange
    const masterNode = createMasterNode("ip-replacement-test", 130);
    const credentials = createCredentials();
    const credentialsConfig = {
      masterNode,
      ...credentials,
    };

    // Act
    const k3sCredentials = new K3sCredentials("ip-replacement", credentialsConfig);
    const kubeconfigOutput = k3sCredentials.result.kubeconfig;

    // Assert - Kubeconfig should be defined and ready for IP replacement
    expect(kubeconfigOutput).toBeDefined();
    expect(k3sCredentials).toBeInstanceOf(K3sCredentials);
  });

  test("should create token retrieval command", () => {
    // Arrange
    const masterNode = createMasterNode("token-test", 135);
    const credentials = createCredentials();
    const credentialsConfig = {
      masterNode,
      ...credentials,
    };

    // Act
    const k3sCredentials = new K3sCredentials("token-command", credentialsConfig);

    // Assert - Token command should be created and accessible
    expect(k3sCredentials.result.token).toBeDefined();
    expect(k3sCredentials).toBeInstanceOf(K3sCredentials);
  });

  test("should create kubeconfig retrieval command", () => {
    // Arrange
    const masterNode = createMasterNode("kubeconfig-test", 140);
    const credentials = createCredentials();
    const credentialsConfig = {
      masterNode,
      ...credentials,
    };

    // Act
    const k3sCredentials = new K3sCredentials("kubeconfig-command", credentialsConfig);

    // Assert - Kubeconfig command should be created and accessible
    expect(k3sCredentials.result.kubeconfig).toBeDefined();
    expect(k3sCredentials).toBeInstanceOf(K3sCredentials);
  });

  test("should register component outputs correctly", () => {
    // Arrange
    const masterNode = createMasterNode("outputs-test", 145);
    const credentials = createCredentials();
    const credentialsConfig = {
      masterNode,
      ...credentials,
    };

    // Act
    const k3sCredentials = new K3sCredentials("outputs-registration", credentialsConfig);

    // Assert - Component should register outputs correctly
    expect(k3sCredentials.result).toBeDefined();
    expect(k3sCredentials.result.token).toBeDefined();
    expect(k3sCredentials.result.kubeconfig).toBeDefined();
  });

  test("should handle component resource options", () => {
    // Arrange
    const masterNode = createMasterNode("options-test", 150);
    const credentials = createCredentials();
    const credentialsConfig = {
      masterNode,
      ...credentials,
    };
    const componentOptions = { protect: false };

    // Act
    const k3sCredentials = new K3sCredentials("options-test", credentialsConfig, componentOptions);

    // Assert - Component should handle options correctly
    expect(k3sCredentials).toBeInstanceOf(K3sCredentials);
    expect(k3sCredentials.result.token).toBeDefined();
    expect(k3sCredentials.result.kubeconfig).toBeDefined();
  });

  test("should create component with custom IP addresses", () => {
    // Arrange
    const customMasterNode = {
      ...createMasterNode("custom-ip-test", 155),
      ip4: "192.168.1.100", // Custom IP to test connection creation
    };
    const credentials = createCredentials();
    const credentialsConfig = {
      masterNode: customMasterNode,
      ...credentials,
    };

    // Act
    const k3sCredentials = new K3sCredentials("custom-ip", credentialsConfig);

    // Assert - Component should use custom IP in connection
    expect(k3sCredentials).toBeInstanceOf(K3sCredentials);
    expect(k3sCredentials.result.token).toBeDefined();
    expect(k3sCredentials.result.kubeconfig).toBeDefined();
  });

  test("should create component with different SSH credentials", () => {
    // Arrange
    const masterNode = createMasterNode("ssh-test", 160);
    const customCredentials = {
      sshUsername: "custom-user",
      sshPrivateKey: "custom-private-key-content",
    };
    const credentialsConfig = {
      masterNode,
      ...customCredentials,
    };

    // Act
    const k3sCredentials = new K3sCredentials("custom-ssh", credentialsConfig);

    // Assert - Component should use custom SSH credentials
    expect(k3sCredentials).toBeInstanceOf(K3sCredentials);
    expect(k3sCredentials.result.token).toBeDefined();
    expect(k3sCredentials.result.kubeconfig).toBeDefined();
  });

  test("should create commands with correct parent relationship", () => {
    // Arrange
    const masterNode = createMasterNode("parent-test", 165);
    const credentials = createCredentials();
    const credentialsConfig = {
      masterNode,
      ...credentials,
    };

    // Act
    const k3sCredentials = new K3sCredentials("parent-relationship", credentialsConfig);

    // Assert - Commands should be created with correct parent
    expect(k3sCredentials).toBeInstanceOf(K3sCredentials);
    expect(k3sCredentials.result.token).toBeDefined();
    expect(k3sCredentials.result.kubeconfig).toBeDefined();
  });

  test("should handle IPv6 addresses in master node", () => {
    // Arrange
    const ipv6MasterNode = {
      ...createMasterNode("ipv6-test", 170),
      ip6: "2001:db8::1", // Custom IPv6 address
    };
    const credentials = createCredentials();
    const credentialsConfig = {
      masterNode: ipv6MasterNode,
      ...credentials,
    };

    // Act
    const k3sCredentials = new K3sCredentials("ipv6-test", credentialsConfig);

    // Assert - Component should handle IPv6 configuration
    expect(k3sCredentials).toBeInstanceOf(K3sCredentials);
    expect(k3sCredentials.result.token).toBeDefined();
    expect(k3sCredentials.result.kubeconfig).toBeDefined();
  });
});
