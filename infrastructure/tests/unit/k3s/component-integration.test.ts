import { K3sCredentials } from "../../../components/k3s/k3s-credentials";
import { K3sMaster } from "../../../components/k3s/k3s-master";
import { K3sWorker } from "../../../components/k3s/k3s-worker";
import { MockNodeFactory } from "../../helpers/k3s/mock-node-factory";
import { PulumiTestSetup } from "../../helpers/k3s/pulumi-test-setup";

/**
 * Single Responsibility: Test component integration and dependency chains
 */
describe("Component Integration", () => {
  let pulumiSetup: PulumiTestSetup;
  let mockNodeFactory: MockNodeFactory;

  beforeAll(() => {
    pulumiSetup = new PulumiTestSetup();
    pulumiSetup.initialize();
    mockNodeFactory = new MockNodeFactory();
  });

  test("should create complete dependency chain", async () => {
    // Arrange
    const masterNode = mockNodeFactory.createMasterNode();
    const workerNode = mockNodeFactory.createWorkerNode();
    const credentials = mockNodeFactory.createCredentials();

    const masterConfig = {
      node: masterNode,
      ...credentials,
      isFirstMaster: true,
    };

    const credentialsConfig = {
      masterNode,
      ...credentials,
    };

    // Act
    const master = new K3sMaster("integration-master", masterConfig);
    const k3sCredentials = new K3sCredentials("integration-credentials", credentialsConfig);

    const workerConfig = {
      node: workerNode,
      ...credentials,
      token: k3sCredentials.result.token,
      masterEndpoint: masterNode.ip4,
    };
    const worker = new K3sWorker("integration-worker", workerConfig);

    // Assert
    expect(master).toBeInstanceOf(K3sMaster);
    expect(k3sCredentials).toBeInstanceOf(K3sCredentials);
    expect(worker).toBeInstanceOf(K3sWorker);
  });

  test("should handle multi-master setup", async () => {
    // Arrange
    const master1 = mockNodeFactory.createMasterNode("master-1", 120);
    const master2 = mockNodeFactory.createMasterNode("master-2", 121);
    const credentials = mockNodeFactory.createCredentials();

    const master1Config = {
      node: master1,
      ...credentials,
      isFirstMaster: true,
    };

    const master2Config = {
      node: master2,
      ...credentials,
      isFirstMaster: false,
      serverEndpoint: `https://${master1.ip4}:6443`,
    };

    // Act
    const k3sMaster1 = new K3sMaster("multi-master-1", master1Config);
    const k3sMaster2 = new K3sMaster("multi-master-2", master2Config);

    // Assert
    expect(k3sMaster1).toBeInstanceOf(K3sMaster);
    expect(k3sMaster2).toBeInstanceOf(K3sMaster);
  });
});
