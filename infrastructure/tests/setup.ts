/**
 * Test setup configuration
 */

import * as pulumi from "@pulumi/pulumi";

// Mock Pulumi runtime for tests
void pulumi.runtime.setMocks({
  newResource: (args: pulumi.runtime.MockResourceArgs): { id: string; state: Record<string, unknown> } => {
    const inputs = args.inputs as Record<string, unknown> & { name: string };
    return {
      id: inputs.name + "_id",
      state: inputs,
    };
  },
  call: (args: pulumi.runtime.MockCallArgs): Record<string, unknown> => {
    return args.inputs as Record<string, unknown>;
  },
});

// Extend Jest timeout for infrastructure operations
jest.setTimeout(30000);

// Ensure fake timers are available for tests that need them
jest.useFakeTimers();

// Mock environment variables for testing
process.env.PULUMI_TEST_MODE = "true";

// Global test configuration
beforeAll(() => {
  // Setup global test state if needed
});

afterAll(() => {
  // Cleanup global test state if needed
});
