import * as command from "@pulumi/command";
import * as pulumi from "@pulumi/pulumi";

import { K3S_INSTALLATION } from "../../shared/constants";
import type { IK3sNodeConfig } from "../../shared/types";

export interface IK3sCredentialsArgs {
  readonly masterNode: IK3sNodeConfig;
  readonly sshUsername: string;
  readonly sshPrivateKey: pulumi.Input<string>;
}

export interface IK3sCredentialsResult {
  readonly token: pulumi.Output<string>;
  readonly kubeconfig: pulumi.Output<string>;
}

/**
 * K3s Credentials Retrieval Component
 *
 * Responsible only for retrieving cluster token and kubeconfig
 * from an installed K3s master node.
 */
export class K3sCredentials extends pulumi.ComponentResource {
  public readonly result: IK3sCredentialsResult;

  constructor(name: string, args: IK3sCredentialsArgs, opts?: pulumi.ComponentResourceOptions) {
    super("rzp:k3s:K3sCredentials", name, {}, opts);

    const tokenCommand = this.createTokenCommand(args);
    const kubeconfigCommand = this.createKubeconfigCommand(args);

    this.result = {
      token: tokenCommand.stdout,
      kubeconfig: pulumi.interpolate`${kubeconfigCommand.stdout}`.apply((config) =>
        config.replace(K3S_INSTALLATION.LOCALHOST_IP, args.masterNode.ip4),
      ),
    };

    this.registerOutputs(this.result);
  }

  private createTokenCommand(args: IK3sCredentialsArgs): command.remote.Command {
    return new command.remote.Command(
      "k3s-get-token",
      {
        connection: this.createConnection(args),
        create: `sudo cat ${K3S_INSTALLATION.TOKEN_FILE_PATH}`,
      },
      { parent: this },
    );
  }

  private createKubeconfigCommand(args: IK3sCredentialsArgs): command.remote.Command {
    return new command.remote.Command(
      "k3s-get-kubeconfig",
      {
        connection: this.createConnection(args),
        create: `sudo cat ${K3S_INSTALLATION.KUBECONFIG_PATH}`,
      },
      { parent: this },
    );
  }

  private createConnection(args: IK3sCredentialsArgs) {
    return {
      host: args.masterNode.ip4,
      user: args.sshUsername,
      privateKey: args.sshPrivateKey,
    };
  }
}
