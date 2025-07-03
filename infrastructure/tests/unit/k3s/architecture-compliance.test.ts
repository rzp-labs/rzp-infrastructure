/**
 * Architecture Compliance Test Suite
 * Single Responsibility: Test architectural patterns and SOLID compliance
 */

import { FailureSimulatorFactory } from "../../helpers/k3s/failure-simulator-factory";
import { MockK8sTestClient } from "../../helpers/k3s/mock-k8s-test-client";
import { PulumiTestSetup } from "../../helpers/k3s/pulumi-test-setup";

describe("Architecture Compliance", () => {
  let pulumiTestSetup: PulumiTestSetup;
  let k8sClient: MockK8sTestClient;
  let factory: FailureSimulatorFactory;

  beforeEach(() => {
    pulumiTestSetup = new PulumiTestSetup();
    pulumiTestSetup.initialize();

    k8sClient = new MockK8sTestClient();
    void k8sClient.initialize();

    factory = new FailureSimulatorFactory(k8sClient);
  });

  describe("SOLID Principles Compliance", () => {
    test("should demonstrate proper separation of concerns between simulators", async () => {
      // Arrange - Create simulators
      const masterSimulator = factory.createMasterFailureSimulator();
      const networkSimulator = factory.createNetworkFailureSimulator();
      const resourceSimulator = factory.createResourceFailureSimulator();
      const workerSimulator = factory.createWorkerFailureSimulator();

      // Act - Get method names for each simulator
      const masterMethods = Object.getOwnPropertyNames(Object.getPrototypeOf(masterSimulator));
      const networkMethods = Object.getOwnPropertyNames(Object.getPrototypeOf(networkSimulator));
      const resourceMethods = Object.getOwnPropertyNames(Object.getPrototypeOf(resourceSimulator));
      const workerMethods = Object.getOwnPropertyNames(Object.getPrototypeOf(workerSimulator));

      // Assert - Verify no method overlap between simulators
      const masterNetworkOverlap = masterMethods.filter((method) => networkMethods.includes(method));
      const masterResourceOverlap = masterMethods.filter((method) => resourceMethods.includes(method));
      const masterWorkerOverlap = masterMethods.filter((method) => workerMethods.includes(method));
      const networkResourceOverlap = networkMethods.filter((method) => resourceMethods.includes(method));
      const networkWorkerOverlap = networkMethods.filter((method) => workerMethods.includes(method));
      const resourceWorkerOverlap = resourceMethods.filter((method) => workerMethods.includes(method));

      // Should only share common methods like 'cleanup' and constructor
      const allowedCommonMethods = ["constructor", "cleanup", "validateHealth"];

      expect(masterNetworkOverlap.every((method) => allowedCommonMethods.includes(method))).toBe(true);
      expect(masterResourceOverlap.every((method) => allowedCommonMethods.includes(method))).toBe(true);
      expect(masterWorkerOverlap.every((method) => allowedCommonMethods.includes(method))).toBe(true);
      expect(networkResourceOverlap.every((method) => allowedCommonMethods.includes(method))).toBe(true);
      expect(networkWorkerOverlap.every((method) => allowedCommonMethods.includes(method))).toBe(true);
      expect(resourceWorkerOverlap.every((method) => allowedCommonMethods.includes(method))).toBe(true);

      // Cleanup
      await masterSimulator.cleanup();
      await networkSimulator.cleanup();
      await resourceSimulator.cleanup();
      await workerSimulator.cleanup();
    });

    test("should follow Single Responsibility Principle", () => {
      // Arrange
      const masterSimulator = factory.createMasterFailureSimulator();
      const networkSimulator = factory.createNetworkFailureSimulator();
      const resourceSimulator = factory.createResourceFailureSimulator();
      const workerSimulator = factory.createWorkerFailureSimulator();

      // Act - Check that each simulator has focused responsibilities
      const masterMethods = Object.getOwnPropertyNames(Object.getPrototypeOf(masterSimulator));
      const networkMethods = Object.getOwnPropertyNames(Object.getPrototypeOf(networkSimulator));
      const resourceMethods = Object.getOwnPropertyNames(Object.getPrototypeOf(resourceSimulator));
      const workerMethods = Object.getOwnPropertyNames(Object.getPrototypeOf(workerSimulator));

      // Assert - Each simulator should have domain-specific methods
      const hasMasterSpecificMethods = masterMethods.some(
        (method) => method.includes("Master") || method.includes("etcd") || method.includes("Leader"),
      );
      const hasNetworkSpecificMethods = networkMethods.some(
        (method) => method.includes("Network") || method.includes("DNS") || method.includes("Flannel"),
      );
      const hasResourceSpecificMethods = resourceMethods.some(
        (method) => method.includes("Disk") || method.includes("Memory") || method.includes("Resource"),
      );
      const hasWorkerSpecificMethods = workerMethods.some(
        (method) => method.includes("Worker") || method.includes("Kubelet") || method.includes("Container"),
      );

      expect(hasMasterSpecificMethods).toBe(true);
      expect(hasNetworkSpecificMethods).toBe(true);
      expect(hasResourceSpecificMethods).toBe(true);
      expect(hasWorkerSpecificMethods).toBe(true);
    });

    test("should follow Dependency Inversion Principle", () => {
      // Arrange & Act - Factory should accept abstractions, not concretions
      const factoryConstructor = FailureSimulatorFactory.prototype.constructor;

      // Assert - Factory depends on K8sTestClient interface, not concrete implementation
      expect(factoryConstructor.length).toBe(1); // Should only accept one dependency

      // Verify factory methods return interfaces
      const masterSim = factory.createMasterFailureSimulator();
      const networkSim = factory.createNetworkFailureSimulator();
      const resourceSim = factory.createResourceFailureSimulator();
      const workerSim = factory.createWorkerFailureSimulator();

      // Should be able to call interface methods without knowing concrete implementation
      expect(typeof masterSim.cleanup).toBe("function");
      expect(typeof networkSim.cleanup).toBe("function");
      expect(typeof resourceSim.cleanup).toBe("function");
      expect(typeof workerSim.cleanup).toBe("function");
    });
  });

  describe("Design Pattern Compliance", () => {
    test("should implement Factory Pattern correctly", () => {
      // Act
      const simulator1 = factory.createMasterFailureSimulator();
      const simulator2 = factory.createMasterFailureSimulator();

      // Assert - Factory should create new instances each time
      expect(simulator1).not.toBe(simulator2);

      // Should create objects of expected interface
      expect(typeof simulator1.cleanup).toBe("function");
      expect(typeof simulator2.cleanup).toBe("function");
    });

    test("should follow Interface Segregation Principle", () => {
      // Arrange
      const allSimulators = factory.createAllSimulators();

      // Act & Assert - Each simulator should only expose methods relevant to its domain
      const masterSimulator = allSimulators.masterSimulator;
      const networkSimulator = allSimulators.networkSimulator;
      const resourceSimulator = allSimulators.resourceSimulator;
      const workerSimulator = allSimulators.workerSimulator;

      // Master simulator should not have network-specific methods
      expect("verifyFlannelHealth" in masterSimulator).toBe(false);
      expect("verifyDiskSpace" in masterSimulator).toBe(false);

      // Network simulator should not have master-specific methods
      expect("getHealthyMasterNodes" in networkSimulator).toBe(false);
      expect("verifyDiskSpace" in networkSimulator).toBe(false);

      // Resource simulator should not have master or network-specific methods
      expect("getHealthyMasterNodes" in resourceSimulator).toBe(false);
      expect("verifyFlannelHealth" in resourceSimulator).toBe(false);

      // Worker simulator should not have master, network, or resource-specific methods
      expect("getHealthyMasterNodes" in workerSimulator).toBe(false);
      expect("verifyFlannelHealth" in workerSimulator).toBe(false);
      expect("verifyDiskSpace" in workerSimulator).toBe(false);
    });
  });
});
