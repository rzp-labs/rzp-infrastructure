import { K8sTestClient } from "../../helpers/k3s/k8s-test-client";

import { TestNamespaceManager } from "./test-namespace-manager";
import { TestResourceManager } from "./test-resource-manager";

/**
 * Single Responsibility: Manage complete test environment setup and teardown
 */
export class TestEnvironment {
  private k8sClient?: K8sTestClient;
  private namespaceManager?: TestNamespaceManager;
  private resourceManager?: TestResourceManager;
  private isInitialized = false;
  private clusterAvailable = false;

  async setup(): Promise<void> {
    // Initialize K8s client
    this.k8sClient = new K8sTestClient();
    await this.k8sClient.initialize();
    this.clusterAvailable = this.k8sClient.isClusterAvailable();

    if (this.clusterAvailable) {
      // Initialize managers only if cluster is available
      this.namespaceManager = new TestNamespaceManager(this.k8sClient.getCoreApi());
      this.resourceManager = new TestResourceManager(
        this.k8sClient.getCoreApi(),
        this.k8sClient.getAppsApi(),
        this.k8sClient.getCustomObjectsApi(),
      );

      // Create test namespace
      await this.namespaceManager.createTestNamespace();
    }

    this.isInitialized = true;
  }

  async teardown(): Promise<void> {
    const errors: Error[] = [];

    if (this.clusterAvailable) {
      try {
        // Clean up resources in reverse order
        if (this.resourceManager) {
          await this.resourceManager.cleanupAll();
        }
      } catch (error) {
        errors.push(new Error(`Resource cleanup failed: ${error}`));
      }

      try {
        if (this.namespaceManager) {
          await this.namespaceManager.cleanupTestNamespace();
        }
      } catch (error) {
        errors.push(new Error(`Namespace cleanup failed: ${error}`));
      }
    }

    try {
      if (this.k8sClient) {
        this.k8sClient.cleanup();
      }
    } catch (error) {
      errors.push(new Error(`Client cleanup failed: ${error}`));
    }

    this.isInitialized = false;
    this.clusterAvailable = false;

    if (errors.length > 0) {
      throw new Error(`Teardown errors: ${errors.map((e) => e.message).join(", ")}`);
    }
  }

  isClusterAvailable(): boolean {
    return this.clusterAvailable;
  }

  getK8sClient(): K8sTestClient {
    if (!this.isInitialized || !this.k8sClient) {
      throw new Error("Test environment not initialized. Call setup() first.");
    }
    return this.k8sClient;
  }

  getNamespaceManager(): TestNamespaceManager {
    if (!this.isInitialized || !this.namespaceManager) {
      throw new Error("Test environment not initialized. Call setup() first.");
    }
    return this.namespaceManager;
  }

  getResourceManager(): TestResourceManager {
    if (!this.isInitialized || !this.resourceManager) {
      throw new Error("Test environment not initialized. Call setup() first.");
    }
    return this.resourceManager;
  }

  isReady(): boolean {
    return this.isInitialized;
  }
}
