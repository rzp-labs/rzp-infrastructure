import { TestEnvironment } from "../../fixtures/k3s/test-environment";
import { NodeValidator } from "../../helpers/k3s/node-validator";

/**
 * Single Responsibility: Validate node configuration and state
 */
describe("Node Validation", () => {
  jest.setTimeout(90000); // 90-second timeout for integration tests

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

  test("should have one master and at least one worker node", async () => {
    // Arrange
    // No additional setup needed

    // Act
    const hasCorrectRoles = await nodeValidator.validateNodeRolesExist();

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

  test("should have valid internal IP addresses for all nodes", async () => {
    // Arrange
    // No additional setup needed

    // Act
    const haveIPs = await nodeValidator.validateNodesHaveIPs();

    // Assert
    expect(haveIPs).toBe(true);
  });
});
