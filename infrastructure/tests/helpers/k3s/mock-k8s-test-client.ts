import type * as k8s from "@kubernetes/client-node";

import type { IK8sTestClient } from "./k8s-test-client-interface";

/**
 * Mock K8s Test Client for Unit Tests
 * Single Responsibility: Provide mocked Kubernetes API clients for unit testing
 */
export class MockK8sTestClient implements IK8sTestClient {
  private readonly mockCoreApi: jest.Mocked<k8s.CoreV1Api>;
  private readonly mockAppsApi: jest.Mocked<k8s.AppsV1Api>;

  constructor() {
    // Create mocked API clients with comprehensive method coverage
    this.mockCoreApi = {
      // Namespace operations
      listNamespace: jest.fn().mockResolvedValue({ items: [] }),
      createNamespace: jest.fn().mockResolvedValue({}),
      deleteNamespace: jest.fn().mockResolvedValue({}),
      readNamespace: jest.fn().mockResolvedValue({}),

      // Node operations
      listNode: jest.fn().mockResolvedValue({
        items: [
          {
            metadata: { name: "mock-master", labels: { "node-role.kubernetes.io/control-plane": "true" } },
            status: { conditions: [{ type: "Ready", status: "True" }] },
          },
          {
            metadata: { name: "mock-worker", labels: {} },
            status: { conditions: [{ type: "Ready", status: "True" }] },
          },
        ],
      }),

      // Pod operations
      listNamespacedPod: jest.fn().mockImplementation(async ({ namespace }) => {
        const mockPods = [];

        if (namespace === "kube-system") {
          // CoreDNS pods
          mockPods.push({
            metadata: { name: "coredns-123", namespace: "kube-system" },
            status: { phase: "Running" },
          });

          // Metrics server pods
          mockPods.push({
            metadata: { name: "metrics-server-456", namespace: "kube-system" },
            status: { phase: "Running" },
          });

          // K3s system pods
          mockPods.push({
            metadata: { name: "k3s-server-789", namespace: "kube-system" },
            status: { phase: "Running" },
          });
        }

        return Promise.resolve({ items: mockPods });
      }),
      createNamespacedPod: jest.fn().mockResolvedValue({}),
      deleteNamespacedPod: jest.fn().mockResolvedValue({}),
      readNamespacedPod: jest.fn().mockResolvedValue({}),

      // Service operations
      createNamespacedService: jest.fn().mockResolvedValue({}),
      deleteNamespacedService: jest.fn().mockResolvedValue({}),

      // Endpoints operations
      readNamespacedEndpoints: jest.fn().mockResolvedValue({
        subsets: [{ addresses: [{ ip: "10.0.0.1" }] }],
      }),

      // Generic pod operations
      listPod: jest.fn().mockResolvedValue({ items: [] }),
      createPod: jest.fn().mockResolvedValue({}),
      deletePod: jest.fn().mockResolvedValue({}),
      readPod: jest.fn().mockResolvedValue({}),
    } as unknown as jest.Mocked<k8s.CoreV1Api>;

    this.mockAppsApi = {
      listDeployment: jest.fn().mockResolvedValue({ items: [] }),
      listNamespacedDeployment: jest.fn().mockResolvedValue({ items: [] }),
      createDeployment: jest.fn().mockResolvedValue({}),
      createNamespacedDeployment: jest.fn().mockResolvedValue({}),
      deleteDeployment: jest.fn().mockResolvedValue({}),
      deleteNamespacedDeployment: jest.fn().mockResolvedValue({}),
      readDeployment: jest.fn().mockResolvedValue({}),
      readNamespacedDeployment: jest.fn().mockResolvedValue({}),
    } as unknown as jest.Mocked<k8s.AppsV1Api>;
  }

  async initialize(): Promise<void> {
    // Mock initialization - no actual cluster connection
    return Promise.resolve();
  }

  isClusterAvailable(): boolean {
    // Mock always returns false for unit tests
    return false;
  }

  getCoreApi(): jest.Mocked<k8s.CoreV1Api> {
    return this.mockCoreApi;
  }

  getAppsApi(): jest.Mocked<k8s.AppsV1Api> {
    return this.mockAppsApi;
  }

  cleanup(): void {
    // Mock cleanup
  }
}
