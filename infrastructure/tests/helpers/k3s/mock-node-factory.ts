import type { IK3sNodeConfig } from "../../../shared/types";

/**
 * Single Responsibility: Create mock node configurations for testing
 */
export class MockNodeFactory {
  createMasterNode(name = "test-master", vmId = 120): IK3sNodeConfig {
    return {
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
    };
  }

  createWorkerNode(name = "test-worker", vmId = 130): IK3sNodeConfig {
    return {
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
    };
  }

  createCredentials() {
    return {
      sshUsername: "testuser",
      sshPrivateKey: "mock-private-key",
    };
  }

  createCustomNode(overrides: Partial<IK3sNodeConfig>): IK3sNodeConfig {
    const baseNode = this.createMasterNode();
    return { ...baseNode, ...overrides };
  }
}
