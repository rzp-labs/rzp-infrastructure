import * as command from "@pulumi/command";
import type * as pulumi from "@pulumi/pulumi";

import type { IK3sNodeConfig } from "../../shared/types";

/**
 * ArgoCD Admin Password Helper
 *
 * Retrieves the ArgoCD admin password from a K3s cluster via SSH.
 * Handles waiting for ArgoCD deployment to be ready and extracting the password.
 */

export interface IArgoCdAdminPasswordConfig {
  readonly masterNode: IK3sNodeConfig;
  readonly ssh: {
    readonly username: string;
    readonly privateKey: pulumi.Input<string>;
  };
  readonly deploymentName: string;
  readonly namespace?: string;
}

export function createArgoCdAdminPasswordCommand(
  name: string,
  config: IArgoCdAdminPasswordConfig,
  opts?: pulumi.ComponentResourceOptions,
): command.remote.Command {
  const namespace = config.namespace ?? "argocd";

  return new command.remote.Command(
    name,
    {
      connection: {
        host: config.masterNode.ip4,
        user: config.ssh.username,
        privateKey: config.ssh.privateKey,
      },
      create: `
        set -e
        
        # Wait for ArgoCD namespace to be created
        echo "Waiting for ArgoCD namespace..."
        for i in {1..30}; do
          if sudo k3s kubectl get namespace ${namespace} >/dev/null 2>&1; then
            echo "ArgoCD namespace found"
            break
          fi
          echo "Waiting for ArgoCD namespace... ($i/30)"
          sleep 2
        done
        
        # Wait for ArgoCD server deployment to be created
        echo "Waiting for ArgoCD server deployment to be created..."
        for i in {1..60}; do
          if sudo k3s kubectl get deployment ${config.deploymentName} -n ${namespace} >/dev/null 2>&1; then
            echo "ArgoCD server deployment found"
            break
          fi
          echo "Waiting for ArgoCD server deployment... ($i/60)"

          # Add debugging info every 10 iterations
          if [ $((i % 10)) -eq 0 ]; then
            echo "DEBUG: ArgoCD namespace contents:"
            sudo k3s kubectl get all -n ${namespace}
            echo "DEBUG: ArgoCD pods:"
            sudo k3s kubectl get pods -n ${namespace}
            echo "DEBUG: ArgoCD events:"
            sudo k3s kubectl get events -n ${namespace} --sort-by='.lastTimestamp' | tail -10
          fi

          sleep 5
        done
        
        # Wait for ArgoCD server to be ready
        echo "Waiting for ArgoCD server deployment to be available..."
        sudo k3s kubectl wait --for=condition=available --timeout=300s deployment/${config.deploymentName} -n ${namespace}

        # Wait for ArgoCD service to be ready
        echo "Waiting for ArgoCD service to be ready..."
        for i in {1..30}; do
          if sudo k3s kubectl get service ${config.deploymentName} -n ${namespace} >/dev/null 2>&1; then
            echo "ArgoCD service found"
            break
          fi
          echo "Waiting for ArgoCD service... ($i/30)"
          sleep 2
        done

        # Get the admin password and retrieve auth token
        echo "Retrieving ArgoCD admin password..."
        password=$(sudo k3s kubectl -n ${namespace} get secret argocd-initial-admin-secret -o jsonpath="{.data.password}" | python3 -c "import base64, sys; print(base64.b64decode(sys.stdin.read().strip()).decode().strip())")
        
        echo "Getting ArgoCD auth token..."
        curl -k -s -X POST https://stg.argocd.rzp.one/api/v1/session \
          -d '{"username":"admin","password":"'$password'"}' \
          -H "Content-Type: application/json" | \
          python3 -c "import json, sys; print(json.load(sys.stdin)['token'])"
      `,
    },
    opts,
  );
}

/**
 * Gets the ArgoCD auth token as a Pulumi output
 */
export function getArgoCdAdminPassword(
  name: string,
  config: IArgoCdAdminPasswordConfig,
  opts?: pulumi.ComponentResourceOptions,
): { token: pulumi.Output<string>; command: command.remote.Command } {
  const cmd = createArgoCdAdminPasswordCommand(name, config, opts);
  return { token: cmd.stdout, command: cmd };
}
