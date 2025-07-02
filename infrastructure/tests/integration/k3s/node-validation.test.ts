import { TestEnvironment } from "../../fixtures/k3s/test-environment";
import { NodeValidator } from "../../helpers/k3s/node-validator";

/**
 * Single Responsibility: Validate node configuration and state
 */
describe("Node Validation", () => {
  let testEnv: TestEnvironment;
  let nodeValidator: NodeValidator;

  beforeAll(async () => {
    testEnv = new TestEnvironment();
    await testEnv.setup();
    nodeValidator = new NodeValidator(testEnv.getK8sClient().getCoreApi());
  });

  afterAll(async () => {
    if (testEnv !== undefined) {
      await testEnv.teardown();
    }
  });

  test("should have expected number of nodes", async () => {
    // Arrange
    const expectedNodeCount = 2;

    // Act
    const isValid = await nodeValidator.validateNodeCount(expectedNodeCount);

    // Assert
    expect(isValid).toBe(true);
  });

  test("should have master and worker nodes with correct roles", async () => {
    // Arrange
    const expectedRoles = {
      master: "stg-k3s-master",
      worker: "stg-k3s-worker-1",
    };

    // Act
    const hasCorrectRoles = await nodeValidator.validateNodeRoles(expectedRoles);

    // Assert
    expect(hasCorrectRoles).toBe(true);
  });

  test("should have all nodes in Ready state", async () => {
    // Arrange
    // No additional setup needed - using existing cluster state

    // Act
    const allReady = await nodeValidator.validateNodesReady();

    // Assert
    expect(allReady).toBe(true);
  });

  test("should have correct node IP addresses", async () => {
    // Arrange
    const expectedNodeIPs = {
      "stg-k3s-master": "10.10.0.20",
      "stg-k3s-worker-1": "10.10.0.30",
    };

    // Act
    const correctIPs = await nodeValidator.validateNodeIPs(expectedNodeIPs);

    // Assert
    expect(correctIPs).toBe(true);
  });
});
