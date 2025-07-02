import * as k8s from "@kubernetes/client-node";

/**
 * Single Responsibility: Manage Kubernetes test client initialization and cleanup
 */
export class K8sTestClient {
  private kc!: k8s.KubeConfig;
  private k8sApi!: k8s.CoreV1Api;
  private k8sAppsApi!: k8s.AppsV1Api;

  async initialize(): Promise<void> {
    this.kc = new k8s.KubeConfig();

    try {
      this.kc.loadFromDefault();
    } catch (_error: unknown) {
      void _error; // Error not needed for fallback logic
      // Fallback: load from custom config file if default fails
      // Failed to load default kubeconfig, using custom config file
      this.kc.loadFromFile(process.env.KUBECONFIG ?? "~/.kube/config-k3s");
    }

    this.k8sApi = this.kc.makeApiClient(k8s.CoreV1Api);
    this.k8sAppsApi = this.kc.makeApiClient(k8s.AppsV1Api);
  }

  getCoreApi(): k8s.CoreV1Api {
    if (this.k8sApi === undefined) {
      throw new Error("K8s client not initialized. Call initialize() first.");
    }
    return this.k8sApi;
  }

  getAppsApi(): k8s.AppsV1Api {
    if (this.k8sAppsApi === undefined) {
      throw new Error("K8s client not initialized. Call initialize() first.");
    }
    return this.k8sAppsApi;
  }

  cleanup(): void {
    // Cleanup resources if needed
  }
}
