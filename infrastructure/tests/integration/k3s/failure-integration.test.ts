/**
 * Failure Integration Test Suite
 * Single Responsibility: Test cross-simulator integration scenarios ONLY
 */

import { FailureSimulatorFactory } from "../../helpers/k3s/failure-simulator-factory";
import { K8sTestClient } from "../../helpers/k3s/k8s-test-client";
import type { IMasterFailureSimulator } from "../../helpers/k3s/master-failure-simulator";
import type { INetworkFailureSimulator } from "../../helpers/k3s/network-failure-simulator";
import { PulumiTestSetup } from "../../helpers/k3s/pulumi-test-setup";
import type { IResourceFailureSimulator } from "../../helpers/k3s/resource-failure-simulator";

describe("Failure Integration", () => {
  let pulumiTestSetup: PulumiTestSetup;
  let k8sClient: K8sTestClient;
  let factory: FailureSimulatorFactory;
  let masterSimulator: IMasterFailureSimulator;
  let networkSimulator: INetworkFailureSimulator;
  let resourceSimulator: IResourceFailureSimulator;

  beforeEach(() => {
    pulumiTestSetup = new PulumiTestSetup();
    pulumiTestSetup.initialize();

    k8sClient = new K8sTestClient();
    void k8sClient.initialize();

    factory = new FailureSimulatorFactory(k8sClient);
    masterSimulator = factory.createMasterFailureSimulator();
    networkSimulator = factory.createNetworkFailureSimulator();
    resourceSimulator = factory.createResourceFailureSimulator();
  });

  afterEach(async () => {
    await masterSimulator.cleanup();
    await networkSimulator.cleanup();
    await resourceSimulator.cleanup();
  });

  describe("Cross-Simulator Integration", () => {
    test("should handle multiple failure types simultaneously", async () => {
      // Arrange - Set up failures across multiple simulators
      await masterSimulator.simulateEtcdCorruption();
      await networkSimulator.simulateFlannelFailure();
      await resourceSimulator.simulateDiskSpaceExhaustion();

      // Act - Check health of each simulator
      const masterHealth = await masterSimulator.validateHealth();
      const networkHealth = await networkSimulator.validateHealth();
      const resourceHealth = await resourceSimulator.validateHealth();

      // Assert - All simulators should report unhealthy state
      expect(masterHealth).toBe(false);
      expect(networkHealth).toBe(false);
      expect(resourceHealth).toBe(false);
    });

    test("should handle cascading failures across domains", async () => {
      // Arrange - Start with master failure
      await masterSimulator.simulateEtcdCorruption();

      // Act - Verify it doesn't unnecessarily cascade to other domains
      const networkHealth = await networkSimulator.validateHealth();
      const resourceHealth = await resourceSimulator.validateHealth();

      // Assert - Other domains should remain healthy (proper isolation)
      expect(networkHealth).toBe(true);
      expect(resourceHealth).toBe(true);
    });

    test("should coordinate recovery across multiple failure domains", async () => {
      // Arrange - Create failures across all domains
      await masterSimulator.simulateEtcdCorruption();
      await networkSimulator.simulateFlannelFailure();
      await resourceSimulator.simulateDiskSpaceExhaustion();

      // Act - Trigger recovery in sequence
      await masterSimulator.triggerEtcdRecovery();
      await networkSimulator.cleanup(); // Reset network state
      await resourceSimulator.cleanup(); // Reset resource state

      // Re-check health after recovery
      const masterHealth = await masterSimulator.validateHealth();
      const networkHealth = await networkSimulator.validateHealth();
      const resourceHealth = await resourceSimulator.validateHealth();

      // Assert - All domains should recover
      expect(masterHealth).toBe(true);
      expect(networkHealth).toBe(true);
      expect(resourceHealth).toBe(true);
    });

    test("should maintain simulator independence", async () => {
      // Arrange - Simulate failure in one domain only
      await masterSimulator.simulateEtcdCorruption();

      // Act - Check that other simulators are not affected
      const networkHealth = await networkSimulator.validateHealth();
      const resourceHealth = await resourceSimulator.validateHealth();
      const masterHealth = await masterSimulator.validateHealth();

      // Assert - Only master should be unhealthy
      expect(masterHealth).toBe(false);
      expect(networkHealth).toBe(true);
      expect(resourceHealth).toBe(true);
    });
  });
});
