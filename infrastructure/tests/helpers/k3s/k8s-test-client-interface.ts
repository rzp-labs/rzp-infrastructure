import * as k8s from "@kubernetes/client-node";

/**
 * Common interface for K8s test clients
 * Allows both real and mock implementations
 */
export interface IK8sTestClient {
  initialize(): Promise<void>;
  isClusterAvailable(): boolean;
  getCoreApi(): k8s.CoreV1Api;
  getAppsApi(): k8s.AppsV1Api;
  cleanup(): void;
}