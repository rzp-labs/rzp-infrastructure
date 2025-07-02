import type * as k8s from "@kubernetes/client-node";

/**
 * Single Responsibility: Validate pod states and existence
 */
export class PodValidator {
  constructor(private readonly k8sApi: k8s.CoreV1Api) {}

  async validatePodsRunning(namespace: string, namePrefix: string): Promise<boolean> {
    const podsResponse = await this.k8sApi.listNamespacedPod({
      namespace,
    });
    const pods = podsResponse.items;

    const matchingPods = pods.filter((pod: k8s.V1Pod) => Boolean(pod.metadata?.name?.startsWith(namePrefix)));

    if (matchingPods.length === 0) {
      return false;
    }

    return matchingPods.every((pod: k8s.V1Pod) => pod.status?.phase === "Running");
  }

  async validatePodsAbsent(namespace: string, namePattern: string): Promise<boolean> {
    const podsResponse = await this.k8sApi.listNamespacedPod({
      namespace,
    });
    const pods = podsResponse.items;

    const matchingPods = pods.filter((pod: k8s.V1Pod) => Boolean(pod.metadata?.name?.includes(namePattern)));

    return matchingPods.length === 0;
  }

  async getPodsByPrefix(namespace: string, namePrefix: string): Promise<k8s.V1Pod[]> {
    const podsResponse = await this.k8sApi.listNamespacedPod({
      namespace,
    });
    const pods = podsResponse.items;

    return pods.filter((pod: k8s.V1Pod) => Boolean(pod.metadata?.name?.startsWith(namePrefix)));
  }
}
