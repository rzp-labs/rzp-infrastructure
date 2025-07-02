/**
 * K3s installation and cluster setup component
 */

import * as command from "@pulumi/command";
import * as pulumi from "@pulumi/pulumi";

import { K3S_INSTALLATION } from "../../shared/constants";
import type { IK3sNodeConfig } from "../../shared/types";

interface IK3sInstallerArgs {
  readonly masterNodes: IK3sNodeConfig[];
  readonly workerNodes: IK3sNodeConfig[];
  readonly sshPrivateKey: pulumi.Output<string>;
  readonly sshUsername: string;
}

interface IK3sInstallResult {
  readonly masterInstalled: command.remote.Command[];
  readonly workersInstalled: command.remote.Command[];
  readonly kubeconfig: pulumi.Output<string>;
}

export class K3sInstaller extends pulumi.ComponentResource {
  public readonly result: IK3sInstallResult;

  constructor(name: string, args: IK3sInstallerArgs, opts?: pulumi.ComponentResourceOptions) {
    super("custom:k3s:K3sInstaller", name, {}, opts);

    const masterInstalled = this.installMasters(args);
    const clusterToken = this.getClusterToken(args, masterInstalled[0]);
    const workersInstalled = this.installWorkers(args, clusterToken, masterInstalled);
    const kubeconfig = this.getKubeconfig(args, masterInstalled[0]);

    this.result = { masterInstalled, workersInstalled, kubeconfig };
    this.registerOutputs(this.result);
  }

  private installMasters(args: IK3sInstallerArgs): command.remote.Command[] {
    return args.masterNodes.map((master, index) => this.createMasterInstallCommand(master, index, args));
  }

  private createMasterInstallCommand(
    master: IK3sNodeConfig,
    index: number,
    args: IK3sInstallerArgs,
  ): command.remote.Command {
    const isFirstMaster = index === 0;
    const installScript = isFirstMaster
      ? `curl -sfL ${K3S_INSTALLATION.DOWNLOAD_URL} | sh -s - server ${K3S_INSTALLATION.SERVER_FLAGS}`
      : pulumi.interpolate`curl -sfL ${K3S_INSTALLATION.DOWNLOAD_URL} | sh -s - server --server https://${args.masterNodes[0].ip4}:${K3S_INSTALLATION.SERVER_PORT} ${K3S_INSTALLATION.ADDITIONAL_SERVER_FLAGS}`;

    return new command.remote.Command(
      `k3s-master-install-${master.name}`,
      {
        connection: this.createConnection(master.ip4, args),
        create: installScript,
        delete: K3S_INSTALLATION.UNINSTALL_SERVER_CMD,
      },
      { parent: this },
    );
  }

  private getClusterToken(args: IK3sInstallerArgs, masterInstall: command.remote.Command): pulumi.Output<string> {
    const tokenCommand = new command.remote.Command(
      "k3s-get-token",
      {
        connection: this.createConnection(args.masterNodes[0].ip4, args),
        create: `sudo cat ${K3S_INSTALLATION.TOKEN_FILE_PATH}`,
      },
      { parent: this, dependsOn: [masterInstall] },
    );
    return tokenCommand.stdout;
  }

  private installWorkers(
    args: IK3sInstallerArgs,
    clusterToken: pulumi.Output<string>,
    masterInstalls: command.remote.Command[],
  ): command.remote.Command[] {
    return args.workerNodes.map((worker) =>
      this.createWorkerInstallCommand({ worker, args, clusterToken }, masterInstalls),
    );
  }

  private createWorkerInstallCommand(
    config: {
      worker: IK3sNodeConfig;
      args: IK3sInstallerArgs;
      clusterToken: pulumi.Output<string>;
    },
    masterInstalls: command.remote.Command[],
  ): command.remote.Command {
    const installScript = pulumi.interpolate`curl -sfL ${K3S_INSTALLATION.DOWNLOAD_URL} | K3S_URL=https://${config.args.masterNodes[0].ip4}:${K3S_INSTALLATION.SERVER_PORT} K3S_TOKEN=${config.clusterToken} sh -`;

    return new command.remote.Command(
      `k3s-worker-install-${config.worker.name}`,
      {
        connection: this.createConnection(config.worker.ip4, config.args),
        create: installScript,
        delete: K3S_INSTALLATION.UNINSTALL_AGENT_CMD,
      },
      { parent: this, dependsOn: masterInstalls },
    );
  }

  private getKubeconfig(args: IK3sInstallerArgs, masterInstall: command.remote.Command): pulumi.Output<string> {
    const kubeconfigCommand = new command.remote.Command(
      "k3s-get-kubeconfig",
      {
        connection: this.createConnection(args.masterNodes[0].ip4, args),
        create: `sudo cat ${K3S_INSTALLATION.KUBECONFIG_PATH}`,
      },
      { parent: this, dependsOn: [masterInstall] },
    );

    return kubeconfigCommand.stdout.apply((config) =>
      config.replace(K3S_INSTALLATION.LOCALHOST_IP, args.masterNodes[0].ip4),
    );
  }

  private createConnection(host: string, args: IK3sInstallerArgs) {
    return {
      host,
      user: args.sshUsername,
      privateKey: args.sshPrivateKey,
    };
  }
}
