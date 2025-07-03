import { K8sTestClient } from "../../tests/helpers/k3s/k8s-test-client";
import type { IK8sTestClient } from "../../tests/helpers/k3s/k8s-test-client-interface";
import { createK3sTunnelProvisioner } from "../../tests/helpers/k3s/pulumi-tunnel-provisioner";

/**
 * Factory for creating K8s Test Clients following ADR-003
 *
 * Provides a convenient way to create test clients that use
 * Pulumi Automation SDK for SSH tunnel provisioning instead
 * of manual secret extraction and tunnel management.
 */

export interface IK8sTestClientOptions {
  readonly kubeconfig?: string;
}

/**
 * Creates a K8s test client with the provided kubeconfig
 */
export function createK8sTestClient(options: IK8sTestClientOptions = {}): IK8sTestClient {
  return new K8sTestClient(options.kubeconfig);
}

/**
 * Creates a K8s test client for integration tests using Pulumi Automation SDK
 *
 * This implementation follows ADR-003 by using Pulumi's LocalWorkspace to provision
 * SSH tunnels as infrastructure rather than manually extracting secrets.
 */
export async function createIntegrationTestClientWithPulumiConfig(): Promise<{
  client: IK8sTestClient;
  cleanup: () => Promise<void>;
}> {
  // Use Pulumi Automation SDK to provision SSH tunnel infrastructure
  const remoteHost = "10.10.0.20"; // K3s master node IP
  const provisioner = createK3sTunnelProvisioner(remoteHost, "factory-integration-test");

  // Provision tunnel infrastructure
  const tunnelResult = await provisioner.provision();

  // Create kubeconfig that connects to localhost via the tunnel
  const kubeconfig = createTunnelKubeconfig(tunnelResult.localPort);

  const client = new K8sTestClient(kubeconfig);

  return {
    client,
    cleanup: async () => {
      client.cleanup();
      await tunnelResult.destroy();
    },
  };
}

function createTunnelKubeconfig(localPort: number): string {
  return `
apiVersion: v1
kind: Config
clusters:
- name: k3s
  cluster:
    server: https://localhost:${localPort}
    insecure-skip-tls-verify: true
contexts:
- name: k3s
  context:
    cluster: k3s
current-context: k3s
`;
}
