import type { IK8sTestClient } from "./k8s-test-client-interface";
import type { IMasterFailureSimulator } from "./master-failure-simulator";
import { MasterFailureSimulator } from "./master-failure-simulator";
import type { INetworkFailureSimulator } from "./network-failure-simulator";
import { NetworkFailureSimulator } from "./network-failure-simulator";
import type { IResourceFailureSimulator } from "./resource-failure-simulator";
import { ResourceFailureSimulator } from "./resource-failure-simulator";
import type { IWorkerFailureSimulator } from "./worker-failure-simulator";
import { WorkerFailureSimulator } from "./worker-failure-simulator";

/**
 * Factory for creating failure simulators
 * Follows Factory Pattern and Dependency Inversion Principle
 * Single Responsibility: Create and configure failure simulators
 */
export class FailureSimulatorFactory {
  private readonly k8sClient: IK8sTestClient;

  constructor(k8sClient: IK8sTestClient) {
    this.k8sClient = k8sClient;
  }

  /**
   * Creates a master node and etcd failure simulator
   * Open/Closed: Easy to extend with new master failure types
   */
  createMasterFailureSimulator(): IMasterFailureSimulator {
    return new MasterFailureSimulator(this.k8sClient);
  }

  /**
   * Creates a network and CNI failure simulator
   * Open/Closed: Easy to extend with new network failure types
   */
  createNetworkFailureSimulator(): INetworkFailureSimulator {
    return new NetworkFailureSimulator(this.k8sClient);
  }

  /**
   * Creates a resource exhaustion failure simulator
   * Open/Closed: Easy to extend with new resource failure types
   */
  createResourceFailureSimulator(): IResourceFailureSimulator {
    return new ResourceFailureSimulator(this.k8sClient);
  }

  /**
   * Creates a worker node failure simulator
   * Open/Closed: Easy to extend with new worker failure types
   */
  createWorkerFailureSimulator(): IWorkerFailureSimulator {
    return new WorkerFailureSimulator(this.k8sClient);
  }

  /**
   * Creates all simulators at once for comprehensive testing
   * Liskov Substitution: All simulators implement their interfaces properly
   */
  createAllSimulators(): {
    masterSimulator: IMasterFailureSimulator;
    networkSimulator: INetworkFailureSimulator;
    resourceSimulator: IResourceFailureSimulator;
    workerSimulator: IWorkerFailureSimulator;
  } {
    return {
      masterSimulator: this.createMasterFailureSimulator(),
      networkSimulator: this.createNetworkFailureSimulator(),
      resourceSimulator: this.createResourceFailureSimulator(),
      workerSimulator: this.createWorkerFailureSimulator(),
    };
  }
}
