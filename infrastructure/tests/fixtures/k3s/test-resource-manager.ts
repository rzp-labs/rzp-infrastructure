import type * as k8s from "@kubernetes/client-node";

interface ITestResource {
  type: "pod" | "service" | "deployment" | "configmap" | "secret";
  name: string;
  namespace: string;
}

/**
 * Single Responsibility: Track and cleanup test resources
 */
export class TestResourceManager {
  private readonly createdResources: ITestResource[] = [];

  constructor(
    private readonly k8sApi: k8s.CoreV1Api,
    private readonly appsApi: k8s.AppsV1Api,
  ) {}

  async createTestPod(namespace: string, name: string, spec: k8s.V1Pod["spec"]): Promise<k8s.V1Pod> {
    const pod = await this.k8sApi.createNamespacedPod({
      namespace,
      body: {
        metadata: { name },
        spec,
      },
    });

    this.trackResource("pod", name, namespace);
    return pod;
  }

  async createTestService(namespace: string, name: string, spec: k8s.V1Service["spec"]): Promise<k8s.V1Service> {
    const service = await this.k8sApi.createNamespacedService({
      namespace,
      body: {
        metadata: { name },
        spec,
      },
    });

    this.trackResource("service", name, namespace);
    return service;
  }

  async createTestDeployment(
    namespace: string,
    name: string,
    spec: k8s.V1Deployment["spec"],
  ): Promise<k8s.V1Deployment> {
    const deployment = await this.appsApi.createNamespacedDeployment({
      namespace,
      body: {
        metadata: { name },
        spec,
      },
    });

    this.trackResource("deployment", name, namespace);
    return deployment;
  }

  async createTestConfigMap(namespace: string, name: string, data: Record<string, string>): Promise<k8s.V1ConfigMap> {
    const configMap = await this.k8sApi.createNamespacedConfigMap({
      namespace,
      body: {
        metadata: { name },
        data,
      },
    });

    this.trackResource("configmap", name, namespace);
    return configMap;
  }

  async createTestSecret(namespace: string, name: string, data: Record<string, string>): Promise<k8s.V1Secret> {
    const secret = await this.k8sApi.createNamespacedSecret({
      namespace,
      body: {
        metadata: { name },
        data,
      },
    });

    this.trackResource("secret", name, namespace);
    return secret;
  }

  async waitForPodReady(namespace: string, name: string, timeoutMs = 60000): Promise<void> {
    const startTime = Date.now();

    while (Date.now() - startTime < timeoutMs) {
      try {
        const pod = await this.k8sApi.readNamespacedPod({
          name,
          namespace,
        });

        if (pod.status?.phase === "Running") {
          const readyCondition = pod.status.conditions?.find(
            (condition: { type: string; status: string }) => condition.type === "Ready",
          );

          if (readyCondition?.status === "True") {
            return;
          }
        }

        await new Promise((resolve) => setTimeout(resolve, 2000));
      } catch (error: unknown) {
        const errorMessage = error instanceof Error ? error.message : String(error);
        throw new Error(`Failed to check pod status: ${errorMessage}`);
      }
    }

    throw new Error(`Timeout waiting for pod ${name} to be ready`);
  }

  async waitForDeploymentReady(namespace: string, name: string, timeoutMs = 120000): Promise<void> {
    const startTime = Date.now();

    while (Date.now() - startTime < timeoutMs) {
      try {
        const deployment = await this.appsApi.readNamespacedDeployment({
          name,
          namespace,
        });

        const readyReplicas = deployment.status?.readyReplicas ?? 0;
        const desiredReplicas = deployment.spec?.replicas ?? 0;

        if (readyReplicas === desiredReplicas && desiredReplicas > 0) {
          return;
        }

        await new Promise((resolve) => setTimeout(resolve, 3000));
      } catch (error: unknown) {
        const errorMessage = error instanceof Error ? error.message : String(error);
        throw new Error(`Failed to check deployment status: ${errorMessage}`);
      }
    }

    throw new Error(`Timeout waiting for deployment ${name} to be ready`);
  }

  async cleanupAll(): Promise<void> {
    const errors: Error[] = [];

    // Cleanup in reverse order (deployments first, then services, then pods)
    const resourcesByType = this.groupResourcesByType();

    for (const type of ["deployment", "service", "pod", "configmap", "secret"]) {
      const resources = resourcesByType[type] ?? [];

      for (const resource of resources.reverse()) {
        try {
          await this.cleanupResource(resource);
        } catch (error: unknown) {
          const errorMessage = error instanceof Error ? error.message : String(error);
          errors.push(new Error(`Failed to cleanup ${resource.type} ${resource.name}: ${errorMessage}`));
        }
      }
    }

    this.createdResources.length = 0;

    if (errors.length > 0) {
      throw new Error(`Cleanup errors: ${errors.map((e) => e.message).join(", ")}`);
    }
  }

  getCreatedResources(): readonly ITestResource[] {
    return [...this.createdResources];
  }

  private trackResource(type: ITestResource["type"], name: string, namespace: string): void {
    this.createdResources.push({ type, name, namespace });
  }

  private groupResourcesByType(): Record<string, ITestResource[]> {
    return this.createdResources.reduce(
      (acc, resource) => {
        acc[resource.type] ??= [];
        acc[resource.type].push(resource);
        return acc;
      },
      {} as Record<string, ITestResource[]>,
    );
  }

  private async cleanupResource(resource: ITestResource): Promise<void> {
    switch (resource.type) {
      case "pod":
        await this.k8sApi.deleteNamespacedPod({
          name: resource.name,
          namespace: resource.namespace,
        });
        break;
      case "service":
        await this.k8sApi.deleteNamespacedService({
          name: resource.name,
          namespace: resource.namespace,
        });
        break;
      case "deployment":
        await this.appsApi.deleteNamespacedDeployment({
          name: resource.name,
          namespace: resource.namespace,
        });
        break;
      case "configmap":
        await this.k8sApi.deleteNamespacedConfigMap({
          name: resource.name,
          namespace: resource.namespace,
        });
        break;
      case "secret":
        await this.k8sApi.deleteNamespacedSecret({
          name: resource.name,
          namespace: resource.namespace,
        });
        break;
      default:
        throw new Error(`Unknown resource type: ${resource.type}`);
    }
  }
}
