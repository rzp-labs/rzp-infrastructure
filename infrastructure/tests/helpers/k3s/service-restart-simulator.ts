import type { IFailureSimulatorBase } from "./failure-simulator-base";
import { FailureSimulatorBase } from "./failure-simulator-base";
import type { K8sTestClient } from "./k8s-test-client";

/**
 * Operation state for tracking continuous operations
 */
interface IOperationState {
  running: boolean;
  operations: string[];
  startTime: Date;
}

/**
 * Interface for service restart failure simulation
 * Single Responsibility: Handle only service restart related failures
 */
export interface IServiceRestartSimulator extends IFailureSimulatorBase {
  startContinuousOperations(): Promise<IOperationState>;
  restartK3sService(): Promise<void>;
  wereOperationsInterrupted(): Promise<boolean>;
  waitForServiceRecovery(): Promise<void>;
  areOperationsResumed(): Promise<boolean>;
  verifyDataIntegrity(): Promise<boolean>;
  verifyKubeletHealth(): Promise<boolean>;
  restartKubeletService(): Promise<void>;
  isNodeNotReady(): Promise<boolean>;
  waitForNodeRecovery(): Promise<void>;
  areExistingPodsStillRunning(): Promise<boolean>;
}

/**
 * Service restart failure simulator
 * Handles K3s and kubelet service restart scenarios
 */
export class ServiceRestartSimulator extends FailureSimulatorBase implements IServiceRestartSimulator {
  private activeOperations: IOperationState | undefined;

  constructor(k8sClient: K8sTestClient) {
    super(k8sClient);
  }

  async startContinuousOperations(): Promise<IOperationState> {
    this.activeOperations = {
      running: true,
      operations: ["pod-creation", "service-updates", "config-changes"],
      startTime: new Date(),
    };

    return this.activeOperations;
  }

  async restartK3sService(): Promise<void> {
    this.setFailureState("k3s-restarting", true);

    // Simulate service restart disruption
    await new Promise((resolve) => setTimeout(resolve, 500));

    this.setFailureState("k3s-restarting", false);
  }

  async wereOperationsInterrupted(): Promise<boolean> {
    return this.activeOperations !== undefined;
  }

  async waitForServiceRecovery(): Promise<void> {
    await new Promise((resolve) => setTimeout(resolve, 1000));
  }

  async areOperationsResumed(): Promise<boolean> {
    return this.activeOperations?.running === true;
  }

  async verifyDataIntegrity(): Promise<boolean> {
    // Simulate data integrity check
    return !this.isFailureSimulated("data-corrupted");
  }

  async verifyKubeletHealth(): Promise<boolean> {
    return !this.isFailureSimulated("kubelet-down");
  }

  async restartKubeletService(): Promise<void> {
    this.setFailureState("kubelet-restarting", true);

    // Simulate kubelet restart - don't remove the flag immediately
    // The flag will be removed by waitForNodeRecovery()
    await new Promise((resolve) => setTimeout(resolve, 300));
  }

  async isNodeNotReady(): Promise<boolean> {
    return this.isFailureSimulated("kubelet-restarting");
  }

  async waitForNodeRecovery(): Promise<void> {
    await new Promise((resolve) => setTimeout(resolve, 2000));
    // Clear the kubelet restart flag after recovery
    this.setFailureState("kubelet-restarting", false);
  }

  async areExistingPodsStillRunning(): Promise<boolean> {
    // Kubelet restart shouldn't terminate existing pods
    return !this.isFailureSimulated("pods-terminated");
  }

  async validateHealth(): Promise<boolean> {
    const serviceFailures = ["k3s-restarting", "kubelet-restarting", "data-corrupted"];

    return !serviceFailures.some((failure) => this.isFailureSimulated(failure));
  }

  async cleanup(): Promise<void> {
    await super.cleanup();
    this.activeOperations = undefined;
  }
}
