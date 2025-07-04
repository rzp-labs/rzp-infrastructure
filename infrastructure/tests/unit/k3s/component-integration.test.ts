import * as pulumi from "@pulumi/pulumi";

import { K3sCredentials } from "../../../components/k3s/k3s-credentials";
import { K3sMaster } from "../../../components/k3s/k3s-master";
import { K3sWorker } from "../../../components/k3s/k3s-worker";
import type { IK3sNodeConfig } from "../../../shared/types";

/**
 * Component Integration - Native Pulumi Testing
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
 * Single Responsibility: Test component integration and dependency chains
 */
describe("Component Integration", () => {
  // Helper functions for creating test data (replacing MockNodeFactory)
  const createMasterNode = (name = "test-master", vmId = 120): IK3sNodeConfig => ({
    vmId,
    name,
    ip4: "10.10.0.20",
    ip6: "fd00:10:10::20",
    role: "master",
    roleIndex: 0,
    resources: {
      cores: 2,
      memory: 2048,
      osDiskSize: 20,
      dataDiskSize: 60,
    },
  });

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

  test("should create complete dependency chain", async () => {
    // Arrange
    const masterNode = createMasterNode();
    const workerNode = createWorkerNode();
    const credentials = createCredentials();

    const masterConfig = {
      node: masterNode,
      ...credentials,
      isFirstMaster: true,
    };

    const credentialsConfig = {
      masterNode,
      ...credentials,
    };

    // Act
    const master = new K3sMaster("integration-master", masterConfig);
    const k3sCredentials = new K3sCredentials("integration-credentials", credentialsConfig);

    const workerConfig = {
      node: workerNode,
      ...credentials,
      token: k3sCredentials.result.token,
      masterEndpoint: masterNode.ip4,
    };
    const worker = new K3sWorker("integration-worker", workerConfig);

    // Assert
    expect(master).toBeInstanceOf(K3sMaster);
    expect(k3sCredentials).toBeInstanceOf(K3sCredentials);
    expect(worker).toBeInstanceOf(K3sWorker);
  });

  test("should handle multi-master setup", async () => {
    // Arrange
    const master1 = createMasterNode("master-1", 120);
    const master2 = createMasterNode("master-2", 121);
    const credentials = createCredentials();

    const master1Config = {
      node: master1,
      ...credentials,
      isFirstMaster: true,
    };

    const master2Config = {
      node: master2,
      ...credentials,
      isFirstMaster: false,
      serverEndpoint: `https://${master1.ip4}:6443`,
    };

    // Act
    const k3sMaster1 = new K3sMaster("multi-master-1", master1Config);
    const k3sMaster2 = new K3sMaster("multi-master-2", master2Config);

    // Assert
    expect(k3sMaster1).toBeInstanceOf(K3sMaster);
    expect(k3sMaster2).toBeInstanceOf(K3sMaster);
  });
});
