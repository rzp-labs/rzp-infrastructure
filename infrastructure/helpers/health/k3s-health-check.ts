import * as command from "@pulumi/command";
import type * as pulumi from "@pulumi/pulumi";

export interface IK3sHealthCheckConfig {
  readonly host: string;
  readonly user: string;
  readonly privateKey: pulumi.Output<string>;
  readonly maxRetries?: number;
  readonly retryIntervalSeconds?: number;
  readonly timeoutSeconds?: number;
}

/**
 * Creates a K3s health check that verifies API server readiness and node status
 */
export function createK3sHealthCheck(
  name: string,
  config: IK3sHealthCheckConfig,
  opts?: pulumi.ComponentResourceOptions,
): command.remote.Command {
  const { maxRetries = 20, retryIntervalSeconds = 5, timeoutSeconds = 600 } = config;

  return new command.remote.Command(
    `${name}-k3s-readiness-check`,
    {
      connection: buildConnectionConfig(config),
      create: buildK3sHealthScript(maxRetries, retryIntervalSeconds),
    },
    buildCommandOptions(opts, timeoutSeconds),
  );
}

function buildConnectionConfig(config: IK3sHealthCheckConfig) {
  return {
    host: config.host,
    user: config.user,
    privateKey: config.privateKey,
  };
}

function buildCommandOptions(opts: pulumi.ComponentResourceOptions | undefined, timeoutSeconds: number) {
  return {
    ...opts,
    customTimeouts: {
      create: `${timeoutSeconds}s`,
    },
  };
}

function buildK3sHealthScript(maxRetries: number, interval: number): string {
  return `#!/bin/bash
    set -e
    ${buildK3sServiceCheck(maxRetries, interval)}
    ${buildApiServerCheck(maxRetries, interval)}
    ${buildWorkerNodeCheck(maxRetries, interval)}
  `;
}

function buildApiServerCheck(maxRetries: number, interval: number): string {
  return `# Only check API server on master nodes (where k3s service runs)
    if systemctl is-active --quiet k3s; then
      echo "Checking K3s API server readiness..."
      for i in {1..${maxRetries}}; do
        if sudo k3s kubectl get --raw='/healthz' &>/dev/null; then
          echo "K3s API server is healthy (attempt $i)"
          break
        fi
        if [ $i -eq ${maxRetries} ]; then
          echo "K3s API server failed to respond after ${maxRetries} attempts"
          exit 1
        fi
        echo "Waiting for K3s API server... (attempt $i/${maxRetries})"
        sleep ${interval}
      done
    fi`;
}

function buildK3sServiceCheck(maxRetries: number, interval: number): string {
  return `echo "Checking K3s service readiness..."
    for i in {1..${maxRetries}}; do
      if systemctl is-active --quiet k3s || systemctl is-active --quiet k3s-agent; then
        echo "K3s service is active (attempt $i)"
        break
      fi
      if [ $i -eq ${maxRetries} ]; then
        echo "K3s service failed to start after ${maxRetries} attempts"
        exit 1
      fi
      echo "Waiting for K3s service... (attempt $i/${maxRetries})"
      sleep ${interval}
    done`;
}

function buildWorkerNodeCheck(maxRetries: number, interval: number): string {
  return `# Check appropriate readiness based on node type
    if systemctl is-active --quiet k3s; then
      ${buildMasterNodeCheck(maxRetries, interval)}
    elif systemctl is-active --quiet k3s-agent; then
      ${buildAgentProcessCheck(maxRetries, interval)}
    fi`;
}

function buildMasterNodeCheck(maxRetries: number, interval: number): string {
  return `# Master node - check cluster readiness
      echo "Checking cluster node readiness..."
      for i in {1..${maxRetries}}; do
        if sudo k3s kubectl get nodes --no-headers | grep -q "Ready"; then
          echo "Cluster nodes are ready (attempt $i)"
          break
        fi
        if [ $i -eq ${maxRetries} ]; then
          echo "Cluster nodes failed to become ready after ${maxRetries} attempts"
          exit 1
        fi
        echo "Waiting for cluster nodes... (attempt $i/${maxRetries})"
        sleep ${interval}
      done`;
}

function buildAgentProcessCheck(maxRetries: number, interval: number): string {
  return `# Worker node - verify agent process is healthy
      echo "Checking K3s agent connectivity..."
      for i in {1..${maxRetries}}; do
        if pgrep -f "k3s agent" >/dev/null; then
          echo "K3s agent process is running (attempt $i)"
          break
        fi
        if [ $i -eq ${maxRetries} ]; then
          echo "K3s agent process failed to start after ${maxRetries} attempts"
          exit 1
        fi
        echo "Waiting for K3s agent process... (attempt $i/${maxRetries})"
        sleep ${interval}
      done`;
}
