import { createK8sTestClient } from "../../../helpers/k3s/k8s-test-client-factory";
import { K8sTestClient } from "../../helpers/k3s/k8s-test-client";

describe("K8s Test Client Factory", () => {
  const originalEnv = process.env;

  beforeEach(() => {
    jest.resetModules();
    process.env = { ...originalEnv };
    jest.clearAllMocks();
  });

  afterAll(() => {
    process.env = originalEnv;
  });

  describe("createK8sTestClient", () => {
    test("should create client with default configuration", () => {
      // Act
      const client = createK8sTestClient();

      // Assert
      expect(client).toBeInstanceOf(K8sTestClient);
    });

    test("should accept custom kubeconfig", () => {
      // Arrange
      const customKubeconfig = "custom-kubeconfig-content";

      // Act
      const client = createK8sTestClient({ kubeconfig: customKubeconfig });

      // Assert
      expect(client).toBeInstanceOf(K8sTestClient);
    });

    test("should create multiple independent clients", () => {
      // Act
      const client1 = createK8sTestClient();
      const client2 = createK8sTestClient();

      // Assert
      expect(client1).toBeInstanceOf(K8sTestClient);
      expect(client2).toBeInstanceOf(K8sTestClient);
      expect(client1).not.toBe(client2);
    });

    test("should maintain SOLID principles", () => {
      // Act
      const client = createK8sTestClient();

      // Assert - Should implement the interface contract
      expect(typeof client.initialize).toBe("function");
      expect(typeof client.isClusterAvailable).toBe("function");
      expect(typeof client.getCoreApi).toBe("function");
      expect(typeof client.getAppsApi).toBe("function");
      expect(typeof client.cleanup).toBe("function");
    });
  });
});
