/**
 * Resource Exhaustion Scenarios Test Suite
 * Single Responsibility: Test only resource exhaustion conditions
 */

import { FailureSimulatorFactory } from "../../helpers/k3s/failure-simulator-factory";
import { MockK8sTestClient } from "../../helpers/k3s/mock-k8s-test-client";
import { PodValidator } from "../../helpers/k3s/pod-validator";
import { PulumiTestSetup } from "../../helpers/k3s/pulumi-test-setup";
import type { IResourceFailureSimulator } from "../../helpers/k3s/resource-failure-simulator";

describe("Resource Exhaustion", () => {
  let pulumiTestSetup: PulumiTestSetup;
  let k8sClient: MockK8sTestClient;
  let resourceSimulator: IResourceFailureSimulator;
  let podValidator: PodValidator;

  beforeEach(() => {
    pulumiTestSetup = new PulumiTestSetup();
    pulumiTestSetup.initialize();

    k8sClient = new MockK8sTestClient();
    void k8sClient.initialize();

    const factory = new FailureSimulatorFactory(k8sClient);
    resourceSimulator = factory.createResourceFailureSimulator();
    podValidator = new PodValidator(k8sClient.getCoreApi());
  });

  afterEach(async () => {
    await resourceSimulator.cleanup();
  });

  test("should handle disk space exhaustion on master node", async () => {
    // Arrange
    const diskSpaceAvailable = await resourceSimulator.verifyDiskSpace();
    expect(diskSpaceAvailable.available).toBeGreaterThan(1024); // At least 1GB

    // Act - Fill up disk space
    await resourceSimulator.simulateDiskSpaceExhaustion();

    // Assert
    const diskFull = await resourceSimulator.isDiskSpaceExhausted();
    expect(diskFull).toBe(true);

    // Verify etcd writes fail
    const etcdWriteResult = await resourceSimulator.attemptEtcdWrite();
    expect(etcdWriteResult.success).toBe(false);

    // Verify cluster becomes read-only
    const clusterReadOnly = await resourceSimulator.isClusterReadOnly();
    expect(clusterReadOnly).toBe(true);
  });

  test("should handle memory exhaustion scenarios", async () => {
    // Arrange
    const memoryAvailable = await resourceSimulator.verifyMemoryAvailability();
    expect(memoryAvailable.available).toBeGreaterThan(512); // At least 512MB

    // Act - Consume all available memory
    await resourceSimulator.simulateMemoryExhaustion();

    // Assert
    const memoryExhausted = await resourceSimulator.isMemoryExhausted();
    expect(memoryExhausted).toBe(true);

    // Verify OOMKiller activates
    const oomKillerActive = await resourceSimulator.isOOMKillerActive();
    expect(oomKillerActive).toBe(true);

    // Verify critical pods are protected
    const systemPodsRunning = await podValidator.validatePodsRunning("kube-system", "k3s");
    expect(systemPodsRunning).toBe(true);
  });

  test("should handle containerd service failures", async () => {
    // Arrange
    const containerdHealthy = await resourceSimulator.verifyContainerdHealth();
    expect(containerdHealthy).toBe(true);

    // Act - Simulate containerd crash
    await resourceSimulator.simulateContainerdFailure();

    // Assert
    const containerdDown = await resourceSimulator.isContainerdDown();
    expect(containerdDown).toBe(true);

    // Verify automatic recovery
    await resourceSimulator.waitForContainerdRecovery();
    const recoveredHealthy = await resourceSimulator.verifyContainerdHealth();
    expect(recoveredHealthy).toBe(true);
  });

  test("should handle container image pull failures", async () => {
    // Arrange
    const registryAccessible = await resourceSimulator.verifyRegistryAccess();
    expect(registryAccessible).toBe(true);

    // Act - Simulate registry unreachable
    await resourceSimulator.simulateRegistryFailure();

    // Assert
    const imagePullResult = await resourceSimulator.attemptImagePull("nginx:latest");
    expect(imagePullResult.success).toBe(false);
    expect(imagePullResult.error).toContain("pull");
  });
});
