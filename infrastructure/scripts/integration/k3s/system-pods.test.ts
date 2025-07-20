import { TestEnvironment } from "../../fixtures/k3s/test-environment";
import { PodValidator } from "../../helpers/k3s/pod-validator";

/**
 * Single Responsibility: Validate system pods are running correctly
 */
describe("System Pods", () => {
  jest.setTimeout(90000); // 90-second timeout for integration tests

  let testEnv: TestEnvironment;
  let podValidator: PodValidator;

  beforeAll(async () => {
    testEnv = new TestEnvironment();
    await testEnv.setup();

    // Skip all tests if cluster is not available
    if (!testEnv.isClusterAvailable()) {
      return;
    }

    podValidator = new PodValidator(testEnv.getK8sClient().getCoreApi());
  });

  afterAll(async () => {
    if (testEnv !== undefined) {
      await testEnv.teardown();
    }
  });

  test("should have CoreDNS pods running", async () => {
    // Skip test if cluster not available
    if (!testEnv.isClusterAvailable()) {
      return;
    }

    // Arrange
    const namespace = "kube-system";
    const podNamePrefix = "coredns-";

    // Act
    const isRunning = await podValidator.validatePodsRunning(namespace, podNamePrefix);

    // Assert
    expect(isRunning).toBe(true);
  });

  test("should have Metrics Server pods running", async () => {
    // Skip test if cluster not available
    if (!testEnv.isClusterAvailable()) {
      return;
    }

    // Arrange
    const namespace = "kube-system";
    const podNamePrefix = "metrics-server-";

    // Act
    const isRunning = await podValidator.validatePodsRunning(namespace, podNamePrefix);

    // Assert
    expect(isRunning).toBe(true);
  });

  test("should NOT have Flannel CNI pods (K3s uses embedded CNI)", async () => {
    // Skip test if cluster not available
    if (!testEnv.isClusterAvailable()) {
      return;
    }

    // Arrange
    const namespace = "kube-system";
    const podNamePattern = "flannel";

    // Act
    const hasFlannelPods = await podValidator.validatePodsAbsent(namespace, podNamePattern);

    // Assert - K3s uses embedded CNI, not Flannel pods
    expect(hasFlannelPods).toBe(true);
  });

  test("should NOT have Traefik pods (disabled)", async () => {
    // Skip test if cluster not available
    if (!testEnv.isClusterAvailable()) {
      return;
    }

    // Arrange
    const namespace = "kube-system";
    const podNamePattern = "traefik";

    // Act
    const hasTraefik = await podValidator.validatePodsAbsent(namespace, podNamePattern);

    // Assert
    expect(hasTraefik).toBe(true);
  });
});
