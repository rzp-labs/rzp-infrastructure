import { MockNodeFactory } from "../../helpers/k3s/mock-node-factory";
import { PulumiTestSetup } from "../../helpers/k3s/pulumi-test-setup";

/**
 * Single Responsibility: Manage Pulumi test environment with proper fixtures
 */
export class PulumiTestEnvironment {
  private pulumiSetup?: PulumiTestSetup;
  private mockFactory?: MockNodeFactory;
  private isInitialized = false;

  async setup(): Promise<void> {
    try {
      this.pulumiSetup = new PulumiTestSetup();
      this.pulumiSetup.initialize();

      this.mockFactory = new MockNodeFactory();

      this.isInitialized = true;
    } catch (error) {
      await this.teardown();
      throw new Error(`Failed to setup Pulumi test environment: ${error}`);
    }
  }

  async teardown(): Promise<void> {
    // Pulumi test environment doesn't need active cleanup
    // but we reset the state for isolation
    this.isInitialized = false;
    this.pulumiSetup = undefined;
    this.mockFactory = undefined;
  }

  getPulumiSetup(): PulumiTestSetup {
    if (!this.isInitialized || !this.pulumiSetup) {
      throw new Error("Pulumi test environment not initialized. Call setup() first.");
    }
    return this.pulumiSetup;
  }

  getMockFactory(): MockNodeFactory {
    if (!this.isInitialized || !this.mockFactory) {
      throw new Error("Pulumi test environment not initialized. Call setup() first.");
    }
    return this.mockFactory;
  }

  isReady(): boolean {
    return this.isInitialized;
  }
}
