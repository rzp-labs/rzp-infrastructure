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
    super("custom:k3s:K3sWorker", name, {}, opts);

    const installCommand = this.createInstallCommand(args);

    this.result = {
      installComplete: installCommand.stdout.apply(() => true),
      node: args.node,
    };

    this.registerOutputs(this.result);
  }

  private createInstallCommand(args: IK3sWorkerArgs): command.remote.Command {
    const installScript = pulumi.interpolate`curl -sfL ${K3S_INSTALLATION.DOWNLOAD_URL} | K3S_URL=https://${args.masterEndpoint}:${K3S_INSTALLATION.SERVER_PORT} K3S_TOKEN=${args.token} sh -`;

    return new command.remote.Command(
      `k3s-worker-install-${args.node.name}`,
      {
        connection: {
          host: args.node.ip4,
          user: args.sshUsername,
          privateKey: args.sshPrivateKey,
        },
        create: installScript,
        delete: K3S_INSTALLATION.UNINSTALL_AGENT_CMD,
      },
      { parent: this },
    );
  }
}
