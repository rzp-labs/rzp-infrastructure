import * as pulumi from "@pulumi/pulumi";

import { K3sWorker } from "../../../components/k3s/k3s-worker";
import type { IK3sNodeConfig } from "../../../shared/types";

/**
 * K3sWorker Component - Native Pulumi Testing
 *
 * Following official Pulumi testing patterns with proper dependency mocking
 */

// Set up Pulumi mocks FIRST
void pulumi.runtime.setMocks({
  newResource: (args: pulumi.runtime.MockResourceArgs): pulumi.runtime.MockResourceResult => {
    return {
      id: `${args.name}-mock-id`,
      state: args.inputs as Record<string, unknown>,
    };
  },
  call: (args: pulumi.runtime.MockCallArgs): pulumi.runtime.MockCallResult => {
    return { outputs: args.inputs as Record<string, unknown> };
  },
});

/**
 * Single Responsibility: Test K3sWorker component only
 */
describe("K3sWorker Component", () => {
  // Helper functions for creating test data (replacing MockNodeFactory)
  const createWorkerNode = (name = "test-worker", vmId = 130): IK3sNodeConfig => ({
    vmId,
    name,
    ip4: "10.10.0.30",
    ip6: "fd00:10:10::30",
    role: "worker",
    roleIndex: 0,
    resources: {
      cores: 2,
      memory: 2048,
      osDiskSize: 20,
      dataDiskSize: 60,
    },
  });

  const createCredentials = () => ({
    sshUsername: "testuser",
    sshPrivateKey: "mock-private-key",
  });

  test("should create worker component with valid configuration", async () => {
    // Arrange
    const workerNode = createWorkerNode();
    const credentials = createCredentials();
    const workerConfig = {
      node: workerNode,
      ...credentials,
      token: "mock-token",
      masterEndpoint: "10.10.0.20",
    };

    // Act
    const worker = new K3sWorker("test-worker", workerConfig);
    const result = worker.result.installComplete;

    // Assert
    expect(worker).toBeInstanceOf(K3sWorker);
    expect(result).toBeDefined();
  });

  test("should handle multiple worker configurations", async () => {
    // Arrange
    const worker1Node = createWorkerNode("worker-1", 130);
    const worker2Node = createWorkerNode("worker-2", 131);
    const credentials = createCredentials();

    const worker1Config = {
      node: worker1Node,
      ...credentials,
      token: "mock-token-1",
      masterEndpoint: "10.10.0.20",
    };

    const worker2Config = {
      node: worker2Node,
      ...credentials,
      token: "mock-token-2",
      masterEndpoint: "10.10.0.20",
    };

    // Act
    const k3sWorker1 = new K3sWorker("test-worker-1", worker1Config);
    const k3sWorker2 = new K3sWorker("test-worker-2", worker2Config);

    // Assert
    expect(k3sWorker1).toBeInstanceOf(K3sWorker);
    expect(k3sWorker2).toBeInstanceOf(K3sWorker);
  });

  test("should handle different master endpoints", async () => {
    // Arrange
    const workerNode = createWorkerNode();
    const credentials = createCredentials();
    const workerConfig = {
      node: workerNode,
      ...credentials,
      token: "mock-token",
      masterEndpoint: "10.10.0.100", // Different master IP
    };

    // Act
    const worker = new K3sWorker("test-worker-ha", workerConfig);

    // Assert
    expect(worker).toBeInstanceOf(K3sWorker);
  });
});
