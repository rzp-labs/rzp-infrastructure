/**
 * NodeValidator Unit Tests - Native Pulumi Testing
 * Single Responsibility: Test NodeValidator helper class functionality
 */

import { MockK8sTestClient } from "../../helpers/k3s/mock-k8s-test-client";
import { NodeValidator } from "../../helpers/k3s/node-validator";

describe("NodeValidator", () => {
  let k8sClient: MockK8sTestClient;
  let nodeValidator: NodeValidator;

  beforeEach(() => {
    k8sClient = new MockK8sTestClient();
    void k8sClient.initialize();

    nodeValidator = new NodeValidator(k8sClient.getCoreApi());
  });

  describe("API Methods", () => {
    test("should have validateAllNodesReady method that returns boolean", async () => {
      // Act - This should not throw an error
      const allNodesReady = await nodeValidator.validateAllNodesReady();

      // Assert - Method exists and returns expected type
      expect(typeof allNodesReady).toBe("boolean");
    });

    test("should have validateNodesReady method that returns boolean", async () => {
      // Act
      const nodesReady = await nodeValidator.validateNodesReady();

      // Assert
      expect(typeof nodesReady).toBe("boolean");
    });

    test("should have validateNodeCount method that returns boolean", async () => {
      // Act
      const nodeCount = await nodeValidator.validateNodeCount(1);

      // Assert
      expect(typeof nodeCount).toBe("boolean");
    });

    test("should have validateClusterHealth method that returns boolean", async () => {
      // Act
      const clusterHealth = await nodeValidator.validateClusterHealth();

      // Assert
      expect(typeof clusterHealth).toBe("boolean");
    });
  });

  describe("Method Relationships", () => {
    test("validateAllNodesReady should delegate to validateNodesReady", async () => {
      // Arrange - spy on validateNodesReady
      const validateNodesReadySpy = jest.spyOn(nodeValidator, "validateNodesReady");
      validateNodesReadySpy.mockResolvedValue(true);

      // Act
      const result = await nodeValidator.validateAllNodesReady();

      // Assert
      expect(validateNodesReadySpy).toHaveBeenCalled();
      expect(result).toBe(true);

      // Cleanup
      validateNodesReadySpy.mockRestore();
    });
  });

  describe("Constructor", () => {
    test("should create NodeValidator instance with CoreV1Api", () => {
      // Arrange
      const coreApi = k8sClient.getCoreApi();

      // Act
      const validator = new NodeValidator(coreApi);

      // Assert
      expect(validator).toBeInstanceOf(NodeValidator);
    });
  });
});
