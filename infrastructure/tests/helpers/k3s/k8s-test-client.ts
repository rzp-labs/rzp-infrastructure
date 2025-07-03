import * as k8s from "@kubernetes/client-node";
import type { IK8sTestClient } from "./k8s-test-client-interface";

/**
 * Single Responsibility: Manage Kubernetes test client initialization and cleanup
 */
export class K8sTestClient implements IK8sTestClient {
  private kc!: k8s.KubeConfig;
  private k8sApi!: k8s.CoreV1Api;
  private k8sAppsApi!: k8s.AppsV1Api;
  private isConnected = false;

  async initialize(): Promise<void> {
    this.kc = new k8s.KubeConfig();

    try {
      // Try to load from environment or default locations
      if (process.env.KUBECONFIG) {
        this.kc.loadFromFile(process.env.KUBECONFIG);
      } else {
        this.kc.loadFromDefault();
      }

      // Test connection to verify cluster accessibility
      const tempApi = this.kc.makeApiClient(k8s.CoreV1Api);
      
      // Use listNode instead of listNamespace (more reliable across versions)
      await tempApi.listNode({});
      
      this.k8sApi = tempApi;
      this.k8sAppsApi = this.kc.makeApiClient(k8s.AppsV1Api);
      this.isConnected = true;
    } catch (error) {
      // Don't throw error - let tests handle unavailable cluster gracefully
      this.isConnected = false;
      throw new Error(`K8s cluster not accessible: ${error}`);
    }
  }

  isClusterAvailable(): boolean {
    return this.isConnected;
  }

  getCoreApi(): k8s.CoreV1Api {
    if (!this.isConnected || this.k8sApi === undefined) {
      throw new Error("K8s cluster not available. Check cluster connectivity.");
    }
    return this.k8sApi;
  }

  getAppsApi(): k8s.AppsV1Api {
    if (!this.isConnected || this.k8sAppsApi === undefined) {
      throw new Error("K8s cluster not available. Check cluster connectivity.");
    }
    return this.k8sAppsApi;
  }

  cleanup(): void {
    this.isConnected = false;
  }
}
