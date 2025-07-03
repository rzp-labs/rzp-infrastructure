import * as command from "@pulumi/command";
import * as pulumi from "@pulumi/pulumi";

import { K3S_INSTALLATION } from "../../shared/constants";
import type { IK3sNodeConfig } from "../../shared/types";

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

  constructor(name: string, args: IK3sMasterArgs, opts?: pulumi.ComponentResourceOptions) {
    super("rzp:k3s:K3sMaster", name, {}, opts);

    const installCommand = this.createInstallCommand(args);

    this.result = {
      installComplete: installCommand.stdout.apply((stdout) => stdout !== undefined),
      node: args.node,
    };

    this.registerOutputs(this.result);
  }

  private createInstallCommand(args: IK3sMasterArgs): command.remote.Command {
    const isFirstMaster = args.isFirstMaster ?? true;

    const installScript = isFirstMaster
      ? `curl -sfL ${K3S_INSTALLATION.DOWNLOAD_URL} | sh -s - server ${K3S_INSTALLATION.SERVER_FLAGS}`
      : `curl -sfL ${K3S_INSTALLATION.DOWNLOAD_URL} | sh -s - server --server ${args.serverEndpoint} ${K3S_INSTALLATION.ADDITIONAL_SERVER_FLAGS}`;

    return new command.remote.Command(
      `k3s-master-install-${args.node.name}`,
      {
        connection: {
          host: args.node.ip4,
          user: args.sshUsername,
          privateKey: args.sshPrivateKey,
        },
        create: installScript,
        delete: K3S_INSTALLATION.UNINSTALL_SERVER_CMD,
      },
      { parent: this },
    );
  }
}
