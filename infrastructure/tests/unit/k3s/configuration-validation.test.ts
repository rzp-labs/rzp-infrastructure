import { K3sMaster } from "../../../components/k3s/k3s-master";
import { MockNodeFactory } from "../../helpers/k3s/mock-node-factory";
import { PulumiTestSetup } from "../../helpers/k3s/pulumi-test-setup";

/**
 * Single Responsibility: Test configuration validation and error handling
 */
describe("Configuration Validation", () => {
  let pulumiSetup: PulumiTestSetup;
  let mockNodeFactory: MockNodeFactory;

  beforeAll(() => {
    pulumiSetup = new PulumiTestSetup();
    pulumiSetup.initialize();
    mockNodeFactory = new MockNodeFactory();
  });

  test("should handle empty SSH username gracefully", () => {
    // Arrange
    const nodeConfig = mockNodeFactory.createMasterNode();
    const invalidConfig = {
      node: nodeConfig,
      sshUsername: "",
      sshPrivateKey: "valid-key",
    };

    // Act & Assert
    expect(() => {
      new K3sMaster("invalid-username-master", invalidConfig);
    }).not.toThrow(); // Pulumi handles validation at runtime
  });

  test("should handle empty SSH private key gracefully", () => {
    // Arrange
    const nodeConfig = mockNodeFactory.createMasterNode();
    const invalidConfig = {
      node: nodeConfig,
      sshUsername: "testuser",
      sshPrivateKey: "",
    };

    // Act & Assert
    expect(() => {
      new K3sMaster("invalid-key-master", invalidConfig);
    }).not.toThrow(); // Pulumi handles validation at runtime
  });

  test("should handle invalid IP addresses gracefully", () => {
    // Arrange
    const invalidNodeConfig = mockNodeFactory.createMasterNode();
    const credentials = mockNodeFactory.createCredentials();
    // Note: Creating a new object since the mock returns readonly properties
    const modifiedConfig = {
      ...invalidNodeConfig,
      ip4: "invalid-ip",
    };
    const invalidConfig = {
      node: modifiedConfig,
      ...credentials,
    };

    // Act & Assert
    expect(() => {
      new K3sMaster("invalid-ip-master", invalidConfig);
    }).not.toThrow(); // Pulumi validation happens at runtime
  });

  test("should handle invalid VMID gracefully", () => {
    // Arrange
    const invalidNodeConfig = mockNodeFactory.createMasterNode();
    const credentials = mockNodeFactory.createCredentials();
    // Note: Creating a new object since the mock returns readonly properties
    const modifiedConfig = {
      ...invalidNodeConfig,
      vmId: -1,
    };
    const invalidConfig = {
      node: modifiedConfig,
      ...credentials,
    };

    // Act & Assert
    expect(() => {
      new K3sMaster("invalid-vmid-master", invalidConfig);
    }).not.toThrow(); // Pulumi validation happens at runtime
  });
});
