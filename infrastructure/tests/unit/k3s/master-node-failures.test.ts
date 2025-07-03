/**
 * Master Node Failure Scenarios Test Suite
 * Single Responsibility: Test only master node failure conditions
 */

import { FailureSimulatorFactory } from "../../helpers/k3s/failure-simulator-factory";
import type { IMasterFailureSimulator } from "../../helpers/k3s/master-failure-simulator";
import { MockK8sTestClient } from "../../helpers/k3s/mock-k8s-test-client";
// NodeValidator available for future test expansion
import { PulumiTestSetup } from "../../helpers/k3s/pulumi-test-setup";

describe("Master Node Failures", () => {
  let pulumiTestSetup: PulumiTestSetup;
  let k8sClient: MockK8sTestClient;
  let masterSimulator: IMasterFailureSimulator;
  // NodeValidator intentionally unused - available for future test expansion

  beforeEach(() => {
    pulumiTestSetup = new PulumiTestSetup();
    pulumiTestSetup.initialize();

    k8sClient = new MockK8sTestClient();
    void k8sClient.initialize();

    const factory = new FailureSimulatorFactory(k8sClient);
    masterSimulator = factory.createMasterFailureSimulator();
    // nodeValidator = new NodeValidator(k8sClient.getCoreApi()); // Available for future expansion
  });

  afterEach(async () => {
    await masterSimulator.cleanup();
  });

  test("should handle master node becoming unavailable during worker join", async () => {
    // Arrange
    const masterNodes = await masterSimulator.getHealthyMasterNodes();
    expect(masterNodes.length).toBeGreaterThan(0);

    // Act - Simulate master failure during worker join
    await masterSimulator.simulateMasterNodeFailure(masterNodes[0]);
    const workerJoinResult = await masterSimulator.attemptWorkerJoin();

    // Assert
    expect(workerJoinResult.success).toBe(false);
    expect(workerJoinResult.error).toContain("connection refused");

    // Verify cluster state
    const clusterHealthy = await masterSimulator.validateHealth();
    expect(clusterHealthy).toBe(false);
  });

  test("should detect and handle split-brain scenarios in multi-master setup", async () => {
    // Arrange
    const masterNodes = await masterSimulator.setupMultiMasterCluster(3);
    expect(masterNodes.length).toBe(3);

    // Act - Simulate network partition creating split-brain
    await masterSimulator.simulateNetworkPartition(masterNodes);

    // Assert
    const splitBrainDetected = await masterSimulator.detectSplitBrain();
    expect(splitBrainDetected).toBe(true);

    // Verify only one partition remains leader
    const activeLeaders = await masterSimulator.getActiveLeaders();
    expect(activeLeaders.length).toBeLessThanOrEqual(1);
  });

  test("should handle etcd corruption and recovery scenarios", async () => {
    // Arrange
    const etcdHealthy = await masterSimulator.verifyEtcdHealth();
    expect(etcdHealthy).toBe(true);

    // Act - Simulate etcd corruption
    await masterSimulator.simulateEtcdCorruption();

    // Assert
    const corruptionDetected = await masterSimulator.detectEtcdCorruption();
    expect(corruptionDetected).toBe(true);

    // Verify recovery process
    const recoveryResult = await masterSimulator.triggerEtcdRecovery();
    expect(recoveryResult.success).toBe(true);

    // Verify cluster restored
    const clusterRestored = await masterSimulator.validateHealth();
    expect(clusterRestored).toBe(true);
  });
});
