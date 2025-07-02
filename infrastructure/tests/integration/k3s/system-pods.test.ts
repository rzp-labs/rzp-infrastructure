import { TestEnvironment } from "../../fixtures/k3s/test-environment";
import { PodValidator } from "../../helpers/k3s/pod-validator";

/**
 * Single Responsibility: Validate system pods are running correctly
 */
describe("System Pods", () => {
  let testEnv: TestEnvironment;
  let podValidator: PodValidator;

  beforeAll(async () => {
    testEnv = new TestEnvironment();
    await testEnv.setup();
    podValidator = new PodValidator(testEnv.getK8sClient().getCoreApi());
  });

  afterAll(async () => {
    if (testEnv !== undefined) {
      await testEnv.teardown();
    }
  });

  test("should have CoreDNS pods running", async () => {
    // Arrange
    const namespace = "kube-system";
    const podNamePrefix = "coredns-";

    // Act
    const isRunning = await podValidator.validatePodsRunning(namespace, podNamePrefix);

    // Assert
    expect(isRunning).toBe(true);
  });

  test("should have Metrics Server pods running", async () => {
    // Arrange
    const namespace = "kube-system";
    const podNamePrefix = "metrics-server-";

    // Act
    const isRunning = await podValidator.validatePodsRunning(namespace, podNamePrefix);

    // Assert
    expect(isRunning).toBe(true);
  });

  test("should have Flannel CNI pods running", async () => {
    // Arrange
    const namespace = "kube-system";
    const podNamePrefix = "flannel-";

    // Act
    const isRunning = await podValidator.validatePodsRunning(namespace, podNamePrefix);

    // Assert
    expect(isRunning).toBe(true);
  });

  test("should NOT have Traefik pods (disabled)", async () => {
    // Arrange
    const namespace = "kube-system";
    const podNamePattern = "traefik";

    // Act
    const hasTraefik = await podValidator.validatePodsAbsent(namespace, podNamePattern);

    // Assert
    expect(hasTraefik).toBe(true);
  });
});
