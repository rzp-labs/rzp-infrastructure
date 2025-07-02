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

  async validateNodeRoles(expectedRoles: Record<string, string>): Promise<boolean> {
    const nodesResponse = await this.k8sApi.listNode();
    const nodes = nodesResponse.items;

    for (const [role, expectedName] of Object.entries(expectedRoles)) {
      const node = this.findNodeByRole(nodes, role);
      if (!node || node.metadata?.name !== expectedName) {
        return false;
      }
    }

    return true;
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

  async validateNodeIPs(expectedIPs: Record<string, string>): Promise<boolean> {
    const nodesResponse = await this.k8sApi.listNode();
    const nodes = nodesResponse.items;

    for (const [nodeName, expectedIP] of Object.entries(expectedIPs)) {
      const node = nodes.find((n: k8s.V1Node) => n.metadata?.name === nodeName);
      if (!node) return false;

      const actualIP = node.status?.addresses?.find(
        (addr: { type: string; address: string }) => addr.type === "InternalIP",
      )?.address;

      if (actualIP === undefined || actualIP === "" || actualIP !== expectedIP) return false;
    }

    return true;
  }

  private findNodeByRole(nodes: k8s.V1Node[], role: string): k8s.V1Node | undefined {
    if (role === "master") {
      return nodes.find((node) => node.metadata?.labels?.["node-role.kubernetes.io/control-plane"] === "true");
    } else if (role === "worker") {
      return nodes.find((node) => node.metadata?.labels?.["node-role.kubernetes.io/control-plane"] === undefined);
    }
    return undefined;
  }
}
