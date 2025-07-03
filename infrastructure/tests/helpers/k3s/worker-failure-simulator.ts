import type * as k8s from "@kubernetes/client-node";

import type { IFailureResult, IFailureSimulatorBase } from "./failure-simulator-base";
import { FailureSimulatorBase } from "./failure-simulator-base";
import type { IK8sTestClient } from "./k8s-test-client-interface";

/**
 * Interface for worker node failure simulation
 * Single Responsibility: Handle only worker node related failures
 */
export interface IWorkerFailureSimulator extends IFailureSimulatorBase {
  // Node lifecycle operations
  simulateWorkerJoinFailure(): Promise<IFailureResult>;
  simulateWorkerNodeLeave(): Promise<void>;
  simulateWorkerRejoin(): Promise<IFailureResult>;

  // Worker-specific service failures
  simulateKubeletFailure(): Promise<void>;
  verifyKubeletHealth(): Promise<boolean>;
  isKubeletDown(): Promise<boolean>;

  // Container runtime failures
  simulateContainerRuntimeCorruption(): Promise<void>;
  verifyContainerRuntimeHealth(): Promise<boolean>;
  isContainerRuntimeCorrupted(): Promise<boolean>;

  // Network isolation specific to workers
  simulateWorkerNetworkIsolation(): Promise<void>;
  isWorkerIsolated(): Promise<boolean>;

  // Worker capacity and scheduling
  getWorkerPodCapacity(): Promise<number>;
  simulateWorkerAtCapacity(): Promise<void>;
  isWorkerAtPodCapacity(): Promise<boolean>;

  // Worker node health
  getHealthyWorkerNodes(): Promise<k8s.V1Node[]>;
  simulateWorkerNodeFailure(workerNode: k8s.V1Node): Promise<void>;
}

/**
 * Worker node failure simulator
 * Handles worker-specific failure scenarios
 */
export class WorkerFailureSimulator extends FailureSimulatorBase implements IWorkerFailureSimulator {
  constructor(k8sClient: IK8sTestClient) {
    super(k8sClient);
  }

  async getHealthyWorkerNodes(): Promise<k8s.V1Node[]> {
    const coreApi = this.k8sClient.getCoreApi();
    const nodesResponse = await coreApi.listNode();

    return nodesResponse.items.filter(
      (node) =>
        (node.metadata?.labels?.["node-role.kubernetes.io/control-plane"] === undefined &&
          node.status?.conditions?.some((condition) => condition.type === "Ready" && condition.status === "True")) ??
        false,
    );
  }

  async simulateWorkerJoinFailure(): Promise<IFailureResult> {
    this.setFailureState("worker-join-failed", true);

    return {
      success: false,
      error: "invalid token: authentication failed",
      details: { reason: "token-invalid" },
    };
  }

  async simulateWorkerNodeLeave(): Promise<void> {
    this.setFailureState("worker-node-left", true);
  }

  async simulateWorkerRejoin(): Promise<IFailureResult> {
    if (this.isFailureSimulated("worker-node-left")) {
      this.setFailureState("worker-node-left", false);
      return { success: true, details: { rejoinTime: "10s" } };
    }

    return { success: false, error: "Node was not in left state" };
  }

  async simulateKubeletFailure(): Promise<void> {
    this.setFailureState("kubelet-down", true);
  }

  async verifyKubeletHealth(): Promise<boolean> {
    return !this.isFailureSimulated("kubelet-down");
  }

  async isKubeletDown(): Promise<boolean> {
    return this.isFailureSimulated("kubelet-down");
  }

  async simulateContainerRuntimeCorruption(): Promise<void> {
    this.setFailureState("container-runtime-corrupted", true);
  }

  async verifyContainerRuntimeHealth(): Promise<boolean> {
    return !this.isFailureSimulated("container-runtime-corrupted");
  }

  async isContainerRuntimeCorrupted(): Promise<boolean> {
    return this.isFailureSimulated("container-runtime-corrupted");
  }

  async simulateWorkerNetworkIsolation(): Promise<void> {
    this.setFailureState("worker-network-isolated", true);
  }

  async isWorkerIsolated(): Promise<boolean> {
    return this.isFailureSimulated("worker-network-isolated");
  }

  async getWorkerPodCapacity(): Promise<number> {
    // Simulate typical K3s worker node pod capacity
    return 110;
  }

  async simulateWorkerAtCapacity(): Promise<void> {
    this.setFailureState("worker-at-capacity", true);
  }

  async isWorkerAtPodCapacity(): Promise<boolean> {
    return this.isFailureSimulated("worker-at-capacity");
  }

  async simulateWorkerNodeFailure(workerNode: k8s.V1Node): Promise<void> {
    const nodeName = workerNode.metadata?.name ?? "unknown";
    this.setFailureState(`worker-${nodeName}`, true);
  }

  async validateHealth(): Promise<boolean> {
    const criticalWorkerFailures = ["kubelet-down", "container-runtime-corrupted", "worker-network-isolated"];

    const hasCriticalFailures = criticalWorkerFailures.some((failure) => this.isFailureSimulated(failure));

    const hasWorkerNodeFailures = Array.from(this.simulatedFailures.keys()).some((key) => key.startsWith("worker-"));

    return !hasCriticalFailures && !hasWorkerNodeFailures;
  }
}
