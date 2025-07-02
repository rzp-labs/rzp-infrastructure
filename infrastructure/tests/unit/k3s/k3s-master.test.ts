import { K3sMaster } from "../../../components/k3s/k3s-master";
import { MockNodeFactory } from "../../helpers/k3s/mock-node-factory";
import { PulumiTestSetup } from "../../helpers/k3s/pulumi-test-setup";

/**
 * Single Responsibility: Test K3sMaster component only
 */
describe("K3sMaster Component", () => {
  let pulumiSetup: PulumiTestSetup;
  let mockNodeFactory: MockNodeFactory;

  beforeAll(() => {
    pulumiSetup = new PulumiTestSetup();
    pulumiSetup.initialize();
    mockNodeFactory = new MockNodeFactory();
  });

  test("should create first master with correct configuration", async () => {
    // Arrange
    const nodeConfig = mockNodeFactory.createMasterNode();
    const credentials = mockNodeFactory.createCredentials();
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
    const nodeConfig = mockNodeFactory.createMasterNode("test-master-2", 121);
    const credentials = mockNodeFactory.createCredentials();
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
    const nodeConfig = mockNodeFactory.createMasterNode("test-master-3", 122);
    const credentials = mockNodeFactory.createCredentials();
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
