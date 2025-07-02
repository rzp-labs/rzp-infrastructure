import * as pulumi from "@pulumi/pulumi";

/**
 * Single Responsibility: Setup and manage Pulumi test mocking
 */
export class PulumiTestSetup {
  initialize(): void {
    void pulumi.runtime.setMocks({
      newResource: this.createMockResource,
      call: this.createMockCall,
    });
  }

  private createMockResource(args: pulumi.runtime.MockResourceArgs): pulumi.runtime.MockResourceResult {
    const inputs = args.inputs as Record<string, unknown> & { name: string };
    return {
      id: `${inputs.name}_id`,
      state: inputs,
    };
  }

  private createMockCall(_args: pulumi.runtime.MockCallArgs): pulumi.runtime.MockCallResult {
    void _args; // Mock implementation doesn't need arguments
    return { outputs: {} };
  }
}
