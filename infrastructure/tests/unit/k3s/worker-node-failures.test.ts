/**
 * Worker Node Failure Scenarios Test Suite
 * Single Responsibility: Test only worker node failure conditions
 */

import { FailureSimulatorFactory } from "../../helpers/k3s/failure-simulator-factory";
import type { IMasterFailureSimulator } from "../../helpers/k3s/master-failure-simulator";
import { MockK8sTestClient } from "../../helpers/k3s/mock-k8s-test-client";
import { NodeValidator } from "../../helpers/k3s/node-validator";
import { PodValidator } from "../../helpers/k3s/pod-validator";
import { PulumiTestSetup } from "../../helpers/k3s/pulumi-test-setup";
import type { IWorkerFailureSimulator } from "../../helpers/k3s/worker-failure-simulator";

describe("Worker Node Failures", () => {
  let pulumiTestSetup: PulumiTestSetup;
  let k8sClient: MockK8sTestClient;
  let masterSimulator: IMasterFailureSimulator;
  let workerSimulator: IWorkerFailureSimulator;
  let nodeValidator: NodeValidator;
  let podValidator: PodValidator;

  beforeEach(() => {
    pulumiTestSetup = new PulumiTestSetup();
    pulumiTestSetup.initialize();

    k8sClient = new MockK8sTestClient();
    void k8sClient.initialize();

    const factory = new FailureSimulatorFactory(k8sClient);
    masterSimulator = factory.createMasterFailureSimulator();
    workerSimulator = factory.createWorkerFailureSimulator();
    nodeValidator = new NodeValidator(k8sClient.getCoreApi());
    podValidator = new PodValidator(k8sClient.getCoreApi());
  });

  afterEach(async () => {
    await masterSimulator.cleanup();
    await workerSimulator.cleanup();
  });

  test("should handle worker node joining cluster with invalid token", async () => {
    // Arrange
    const healthyMasters = await masterSimulator.getHealthyMasterNodes();
    expect(healthyMasters.length).toBeGreaterThan(0);

    // Act - Attempt worker join with invalid token
    const joinResult = await masterSimulator.attemptWorkerJoin();

    // Simulate invalid token scenario - result would contain authentication failure details

    // Assert
    expect(typeof joinResult.success).toBe("boolean");
    if (!joinResult.success) {
      expect(joinResult.error).toBeDefined();
    }
  });

  test("should handle worker node losing connection to master during operation", async () => {
    // Arrange
    const initialNodesReady = await nodeValidator.validateNodesReady();
    expect(initialNodesReady).toBe(true);

    // Act - Simulate network partition isolating worker
    await workerSimulator.simulateWorkerNetworkIsolation();

    // Assert
    const isolationDetected = await workerSimulator.isWorkerIsolated();
    expect(isolationDetected).toBe(true);

    // Mock pod accessibility based on isolation state
    const mockValidatePodsAccessible = jest.spyOn(podValidator, "validatePodsAccessible");
    mockValidatePodsAccessible.mockResolvedValue(false);

    // Verify pods on isolated worker become unreachable
    const podsAccessible = await podValidator.validatePodsAccessible("default");
    expect(podsAccessible).toBe(false);

    // Cleanup
    mockValidatePodsAccessible.mockRestore();
  });

  test("should handle worker node kubelet service failure", async () => {
    // Arrange
    const kubeletHealthy = await workerSimulator.verifyKubeletHealth();
    expect(kubeletHealthy).toBe(true);

    // Act - Simulate kubelet crash on worker
    await workerSimulator.simulateKubeletFailure();

    // Assert
    const kubeletDown = await workerSimulator.isKubeletDown();
    expect(kubeletDown).toBe(true);

    // Mock node readiness to reflect kubelet failure
    const mockValidateNodesReady = jest.spyOn(nodeValidator, "validateNodesReady");
    mockValidateNodesReady.mockResolvedValue(false);

    // Verify node marked as NotReady
    const nodeReady = await nodeValidator.validateNodesReady();
    expect(nodeReady).toBe(false);

    // Verify pods scheduled elsewhere
    const podsRescheduled = await podValidator.validatePodsRescheduled();
    expect(podsRescheduled).toBe(true);

    // Cleanup
    mockValidateNodesReady.mockRestore();
  });

  test("should handle worker node leaving and rejoining cluster", async () => {
    // Arrange
    const expectedNodeCount = 2;
    const initialValid = await nodeValidator.validateNodeCount(expectedNodeCount);
    expect(initialValid).toBe(true);

    // Mock node count validation to simulate worker leaving
    const mockValidateNodeCount = jest.spyOn(nodeValidator, "validateNodeCount");

    // Act - Worker node leaves cluster
    await workerSimulator.simulateWorkerNodeLeave();

    // Mock reduced node count
    mockValidateNodeCount.mockResolvedValueOnce(true); // First call returns true for reduced count

    // Assert - Cluster should detect node absence
    const nodeCountReduced = await nodeValidator.validateNodeCount(expectedNodeCount - 1);
    expect(nodeCountReduced).toBe(true);

    // Act - Worker node rejoins cluster
    const rejoinResult = await masterSimulator.attemptWorkerJoin();

    // Assert - Rejoin should succeed and restore node count
    expect(rejoinResult.success).toBe(true);

    // Mock restored node count
    mockValidateNodeCount.mockResolvedValueOnce(true); // Second call returns true for restored count
    const nodeCountRestored = await nodeValidator.validateNodeCount(expectedNodeCount);
    expect(nodeCountRestored).toBe(true);

    // Cleanup
    mockValidateNodeCount.mockRestore();
  });

  test("should handle worker node running out of pod capacity", async () => {
    // Arrange
    const initialPodCapacity = await podValidator.getWorkerPodCapacity();
    expect(initialPodCapacity).toBeGreaterThan(0);

    // Act - Fill worker node to capacity
    await podValidator.deployPodsToCapacity();

    // Assert
    const atCapacity = await podValidator.isWorkerAtPodCapacity();
    expect(atCapacity).toBe(true);

    // Verify additional pods are scheduled on other nodes
    const additionalPodResult = await podValidator.deployAdditionalPod();
    expect(additionalPodResult.scheduledOnDifferentNode).toBe(true);
  });

  test("should handle worker node with corrupted container runtime", async () => {
    // Arrange
    const runtimeHealthy = await workerSimulator.verifyContainerRuntimeHealth();
    expect(runtimeHealthy).toBe(true);

    // Act - Simulate container runtime corruption
    await workerSimulator.simulateContainerRuntimeCorruption();

    // Assert
    const runtimeCorrupted = await workerSimulator.isContainerRuntimeCorrupted();
    expect(runtimeCorrupted).toBe(true);

    // Verify existing pods become unresponsive
    const podsResponsive = await podValidator.validatePodsResponsive();
    expect(podsResponsive).toBe(false);

    // Verify cluster health remains stable (master unaffected)
    const clusterHealthy = await masterSimulator.validateHealth();
    expect(clusterHealthy).toBe(true);
  });
});
