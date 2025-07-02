import type * as k8s from "@kubernetes/client-node";

/**
 * Single Responsibility: Manage test namespaces with isolation
 */
export class TestNamespaceManager {
  private readonly testNamespace: string;
  private namespaceCreated = false;

  constructor(
    private readonly k8sApi: k8s.CoreV1Api,
    testSuiteName?: string,
  ) {
    // Create unique namespace per test suite with timestamp
    const timestamp = Date.now();
    const suiteName = testSuiteName ?? "default";
    this.testNamespace = `test-${suiteName}-${timestamp}`;
  }

  async createTestNamespace(): Promise<string> {
    try {
      await this.k8sApi.createNamespace({
        body: {
          metadata: {
            name: this.testNamespace,
            labels: {
              "test-environment": "true",
              "auto-cleanup": "true",
            },
          },
        },
      });
      this.namespaceCreated = true;
      return this.testNamespace;
    } catch (error: unknown) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      throw new Error(`Failed to create test namespace: ${errorMessage}`);
    }
  }

  async cleanupTestNamespace(): Promise<void> {
    if (!this.namespaceCreated) {
      return;
    }

    try {
      // Delete namespace and all resources within it
      await this.k8sApi.deleteNamespace({
        name: this.testNamespace,
        gracePeriodSeconds: 0,
      });

      // Wait for namespace deletion to complete
      await this.waitForNamespaceDeletion();

      this.namespaceCreated = false;
    } catch (error: unknown) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      throw new Error(`Failed to cleanup test namespace: ${errorMessage}`);
    }
  }

  getTestNamespace(): string {
    if (!this.namespaceCreated) {
      throw new Error("Test namespace not created. Call createTestNamespace() first.");
    }
    return this.testNamespace;
  }

  async ensureCleanNamespace(): Promise<void> {
    if (this.namespaceCreated) {
      await this.cleanupTestNamespace();
    }
    await this.createTestNamespace();
  }

  private async waitForNamespaceDeletion(timeoutMs = 30000): Promise<void> {
    const startTime = Date.now();

    while (Date.now() - startTime < timeoutMs) {
      try {
        await this.k8sApi.readNamespace({
          name: this.testNamespace,
        });
        // Namespace still exists, wait a bit more
        await new Promise((resolve) => setTimeout(resolve, 1000));
      } catch (error: unknown) {
        // Namespace not found (404), deletion complete
        if (error instanceof Error && error.message.includes("NotFound")) {
          return;
        }
        // Re-throw unexpected errors
        throw error;
      }
    }

    throw new Error(`Timeout waiting for namespace ${this.testNamespace} deletion`);
  }
}
