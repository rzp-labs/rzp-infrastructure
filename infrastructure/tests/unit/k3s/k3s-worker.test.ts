import { K3sWorker } from "../../../components/k3s/k3s-worker";
import { MockNodeFactory } from "../../helpers/k3s/mock-node-factory";
import { PulumiTestSetup } from "../../helpers/k3s/pulumi-test-setup";

/**
 * Single Responsibility: Test K3sWorker component only
 */
describe("K3sWorker Component", () => {
  let pulumiSetup: PulumiTestSetup;
  let mockNodeFactory: MockNodeFactory;

  beforeAll(() => {
    pulumiSetup = new PulumiTestSetup();
    pulumiSetup.initialize();
    mockNodeFactory = new MockNodeFactory();
  });

  test("should create worker component with valid configuration", async () => {
    // Arrange
    const workerNode = mockNodeFactory.createWorkerNode();
    const credentials = mockNodeFactory.createCredentials();
    const workerConfig = {
      node: workerNode,
      ...credentials,
      token: "mock-token",
      masterEndpoint: "10.10.0.20",
    };

    // Act
    const worker = new K3sWorker("test-worker", workerConfig);
    const result = worker.result.installComplete;

    // Assert
    expect(worker).toBeInstanceOf(K3sWorker);
    expect(result).toBeDefined();
  });

  test("should handle multiple worker configurations", async () => {
    // Arrange
    const worker1Node = mockNodeFactory.createWorkerNode("worker-1", 130);
    const worker2Node = mockNodeFactory.createWorkerNode("worker-2", 131);
    const credentials = mockNodeFactory.createCredentials();

    const worker1Config = {
      node: worker1Node,
      ...credentials,
      token: "mock-token-1",
      masterEndpoint: "10.10.0.20",
    };

    const worker2Config = {
      node: worker2Node,
      ...credentials,
      token: "mock-token-2",
      masterEndpoint: "10.10.0.20",
    };

    // Act
    const k3sWorker1 = new K3sWorker("test-worker-1", worker1Config);
    const k3sWorker2 = new K3sWorker("test-worker-2", worker2Config);

    // Assert
    expect(k3sWorker1).toBeInstanceOf(K3sWorker);
    expect(k3sWorker2).toBeInstanceOf(K3sWorker);
  });

  test("should handle different master endpoints", async () => {
    // Arrange
    const workerNode = mockNodeFactory.createWorkerNode();
    const credentials = mockNodeFactory.createCredentials();
    const workerConfig = {
      node: workerNode,
      ...credentials,
      token: "mock-token",
      masterEndpoint: "10.10.0.100", // Different master IP
    };

    // Act
    const worker = new K3sWorker("test-worker-ha", workerConfig);

    // Assert
    expect(worker).toBeInstanceOf(K3sWorker);
  });
});
