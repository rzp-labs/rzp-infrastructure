import type { IFailureResult, IFailureSimulatorBase } from "./failure-simulator-base";
import { FailureSimulatorBase } from "./failure-simulator-base";
import type { IK8sTestClient } from "./k8s-test-client-interface";

/**
 * Interface for network and CNI failure simulation
 * Single Responsibility: Handle only network-related failures
 */
export interface INetworkFailureSimulator extends IFailureSimulatorBase {
  verifyFlannelHealth(): Promise<boolean>;
  simulateFlannelFailure(): Promise<void>;
  isNetworkingDown(): Promise<boolean>;
  testPodToPodCommunication(): Promise<IFailureResult>;
  testDNSResolution(): Promise<IFailureResult>;
  verifyCNIConfiguration(): Promise<boolean>;
  corruptCNIConfiguration(): Promise<void>;
  isCNIConfigurationCorrupted(): Promise<boolean>;
  simulateCoreDNSCrashloop(): Promise<void>;
  isPodInCrashloop(namespace: string, podName: string): Promise<boolean>;
  testClusterDNS(): Promise<boolean>;
  testServiceDiscovery(): Promise<boolean>;
  simulateMetricsServerFailure(): Promise<void>;
  isMetricsServerDown(): Promise<boolean>;
  testHorizontalPodAutoscaler(): Promise<boolean>;
  testKubectlTopCommands(): Promise<IFailureResult>;
  attemptPodCreation(): Promise<IFailureResult>;
}

/**
 * Network and CNI failure simulator
 * Handles networking, DNS, and pod communication failures
 */
export class NetworkFailureSimulator extends FailureSimulatorBase implements INetworkFailureSimulator {
  constructor(k8sClient: IK8sTestClient) {
    super(k8sClient);
  }

  async verifyFlannelHealth(): Promise<boolean> {
    return !this.isFailureSimulated("flannel-down");
  }

  async simulateFlannelFailure(): Promise<void> {
    this.setFailureState("flannel-down", true);
  }

  async isNetworkingDown(): Promise<boolean> {
    return this.isFailureSimulated("flannel-down");
  }

  async testPodToPodCommunication(): Promise<IFailureResult> {
    if (this.isFailureSimulated("flannel-down")) {
      return {
        success: false,
        error: "network unreachable: CNI plugin failure",
      };
    }

    return { success: true };
  }

  async testDNSResolution(): Promise<IFailureResult> {
    if (this.isFailureSimulated("flannel-down") || this.isFailureSimulated("coredns-crashloop")) {
      return {
        success: false,
        error: "DNS resolution failed",
      };
    }

    return { success: true };
  }

  async verifyCNIConfiguration(): Promise<boolean> {
    return !this.isFailureSimulated("cni-config-corrupted");
  }

  async corruptCNIConfiguration(): Promise<void> {
    this.setFailureState("cni-config-corrupted", true);
  }

  async isCNIConfigurationCorrupted(): Promise<boolean> {
    return this.isFailureSimulated("cni-config-corrupted");
  }

  async simulateCoreDNSCrashloop(): Promise<void> {
    this.setFailureState("coredns-crashloop", true);
  }

  async isPodInCrashloop(namespace: string, podName: string): Promise<boolean> {
    return this.isFailureSimulated(`${podName}-crashloop`);
  }

  async testClusterDNS(): Promise<boolean> {
    return !this.isFailureSimulated("coredns-crashloop");
  }

  async testServiceDiscovery(): Promise<boolean> {
    return !this.isFailureSimulated("coredns-crashloop");
  }

  async simulateMetricsServerFailure(): Promise<void> {
    this.setFailureState("metrics-server-down", true);
  }

  async isMetricsServerDown(): Promise<boolean> {
    return this.isFailureSimulated("metrics-server-down");
  }

  async testHorizontalPodAutoscaler(): Promise<boolean> {
    return !this.isFailureSimulated("metrics-server-down");
  }

  async testKubectlTopCommands(): Promise<IFailureResult> {
    if (this.isFailureSimulated("metrics-server-down")) {
      return {
        success: false,
        error: "metrics not available: metrics-server unreachable",
      };
    }

    return { success: true };
  }

  async attemptPodCreation(): Promise<IFailureResult> {
    if (this.isFailureSimulated("containerd-down")) {
      return {
        success: false,
        error: "runtime not ready: containerd service unavailable",
      };
    }

    if (this.isFailureSimulated("cni-config-corrupted")) {
      return {
        success: false,
        error: "network setup failed: CNI configuration corrupted",
      };
    }

    return { success: true };
  }

  async validateHealth(): Promise<boolean> {
    const criticalNetworkFailures = ["flannel-down", "cni-config-corrupted", "coredns-crashloop"];

    return !criticalNetworkFailures.some((failure) => this.isFailureSimulated(failure));
  }
}
