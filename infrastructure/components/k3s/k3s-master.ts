import * as command from "@pulumi/command";
import * as pulumi from "@pulumi/pulumi";

import { K3S_INSTALLATION } from "../../shared/constants";
import type { IK3sNodeConfig } from "../../shared/types";
import { type IHealthCheckConfig, createK3sHealthCheck, createVmHealthCheck } from "../../shared/utils";

export interface IK3sMasterArgs {
  readonly node: IK3sNodeConfig;
  readonly sshUsername: string;
  readonly sshPrivateKey: pulumi.Input<string>;
  readonly isFirstMaster?: boolean;
  readonly serverEndpoint?: string;
  readonly token?: pulumi.Input<string>;
}

export interface IK3sMasterResult {
  readonly installComplete: pulumi.Output<boolean>;
  readonly node: IK3sNodeConfig;
}

/**
 * K3s Master Node Installation Component
 *
 * Responsible only for installing K3s server on a master node.
 * Does not handle credential retrieval or worker coordination.
 */
export class K3sMaster extends pulumi.ComponentResource {
  public readonly result: IK3sMasterResult;
  public readonly vmHealthCheck: command.remote.Command;
  public readonly k3sHealthCheck: command.remote.Command;

  constructor(name: string, args: IK3sMasterArgs, opts?: pulumi.ComponentResourceOptions) {
    super("rzp-infra:k3s:K3sMaster", name, {}, opts);

    // Create health check configuration
    const healthConfig: IHealthCheckConfig = {
      host: args.node.ip4,
      user: args.sshUsername,
      privateKey: pulumi.output(args.sshPrivateKey),
    };

    // Wait for VM network connectivity (indicates cloud-init network setup complete)
    const networkCheck = new command.local.Command(
      `${name}-network-check`,
      {
        create: `
          echo "Waiting for VM network connectivity at ${args.node.ip4}..."
          while ! ping -c 1 -W 5 ${args.node.ip4} > /dev/null 2>&1; do
            echo "Ping failed, waiting 5 seconds..."
            sleep 5
          done
          echo "VM network is ready, SSH should be available"
        `,
      },
      { parent: this },
    );

    // Add VM health check after network is ready
    this.vmHealthCheck = createVmHealthCheck(name, healthConfig, {
      parent: this,
      dependsOn: [networkCheck],
    });

    // Install K3s after VM is healthy
    const installCommand = this.createInstallCommand(args);

    // Add K3s health check after installation
    this.k3sHealthCheck = createK3sHealthCheck(name, healthConfig, {
      parent: this,
      dependsOn: [installCommand],
    });

    this.result = {
      installComplete: this.k3sHealthCheck.stdout.apply((stdout) => stdout !== undefined),
      node: args.node,
    };

    this.registerOutputs(this.result);
  }

  private createInstallCommand(args: IK3sMasterArgs): command.remote.Command {
    const installScript = this.buildInstallScript(args);
    const connectionConfig = this.buildConnectionConfig(args);

    return new command.remote.Command(
      `k3s-master-install-${args.node.name}`,
      {
        connection: connectionConfig,
        create: installScript,
        delete: K3S_INSTALLATION.UNINSTALL_SERVER_CMD,
      },
      {
        parent: this,
        dependsOn: [this.vmHealthCheck], // Wait for VM to be healthy before installing
      },
    );
  }

  private buildConnectionConfig(args: IK3sMasterArgs) {
    return {
      host: args.node.ip4,
      user: args.sshUsername,
      privateKey: args.sshPrivateKey,
      dialErrorLimit: 60, // Retry SSH connection up to 60 times
      perDialTimeout: 10, // 10 second timeout per attempt
    };
  }

  private buildInstallScript(args: IK3sMasterArgs): pulumi.Output<string> {
    const isFirstMaster = args.isFirstMaster ?? true;

    const k3sInstall = isFirstMaster
      ? `curl -sfL ${K3S_INSTALLATION.DOWNLOAD_URL} | sh -s - server ${K3S_INSTALLATION.SERVER_FLAGS}`
      : pulumi.interpolate`curl -sfL ${K3S_INSTALLATION.DOWNLOAD_URL} | K3S_TOKEN=${args.token} sh -s - server --server ${args.serverEndpoint} ${K3S_INSTALLATION.ADDITIONAL_SERVER_FLAGS}`;

    // Install K3s and Helm for GitOps operations
    return pulumi.interpolate`
      echo "Waiting for cloud-init to complete..."
      cloud-init status --wait
      echo "Cloud-init completed, installing K3s server..."
      ${k3sInstall}
      echo "K3s server installation completed"

      # Download and execute K3s master setup script
      echo "Downloading K3s master setup script..."
      curl -fsSL -o setup-k3s-master.sh https://raw.githubusercontent.com/rzp-labs/rzp-infrastructure/main/infrastructure/scripts/setup-k3s-master.sh
      chmod +x setup-k3s-master.sh
      
      # Execute setup script with parameters
      ./setup-k3s-master.sh \
        --username "${args.sshUsername}" \
        --node-ip "${args.node.ip4}" \
        --is-first-master "${args.isFirstMaster ?? true}"
      
      # Clean up script
      rm setup-k3s-master.sh

      echo "k3s, Helm, and kubeconfig setup completed"
    `;
  }
}
