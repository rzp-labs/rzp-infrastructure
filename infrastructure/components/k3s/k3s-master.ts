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
    super("rzp:k3s:K3sMaster", name, {}, opts);

    // Create health check configuration
    const healthConfig: IHealthCheckConfig = {
      host: args.node.ip4,
      user: args.sshUsername,
      privateKey: pulumi.output(args.sshPrivateKey),
    };

    // Add VM health check to wait for cloud-init and networking
    this.vmHealthCheck = createVmHealthCheck(name, healthConfig, { parent: this });

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
      dialErrorLimit: 20, // Retry SSH connection up to 20 times
      perDialTimeout: 30, // 30 second timeout per attempt
    };
  }

  private buildInstallScript(args: IK3sMasterArgs): string {
    const isFirstMaster = args.isFirstMaster ?? true;

    const k3sInstall = isFirstMaster
      ? `curl -sfL ${K3S_INSTALLATION.DOWNLOAD_URL} | sh -s - server ${K3S_INSTALLATION.SERVER_FLAGS}`
      : `curl -sfL ${K3S_INSTALLATION.DOWNLOAD_URL} | sh -s - server --server ${args.serverEndpoint} ${K3S_INSTALLATION.ADDITIONAL_SERVER_FLAGS}`;

    // Install K3s (cloud-init completion is handled by VM health check)
    return `
      echo "Installing K3s server..."
      ${k3sInstall}
      echo "K3s server installation completed"
    `;
  }
}
