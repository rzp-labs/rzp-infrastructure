import type * as k8s from "@kubernetes/client-node";

import type { IFailureResult, IFailureSimulatorBase } from "./failure-simulator-base";
import { FailureSimulatorBase } from "./failure-simulator-base";
import type { IK8sTestClient } from "./k8s-test-client-interface";

/**
 * Interface for master node and etcd failure simulation
 * Single Responsibility: Handle only master node and etcd related failures
 */
export interface IMasterFailureSimulator extends IFailureSimulatorBase {
  getHealthyMasterNodes(): Promise<k8s.V1Node[]>;
  simulateMasterNodeFailure(masterNode: k8s.V1Node): Promise<void>;
  attemptWorkerJoin(): Promise<IFailureResult>;
  setupMultiMasterCluster(masterCount: number): Promise<k8s.V1Node[]>;
  simulateNetworkPartition(masterNodes: k8s.V1Node[]): Promise<void>;
  detectSplitBrain(): Promise<boolean>;
  getActiveLeaders(): Promise<string[]>;
  verifyEtcdHealth(): Promise<boolean>;
  simulateEtcdCorruption(): Promise<void>;
  detectEtcdCorruption(): Promise<boolean>;
  triggerEtcdRecovery(): Promise<IFailureResult>;
}

/**
 * Master node and etcd failure simulator
 * Handles control plane related failure scenarios
 */
export class MasterFailureSimulator extends FailureSimulatorBase implements IMasterFailureSimulator {
  constructor(k8sClient: IK8sTestClient) {
    super(k8sClient);
  }

  async getHealthyMasterNodes(): Promise<k8s.V1Node[]> {
    const coreApi = this.k8sClient.getCoreApi();
    const nodesResponse = await coreApi.listNode();

    return nodesResponse.items.filter(
      (node) =>
        (node.metadata?.labels?.["node-role.kubernetes.io/control-plane"] === "true" &&
          node.status?.conditions?.some((condition) => condition.type === "Ready" && condition.status === "True")) ??
        false,
    );
  }

  async simulateMasterNodeFailure(masterNode: k8s.V1Node): Promise<void> {
    const nodeName = masterNode.metadata?.name ?? "unknown";
    this.setFailureState(`master-${nodeName}`, true);

    // Simulate node becoming unresponsive
    await this.markNodeAsNotReady(nodeName);
  }

  async attemptWorkerJoin(): Promise<IFailureResult> {
    const masterFailures = Array.from(this.simulatedFailures.keys()).filter((key) => key.startsWith("master-"));

    if (masterFailures.length > 0) {
      return {
        success: false,
        error: "connection refused: master node unavailable",
        details: { failedMasters: masterFailures },
      };
    }

    return { success: true };
  }

  async setupMultiMasterCluster(masterCount: number): Promise<k8s.V1Node[]> {
    // Mock multi-master setup
    const masters: k8s.V1Node[] = [];

    for (let i = 0; i < masterCount; i++) {
      masters.push({
        metadata: {
          name: `master-${i}`,
          labels: { "node-role.kubernetes.io/control-plane": "true" },
        },
        status: {
          conditions: [{ type: "Ready", status: "True" }],
          addresses: [{ type: "InternalIP", address: `10.10.0.${10 + i}` }],
        },
      });
    }

    return masters;
  }

  async simulateNetworkPartition(masterNodes: k8s.V1Node[]): Promise<void> {
    this.setFailureState("network-partition", true);

    // Simulate network split - half the masters on each side
    // In real implementation, would isolate these partitions
    void masterNodes; // Use parameter

    this.setFailureState("partition-1", true);
    this.setFailureState("partition-2", true);
  }

  async detectSplitBrain(): Promise<boolean> {
    return this.isFailureSimulated("network-partition");
  }

  async getActiveLeaders(): Promise<string[]> {
    if (this.isFailureSimulated("network-partition")) {
      // In split-brain, typically only one partition maintains quorum
      return ["master-0"]; // Simulate quorum maintained by first partition
    }
    return ["master-0", "master-1", "master-2"];
  }

  async verifyEtcdHealth(): Promise<boolean> {
    return !this.isFailureSimulated("etcd-corrupted");
  }

  async simulateEtcdCorruption(): Promise<void> {
    this.setFailureState("etcd-corrupted", true);
  }

  async detectEtcdCorruption(): Promise<boolean> {
    return this.isFailureSimulated("etcd-corrupted");
  }

  async triggerEtcdRecovery(): Promise<IFailureResult> {
    if (this.isFailureSimulated("etcd-corrupted")) {
      // Simulate recovery process
      this.setFailureState("etcd-corrupted", false);
      return {
        success: true,
        details: { recoveryMethod: "snapshot-restore", timeToRecover: "30s" },
      };
    }

    return { success: false, error: "No corruption detected" };
  }

  async validateHealth(): Promise<boolean> {
    const criticalFailures = ["etcd-corrupted", "network-partition"];

    const hasCriticalFailures = criticalFailures.some((failure) => this.isFailureSimulated(failure));
    const hasMasterFailures = Array.from(this.simulatedFailures.keys()).some((key) => key.startsWith("master-"));

    return !hasCriticalFailures && !hasMasterFailures;
  }

  private async markNodeAsNotReady(nodeName: string): Promise<void> {
    // In a real implementation, this would update the node status
    this.setFailureState(`node-${nodeName}-not-ready`, true);
  }
}
