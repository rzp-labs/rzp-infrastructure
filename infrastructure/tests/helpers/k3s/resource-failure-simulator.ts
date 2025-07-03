import type { IFailureResult, IFailureSimulatorBase, IResourceMetrics } from "./failure-simulator-base";
import { FailureSimulatorBase } from "./failure-simulator-base";
import type { IK8sTestClient } from "./k8s-test-client-interface";

/**
 * Interface for resource exhaustion failure simulation
 * Single Responsibility: Handle only resource-related failures
 */
export interface IResourceFailureSimulator extends IFailureSimulatorBase {
  verifyDiskSpace(): Promise<IResourceMetrics>;
  simulateDiskSpaceExhaustion(): Promise<void>;
  isDiskSpaceExhausted(): Promise<boolean>;
  attemptEtcdWrite(): Promise<IFailureResult>;
  isClusterReadOnly(): Promise<boolean>;
  verifyMemoryAvailability(): Promise<IResourceMetrics>;
  simulateMemoryExhaustion(): Promise<void>;
  isMemoryExhausted(): Promise<boolean>;
  isOOMKillerActive(): Promise<boolean>;
  verifyContainerdHealth(): Promise<boolean>;
  simulateContainerdFailure(): Promise<void>;
  isContainerdDown(): Promise<boolean>;
  waitForContainerdRecovery(): Promise<void>;
  verifyRegistryAccess(): Promise<boolean>;
  simulateRegistryFailure(): Promise<void>;
  attemptImagePull(image: string): Promise<IFailureResult>;
  createPodWithImagePullFailure(namespace: string): Promise<void>;
}

/**
 * Resource exhaustion failure simulator
 * Handles disk, memory, and container runtime resource failures
 */
export class ResourceFailureSimulator extends FailureSimulatorBase implements IResourceFailureSimulator {
  constructor(k8sClient: IK8sTestClient) {
    super(k8sClient);
  }

  async verifyDiskSpace(): Promise<IResourceMetrics> {
    if (this.isFailureSimulated("disk-exhausted")) {
      return { available: 0, total: 10240, percentage: 100 };
    }

    return { available: 5120, total: 10240, percentage: 50 };
  }

  async simulateDiskSpaceExhaustion(): Promise<void> {
    this.setFailureState("disk-exhausted", true);
  }

  async isDiskSpaceExhausted(): Promise<boolean> {
    return this.isFailureSimulated("disk-exhausted");
  }

  async attemptEtcdWrite(): Promise<IFailureResult> {
    if (this.isFailureSimulated("disk-exhausted")) {
      return {
        success: false,
        error: "no space left on device",
      };
    }

    return { success: true };
  }

  async isClusterReadOnly(): Promise<boolean> {
    return this.isFailureSimulated("disk-exhausted");
  }

  async verifyMemoryAvailability(): Promise<IResourceMetrics> {
    if (this.isFailureSimulated("memory-exhausted")) {
      return { available: 0, total: 2048, percentage: 100 };
    }

    return { available: 1024, total: 2048, percentage: 50 };
  }

  async simulateMemoryExhaustion(): Promise<void> {
    this.setFailureState("memory-exhausted", true);
  }

  async isMemoryExhausted(): Promise<boolean> {
    return this.isFailureSimulated("memory-exhausted");
  }

  async isOOMKillerActive(): Promise<boolean> {
    return this.isFailureSimulated("memory-exhausted");
  }

  async verifyContainerdHealth(): Promise<boolean> {
    return !this.isFailureSimulated("containerd-down");
  }

  async simulateContainerdFailure(): Promise<void> {
    this.setFailureState("containerd-down", true);
  }

  async isContainerdDown(): Promise<boolean> {
    return this.isFailureSimulated("containerd-down");
  }

  async waitForContainerdRecovery(): Promise<void> {
    // Simulate automatic recovery after timeout
    await new Promise((resolve) => setTimeout(resolve, 1000));
    this.setFailureState("containerd-down", false);
  }

  async verifyRegistryAccess(): Promise<boolean> {
    return !this.isFailureSimulated("registry-unreachable");
  }

  async simulateRegistryFailure(): Promise<void> {
    this.setFailureState("registry-unreachable", true);
  }

  async attemptImagePull(image: string): Promise<IFailureResult> {
    if (this.isFailureSimulated("registry-unreachable")) {
      return {
        success: false,
        error: `pull access denied for ${image}: registry unreachable`,
      };
    }

    return { success: true };
  }

  async createPodWithImagePullFailure(namespace: string): Promise<void> {
    // Simulate creating a pod that gets stuck in ImagePullBackOff
    // This would be done by the test environment
    this.setFailureState(`pod-stuck-in-${namespace}`, true);
  }

  async validateHealth(): Promise<boolean> {
    const criticalResourceFailures = ["disk-exhausted", "memory-exhausted"];

    return !criticalResourceFailures.some((failure) => this.isFailureSimulated(failure));
  }
}
