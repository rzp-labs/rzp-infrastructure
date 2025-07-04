import * as command from "@pulumi/command";
import * as pulumi from "@pulumi/pulumi";

import { getProxmoxConfig } from "../../../config/base";

export interface IPulumiTunnelConfig {
  readonly remoteHost: string;
  readonly remotePort: number;
  readonly localPort: number;
  readonly stackName: string;
}

export interface IPulumiTunnelResult {
  readonly localPort: number;
  readonly destroy: () => Promise<void>;
}

/**
 * Pulumi Automation SDK-based SSH tunnel provisioner for integration tests.
 *
 * This implementation follows ADR-003 by using Pulumi's LocalWorkspace to provision
 * SSH tunnels as infrastructure rather than manually extracting secrets and managing
 * tunnels directly.
 *
 * Benefits:
 * - Reuses existing Pulumi SSH connection patterns
 * - Eliminates manual secret extraction complexity
 * - Provides proper infrastructure lifecycle management
 * - Maintains architectural consistency with K3sMaster/K3sWorker components
 */
export class PulumiTunnelProvisioner {
  private stack?: pulumi.automation.Stack;
  private readonly config: IPulumiTunnelConfig;

  constructor(config: IPulumiTunnelConfig) {
    this.config = config;
  }

  /**
   * Provisions SSH tunnel using Pulumi LocalWorkspace.
   * Uses the same SSH connection patterns as production K3s components.
   */
  async provision(): Promise<IPulumiTunnelResult> {
    const program = async () => {
      const config = getProxmoxConfig();

      // Create SSH tunnel using same patterns as K3sMaster/K3sWorker
      const tunnel = new command.remote.Command("ssh-tunnel", {
        connection: {
          host: this.config.remoteHost,
          user: config.ssh!.username!,
          privateKey: config.ssh!.privateKey!,
        },
        create: `ssh -o StrictHostKeyChecking=no -o UserKnownHostsFile=/dev/null -L ${this.config.localPort}:localhost:${this.config.remotePort} -N -f ${this.config.remoteHost}`,
        delete: `pkill -f 'ssh.*-L ${this.config.localPort}:localhost:${this.config.remotePort}'`,
      });

      return {
        localPort: pulumi.output(this.config.localPort),
        tunnelId: tunnel.id,
      };
    };

    // Create stack - use original working pattern but modify config reading
    const stack = await pulumi.automation.LocalWorkspace.createStack({
      stackName: this.config.stackName,
      projectName: "tunnel-test",
      program: program,
    });

    this.stack = stack;

    // Test stack should inherit configs from current project

    // Deploy the tunnel infrastructure
    await stack.up({ onOutput: console.log });

    return {
      localPort: this.config.localPort,
      destroy: async () => {
        if (this.stack) {
          await this.stack.destroy({ onOutput: console.log });
          await this.stack.workspace.removeStack(this.config.stackName);
        }
      },
    };
  }

  /**
   * Destroys the tunnel infrastructure.
   * Called automatically when using the IPulumiTunnelResult.destroy() method.
   */
  async destroy(): Promise<void> {
    if (this.stack) {
      await this.stack.destroy({ onOutput: console.log });
      await this.stack.workspace.removeStack(this.config.stackName);
      this.stack = undefined;
    }
  }
}

/**
 * Factory function to create a tunnel provisioner for K3s API access.
 * Uses standard K3s API port 6443 and auto-assigns local port.
 */
export function createK3sTunnelProvisioner(remoteHost: string, testName: string): PulumiTunnelProvisioner {
  // Auto-assign available port (use a random high port to avoid conflicts)
  const localPort = Math.floor(Math.random() * (65535 - 32768)) + 32768;

  return new PulumiTunnelProvisioner({
    remoteHost,
    remotePort: 6443,
    localPort,
    stackName: `k3s-tunnel-${testName}-${Date.now()}`,
  });
}
