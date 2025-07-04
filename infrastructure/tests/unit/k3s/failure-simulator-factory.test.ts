/**
 * FailureSimulatorFactory Unit Tests - Native Pulumi Testing
 * Single Responsibility: Test FailureSimulatorFactory helper class functionality
 */

import { FailureSimulatorFactory } from "../../helpers/k3s/failure-simulator-factory";
import { MockK8sTestClient } from "../../helpers/k3s/mock-k8s-test-client";

describe("FailureSimulatorFactory", () => {
  let k8sClient: MockK8sTestClient;
  let factory: FailureSimulatorFactory;

  beforeEach(() => {
    k8sClient = new MockK8sTestClient();
    void k8sClient.initialize();

    factory = new FailureSimulatorFactory(k8sClient);
  });

  describe("Individual Simulator Creation", () => {
    test("should create master failure simulator", () => {
      // Act
      const masterSimulator = factory.createMasterFailureSimulator();

      // Assert
      expect(masterSimulator).toBeInstanceOf(Object);
      expect(typeof masterSimulator.getHealthyMasterNodes).toBe("function");
      expect(typeof masterSimulator.cleanup).toBe("function");
    });

    test("should create network failure simulator", () => {
      // Act
      const networkSimulator = factory.createNetworkFailureSimulator();

      // Assert
      expect(networkSimulator).toBeInstanceOf(Object);
      expect(typeof networkSimulator.verifyFlannelHealth).toBe("function");
      expect(typeof networkSimulator.cleanup).toBe("function");
    });

    test("should create resource failure simulator", () => {
      // Act
      const resourceSimulator = factory.createResourceFailureSimulator();

      // Assert
      expect(resourceSimulator).toBeInstanceOf(Object);
      expect(typeof resourceSimulator.verifyDiskSpace).toBe("function");
      expect(typeof resourceSimulator.cleanup).toBe("function");
    });

    test("should create worker failure simulator", () => {
      // Act
      const workerSimulator = factory.createWorkerFailureSimulator();

      // Assert
      expect(workerSimulator).toBeInstanceOf(Object);
      expect(typeof workerSimulator.getHealthyWorkerNodes).toBe("function");
      expect(typeof workerSimulator.cleanup).toBe("function");
    });
  });

  describe("Bulk Simulator Creation", () => {
    test("should create all simulators through factory", async () => {
      // Act - Create all simulators using factory
      const allSimulators = factory.createAllSimulators();

      // Assert - All simulators are created and have correct types
      expect(allSimulators.masterSimulator).toBeInstanceOf(Object);
      expect(allSimulators.networkSimulator).toBeInstanceOf(Object);
      expect(allSimulators.resourceSimulator).toBeInstanceOf(Object);
      expect(allSimulators.workerSimulator).toBeInstanceOf(Object);

      // Verify they have expected methods (interface compliance)
      expect(typeof allSimulators.masterSimulator.getHealthyMasterNodes).toBe("function");
      expect(typeof allSimulators.networkSimulator.verifyFlannelHealth).toBe("function");
      expect(typeof allSimulators.resourceSimulator.verifyDiskSpace).toBe("function");
      expect(typeof allSimulators.workerSimulator.getHealthyWorkerNodes).toBe("function");

      // Cleanup
      await allSimulators.masterSimulator.cleanup();
      await allSimulators.networkSimulator.cleanup();
      await allSimulators.resourceSimulator.cleanup();
      await allSimulators.workerSimulator.cleanup();
    });

    test("should create independent simulator instances", () => {
      // Act
      const simulators1 = factory.createAllSimulators();
      const simulators2 = factory.createAllSimulators();

      // Assert - Each call should create new instances
      expect(simulators1.masterSimulator).not.toBe(simulators2.masterSimulator);
      expect(simulators1.networkSimulator).not.toBe(simulators2.networkSimulator);
      expect(simulators1.resourceSimulator).not.toBe(simulators2.resourceSimulator);
      expect(simulators1.workerSimulator).not.toBe(simulators2.workerSimulator);
    });
  });

  describe("Constructor", () => {
    test("should create factory instance with K8sTestClient", () => {
      // Arrange
      const testClient = new MockK8sTestClient();

      // Act
      const testFactory = new FailureSimulatorFactory(testClient);

      // Assert
      expect(testFactory).toBeInstanceOf(FailureSimulatorFactory);
    });
  });

  describe("Factory Pattern Compliance", () => {
    test("should return interfaces, not concrete classes", () => {
      // Act
      const masterSim = factory.createMasterFailureSimulator();
      const networkSim = factory.createNetworkFailureSimulator();
      const resourceSim = factory.createResourceFailureSimulator();

      // Assert - Should have interface methods, not expose internal implementation
      expect("getHealthyMasterNodes" in masterSim).toBe(true);
      expect("verifyFlannelHealth" in networkSim).toBe(true);
      expect("verifyDiskSpace" in resourceSim).toBe(true);
    });
  });
});
