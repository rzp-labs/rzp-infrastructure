import type * as k8s from "@kubernetes/client-node";

/**
 * Single Responsibility: Validate Kubernetes node configuration and state
 */

export class NodeValidator {
  constructor(private readonly k8sApi: k8s.CoreV1Api) {}

  async validateNodeCount(expectedCount: number): Promise<boolean> {
    const nodesResponse = await this.k8sApi.listNode();
    return nodesResponse.items.length === expectedCount;
  }

  async validateNodeRolesExist(): Promise<boolean> {
    const nodesResponse = await this.k8sApi.listNode();
    const nodes = nodesResponse.items;

    const masterNodes = nodes.filter((node) => this.isMasterNode(node));
    const workerNodes = nodes.filter((node) => !this.isMasterNode(node));

    return masterNodes.length === 1 && workerNodes.length > 0;
  }

  async validateNodesReady(): Promise<boolean> {
    const nodesResponse = await this.k8sApi.listNode();
    const nodes = nodesResponse.items;

    return nodes.every((node: k8s.V1Node) => {
      const readyCondition = node.status?.conditions?.find(
        (condition: { type: string; status: string }) => condition.type === "Ready",
      );
      return readyCondition?.status === "True";
    });
  }

  async validateAllNodesReady(): Promise<boolean> {
    return this.validateNodesReady();
  }

  async validateClusterHealth(): Promise<boolean> {
    const nodesResponse = await this.k8sApi.listNode();
    const nodes = nodesResponse.items;

    // Check if all nodes are in Ready state
    const allNodesReady = nodes.every(
      (node) =>
        node.status?.conditions?.some((condition) => condition.type === "Ready" && condition.status === "True") ??
        false,
    );

    return allNodesReady && nodes.length > 0;
  }

  async validateNodesHaveIPs(): Promise<boolean> {
    const nodesResponse = await this.k8sApi.listNode();
    const nodes = nodesResponse.items;

    return nodes.every((node) => {
      const internalIP = node.status?.addresses?.find((addr) => addr.type === "InternalIP")?.address;
      return internalIP !== undefined && internalIP !== "";
    });
  }

  private isMasterNode(node: k8s.V1Node): boolean {
    return node.metadata?.labels?.["node-role.kubernetes.io/control-plane"] === "true";
  }
}
