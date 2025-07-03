// Base interface and classes for failure simulators

import type { IK8sTestClient } from "./k8s-test-client-interface";

/**
 * Base interface for all failure simulators
 * Provides common functionality following Interface Segregation Principle
 */
export interface IFailureSimulatorBase {
  cleanup(): Promise<void>;
  validateHealth(): Promise<boolean>;
}

/**
 * Common result interface for failure operations
 */
export interface IFailureResult {
  success: boolean;
  error?: string;
  details?: Record<string, unknown>;
}

/**
 * Resource metrics interface for resource exhaustion scenarios
 */
export interface IResourceMetrics {
  available: number;
  total: number;
  percentage: number;
}

/**
 * Abstract base class providing shared functionality for all failure simulators
 * Follows Single Responsibility and DRY principles
 */
export abstract class FailureSimulatorBase implements IFailureSimulatorBase {
  protected readonly k8sClient: IK8sTestClient;
  protected readonly simulatedFailures: Map<string, boolean> = new Map();

  constructor(k8sClient: IK8sTestClient) {
    this.k8sClient = k8sClient;
  }

  async cleanup(): Promise<void> {
    this.simulatedFailures.clear();
  }

  abstract validateHealth(): Promise<boolean>;

  /**
   * Shared utility method for checking if a failure is simulated
   */
  protected isFailureSimulated(failureKey: string): boolean {
    return this.simulatedFailures.get(failureKey) === true;
  }

  /**
   * Shared utility method for setting a failure state
   */
  protected setFailureState(failureKey: string, failed: boolean): void {
    if (failed) {
      this.simulatedFailures.set(failureKey, true);
    } else {
      this.simulatedFailures.delete(failureKey);
    }
  }
}
