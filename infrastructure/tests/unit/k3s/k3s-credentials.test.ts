import { K3sCredentials } from "../../../components/k3s/k3s-credentials";
import { MockNodeFactory } from "../../helpers/k3s/mock-node-factory";
import { PulumiTestSetup } from "../../helpers/k3s/pulumi-test-setup";

/**
 * Single Responsibility: Test K3sCredentials component only
 */
describe("K3sCredentials Component", () => {
  let pulumiSetup: PulumiTestSetup;
  let mockNodeFactory: MockNodeFactory;

  beforeAll(() => {
    pulumiSetup = new PulumiTestSetup();
    pulumiSetup.initialize();
    mockNodeFactory = new MockNodeFactory();
  });

  test("should create credentials component with valid configuration", async () => {
    // Arrange
    const masterNode = mockNodeFactory.createMasterNode();
    const credentials = mockNodeFactory.createCredentials();
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
    const customMasterNode = mockNodeFactory.createMasterNode("custom-master", 125);
    const credentials = mockNodeFactory.createCredentials();
    const customCredentialsConfig = {
      masterNode: customMasterNode,
      ...credentials,
    };

    // Act
    const k3sCredentials = new K3sCredentials("custom-credentials", customCredentialsConfig);

    // Assert
    expect(k3sCredentials).toBeInstanceOf(K3sCredentials);
  });
});
