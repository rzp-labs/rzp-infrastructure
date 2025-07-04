import * as command from "@pulumi/command";
import * as pulumi from "@pulumi/pulumi";

import { K3S_INSTALLATION } from "../../shared/constants";
import type { IK3sNodeConfig } from "../../shared/types";

export interface IK3sWorkerArgs {
  readonly node: IK3sNodeConfig;
  readonly sshUsername: string;
  readonly sshPrivateKey: pulumi.Input<string>;
  readonly token: pulumi.Input<string>;
  readonly masterEndpoint: string;
}

export interface IK3sWorkerResult {
  readonly installComplete: pulumi.Output<boolean>;
  readonly node: IK3sNodeConfig;
}

/**
 * K3s Worker Node Installation Component
 *
 * Responsible only for installing K3s agent on a worker node
 * and joining it to an existing cluster.
 */
export class K3sWorker extends pulumi.ComponentResource {
  public readonly result: IK3sWorkerResult;

  constructor(name: string, args: IK3sWorkerArgs, opts?: pulumi.ComponentResourceOptions) {
    super("rzp:k3s:K3sWorker", name, {}, opts);

    const installCommand = this.createInstallCommand(args);

    this.result = {
      installComplete: installCommand.stdout.apply((stdout) => stdout !== undefined),
      node: args.node,
    };

    this.registerOutputs(this.result);
  }

  private createInstallCommand(args: IK3sWorkerArgs): command.remote.Command {
    const installScript = this.buildInstallScript(args);
    const connectionConfig = this.buildConnectionConfig(args);

    return new command.remote.Command(
      `k3s-worker-install-${args.node.name}`,
      {
        connection: connectionConfig,
        create: installScript,
        delete: K3S_INSTALLATION.UNINSTALL_AGENT_CMD,
      },
      { parent: this },
    );
  }

  private buildInstallScript(args: IK3sWorkerArgs): pulumi.Output<string> {
    return pulumi.interpolate`
      echo "Waiting for cloud-init to complete..."
      cloud-init status --wait
      echo "Cloud-init completed, installing K3s agent..."
      curl -sfL ${K3S_INSTALLATION.DOWNLOAD_URL} | K3S_URL=https://${args.masterEndpoint}:${K3S_INSTALLATION.SERVER_PORT} K3S_TOKEN=${args.token} sh -
    `;
  }

  private buildConnectionConfig(args: IK3sWorkerArgs) {
    return {
      host: args.node.ip4,
      user: args.sshUsername,
      privateKey: args.sshPrivateKey,
      dialErrorLimit: 20,
      perDialTimeout: 30,
    };
  }
}
