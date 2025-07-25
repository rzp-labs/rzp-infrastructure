/**
 * Properly typed mock implementation of @kubernetes/client-node for testing
 * Matches real Kubernetes API interfaces for type safety
 */

/* eslint-disable @typescript-eslint/naming-convention */
// These interfaces mock the Kubernetes client-node library APIs, not our own APIs

// Define proper interfaces matching Kubernetes API
interface IObjectMeta {
  name?: string;
  namespace?: string;
  labels?: Record<string, string>;
}

interface IContainer {
  name: string;
  image: string;
  ports?: Array<{ containerPort: number }>;
  command?: string[];
}

interface IPodSpec {
  containers: IContainer[];
  restartPolicy?: "Always" | "OnFailure" | "Never";
}

interface IPodStatus {
  phase?: "Pending" | "Running" | "Succeeded" | "Failed" | "Unknown";
  conditions?: Array<{ type: string; status: string }>;
}

interface IDeploymentSpec {
  replicas?: number;
  selector?: { matchLabels: Record<string, string> };
  template?: {
    metadata: { labels: Record<string, string> };
    spec: IPodSpec;
  };
}

interface IDeploymentStatus {
  replicas?: number;
  readyReplicas?: number;
  availableReplicas?: number;
  conditions?: Array<{ type: string; status: string }>;
}

interface IServiceSpec {
  selector?: Record<string, string>;
  ports?: Array<{
    port: number;
    targetPort?: number;
    protocol?: "TCP" | "UDP";
  }>;
  type?: "ClusterIP" | "NodePort" | "LoadBalancer" | "ExternalName";
}

interface INamespaceRequest {
  body: {
    metadata: IObjectMeta;
  };
}

interface INamespaceResponse {
  metadata: IObjectMeta;
}

interface IDeleteNamespaceRequest {
  name: string;
  gracePeriodSeconds?: number;
}

interface IReadNamespaceRequest {
  name: string;
}

interface IListNamespacedPodRequest {
  namespace: string;
  labelSelector?: string;
}

interface IPodResponse {
  metadata: IObjectMeta;
  status?: IPodStatus;
  spec?: IPodSpec;
}

interface IPodListResponse {
  items: IPodResponse[];
}

interface ICreatePodRequest {
  namespace: string;
  body: {
    metadata: IObjectMeta;
    spec: IPodSpec;
  };
}

interface INodeResponse {
  metadata: IObjectMeta;
  status?: {
    conditions?: Array<{ type: string; status: string }>;
    addresses?: Array<{ type: string; address: string }>;
  };
}

interface INodeListResponse {
  items: INodeResponse[];
}

export class KubeConfig {
  loadFromDefault(): void {
    // Mock implementation - no actual file loading needed
  }

  loadFromFile(_filePath: string): void {
    void _filePath; // Mock implementation - parameter unused
    // Mock implementation - no actual file loading needed
  }

  makeApiClient<T>(apiClass: { new (): T }): T {
    // Handle CustomObjectsApi separately as it's not a simple class instance
    if ((apiClass as any).name === "CustomObjectsApi") {
      return new CustomObjectsApi() as any;
    }
    return new apiClass();
  }
}

export class CoreV1Api {
  async listNode(): Promise<INodeListResponse> {
    return {
      items: [
        {
          metadata: {
            name: "master-0",
            labels: { "node-role.kubernetes.io/control-plane": "true" },
          },
          status: {
            conditions: [{ type: "Ready", status: "True" }],
            addresses: [{ type: "InternalIP", address: "10.10.0.10" }],
          },
        },
        {
          metadata: {
            name: "worker-0",
            labels: {},
          },
          status: {
            conditions: [{ type: "Ready", status: "True" }],
            addresses: [{ type: "InternalIP", address: "10.10.0.20" }],
          },
        },
      ],
    };
  }

  async createNamespace(request: INamespaceRequest): Promise<INamespaceResponse> {
    return {
      metadata: {
        name: request.body.metadata.name,
        labels: request.body.metadata.labels,
      },
    };
  }

  async deleteNamespace(request: IDeleteNamespaceRequest): Promise<Record<string, never>> {
    // Mock successful deletion
    void request.name; // Use the parameter
    return {};
  }

  async readNamespace(request: IReadNamespaceRequest): Promise<INamespaceResponse> {
    return {
      metadata: { name: request.name },
    };
  }

  async listNamespacedPod(request: IListNamespacedPodRequest): Promise<IPodListResponse> {
    void request.labelSelector; // Use parameter to avoid unused warning

    // Return different pods based on namespace to support different test scenarios
    if (request.namespace === "kube-system") {
      return {
        items: [
          {
            metadata: { name: "coredns-12345", namespace: "kube-system" },
            status: { phase: "Running" },
          },
          {
            metadata: { name: "metrics-server-67890", namespace: "kube-system" },
            status: { phase: "Running" },
          },
          {
            metadata: { name: "k3s-agent-abcde", namespace: "kube-system" },
            status: { phase: "Running" },
          },
        ],
      };
    }

    return {
      items: [
        {
          metadata: { name: "test-pod", namespace: request.namespace },
          status: { phase: "Running" },
        },
      ],
    };
  }

  async createNamespacedPod(request: ICreatePodRequest): Promise<IPodResponse> {
    return {
      metadata: {
        name: request.body.metadata.name,
        namespace: request.namespace,
      },
      spec: request.body.spec,
    };
  }

  async readNamespacedPod(request: { name: string; namespace: string }): Promise<IPodResponse> {
    return {
      metadata: { name: request.name, namespace: request.namespace },
      status: { phase: "Running" },
    };
  }

  async deleteNamespacedPod(request: { name: string; namespace: string }): Promise<Record<string, never>> {
    void request; // Use parameter
    return {};
  }

  async createNamespacedService(request: {
    namespace: string;
    body: { metadata: IObjectMeta; spec: IServiceSpec };
  }): Promise<{ metadata: IObjectMeta }> {
    return { metadata: { name: request.body.metadata.name, namespace: request.namespace } };
  }

  async readNamespacedService(request: { name: string; namespace: string }): Promise<{ metadata: IObjectMeta }> {
    return { metadata: { name: request.name, namespace: request.namespace } };
  }

  async deleteNamespacedService(request: { name: string; namespace: string }): Promise<Record<string, never>> {
    void request;
    return {};
  }

  async createNamespacedConfigMap(request: {
    namespace: string;
    body: { metadata: IObjectMeta; data?: Record<string, string> };
  }): Promise<{ metadata: IObjectMeta }> {
    return { metadata: { name: request.body.metadata.name, namespace: request.namespace } };
  }

  async deleteNamespacedConfigMap(request: { name: string; namespace: string }): Promise<Record<string, never>> {
    void request;
    return {};
  }

  async createNamespacedSecret(request: {
    namespace: string;
    body: { metadata: IObjectMeta; data?: Record<string, string> };
  }): Promise<{ metadata: IObjectMeta }> {
    return { metadata: { name: request.body.metadata.name, namespace: request.namespace } };
  }

  async deleteNamespacedSecret(request: { name: string; namespace: string }): Promise<Record<string, never>> {
    void request;
    return {};
  }

  async readNamespacedEndpoints(request: {
    name: string;
    namespace: string;
  }): Promise<{ subsets?: Array<{ addresses: Array<{ ip: string }> }> }> {
    void request;
    return { subsets: [{ addresses: [{ ip: "10.10.0.20" }] }] };
  }

  async listComponentStatus(): Promise<{ items: Array<{ metadata: IObjectMeta }> }> {
    return {
      items: [
        { metadata: { name: "controller-manager" } },
        { metadata: { name: "scheduler" } },
        { metadata: { name: "etcd-0" } },
      ],
    };
  }
}

export class CustomObjectsApi {
  async createNamespacedCustomObject(request: {
    group: string;
    version: string;
    namespace: string;
    plural: string;
    body: { metadata: IObjectMeta };
  }): Promise<{ metadata: IObjectMeta }> {
    void request.group; // Mock implementation
    void request.version;
    void request.plural;
    return { metadata: { name: request.body.metadata.name, namespace: request.namespace } };
  }

  async deleteNamespacedCustomObject(request: {
    group: string;
    version: string;
    namespace: string;
    plural: string;
    name: string;
  }): Promise<Record<string, never>> {
    void request; // Mock implementation
    return {};
  }
}

export class AppsV1Api {
  async createNamespacedDeployment(request: {
    namespace: string;
    body: { metadata: IObjectMeta; spec: IDeploymentSpec };
  }): Promise<{ metadata: IObjectMeta; spec: IDeploymentSpec; status: IDeploymentStatus }> {
    return {
      metadata: { name: request.body.metadata.name, namespace: request.namespace },
      spec: request.body.spec,
      status: { readyReplicas: 1 },
    };
  }

  async readNamespacedDeployment(request: {
    name: string;
    namespace: string;
  }): Promise<{ metadata: IObjectMeta; status: IDeploymentStatus; spec: IDeploymentSpec }> {
    return {
      metadata: { name: request.name, namespace: request.namespace },
      status: { readyReplicas: 1 },
      spec: { replicas: 1 },
    };
  }

  async deleteNamespacedDeployment(request: { name: string; namespace: string }): Promise<Record<string, never>> {
    void request;
    return {};
  }
}

// Export properly typed interfaces (must match K8s API naming)
export interface V1Node extends INodeResponse {}
export interface V1Pod extends IPodResponse {}
export interface V1Service {
  metadata: IObjectMeta;
  spec?: IServiceSpec;
}
export interface V1Deployment {
  metadata: IObjectMeta;
  spec: IDeploymentSpec;
  status: IDeploymentStatus;
}
export interface V1ConfigMap {
  metadata: IObjectMeta;
  data?: Record<string, string>;
}
export interface V1Secret {
  metadata: IObjectMeta;
  data?: Record<string, string>;
}
export interface V1Namespace extends INamespaceResponse {}
export interface V1NodeList extends INodeListResponse {}
export interface V1PodList extends IPodListResponse {}
export interface V1Endpoints {
  subsets?: Array<{ addresses: Array<{ ip: string }> }>;
}
export interface V1ComponentStatusList {
  items: Array<{ metadata: IObjectMeta }>;
}
