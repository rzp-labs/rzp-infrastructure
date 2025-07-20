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

      # Install Helm for GitOps operations
      echo "Installing Helm..."
      curl -fsSL -o get_helm.sh https://raw.githubusercontent.com/helm/helm/main/scripts/get-helm-3
      chmod 700 get_helm.sh
      ./get_helm.sh
      rm get_helm.sh
      echo "Helm installation completed"

      # Set up kubeconfig for admin operations
      echo "Setting up kubeconfig for user ${args.sshUsername}..."
      mkdir -p /home/${args.sshUsername}/.kube
      
      # Wait for K3s kubeconfig to be created
      echo "Waiting for K3s kubeconfig to be created..."
      until [ -f /etc/rancher/k3s/k3s.yaml ]; do
        echo "Waiting for K3s kubeconfig to be created..."
        sleep 2
      done
      
      # Copy and configure kubeconfig (requires sudo for root-owned file)
      sudo cp /etc/rancher/k3s/k3s.yaml /home/${args.sshUsername}/.kube/config
      
      # Fix server endpoint in kubeconfig for remote access
      sudo sed -i 's/127.0.0.1:6443/${args.node.ip4}:6443/g' /home/${args.sshUsername}/.kube/config
      sudo chown ${args.sshUsername}:${args.sshUsername} /home/${args.sshUsername}/.kube/config
      sudo chmod 600 /home/${args.sshUsername}/.kube/config
      
      echo "Kubeconfig setup completed"

      # Label node for Longhorn disk discovery (first master only)
      if [ "${args.isFirstMaster ?? true}" = "true" ]; then
        echo "Configuring Longhorn disk discovery labels..."
        export KUBECONFIG=/home/${args.sshUsername}/.kube/config
        
        # Wait for API server to be ready with timeout
        echo "Waiting for Kubernetes API server to be ready..."
        TIMEOUT=300
        ELAPSED=0
        until kubectl get nodes > /dev/null 2>&1; do
          if [ \$ELAPSED -ge \$TIMEOUT ]; then
            echo "ERROR: Timeout waiting for Kubernetes API server"
            exit 1
          fi
          echo "Waiting for Kubernetes API server... (\$ELAPSED/\$TIMEOUT seconds)"
          sleep 5
          ELAPSED=\$((ELAPSED + 5))
        done
        
        # Label all nodes for Longhorn disk discovery
        echo "Applying Longhorn disk discovery labels..."
        kubectl label nodes --all node.longhorn.io/create-default-disk=true --overwrite
        echo "Longhorn disk discovery labels applied successfully"
      fi

      echo "k3s, Helm, and kubeconfig setup completed"
    `;
  }
}
