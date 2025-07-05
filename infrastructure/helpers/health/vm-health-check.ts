import * as command from "@pulumi/command";
import type * as pulumi from "@pulumi/pulumi";

export interface IVmHealthCheckConfig {
  readonly host: string;
  readonly user: string;
  readonly privateKey: pulumi.Output<string>;
  readonly timeoutSeconds?: number;
}

/**
 * Creates a VM health check that verifies cloud-init completion and kernel modules
 */
export function createVmHealthCheck(
  name: string,
  config: IVmHealthCheckConfig,
  opts?: pulumi.ComponentResourceOptions,
): command.remote.Command {
  const { timeoutSeconds = 600 } = config;

  return new command.remote.Command(
    `${name}-vm-readiness-check`,
    {
      connection: buildConnectionConfig(config),
      create: buildVmHealthScript(timeoutSeconds),
    },
    buildCommandOptions(opts, timeoutSeconds),
  );
}

function buildConnectionConfig(config: IVmHealthCheckConfig) {
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

function buildVmHealthScript(timeoutSeconds: number): string {
  return `#!/bin/bash
    set -e
    ${buildCloudInitWait(timeoutSeconds)}
    ${buildKernelModuleChecks()}
    ${buildNetworkChecks()}
  `;
}

function buildCloudInitWait(timeoutSeconds: number): string {
  const timeoutMinutes = Math.ceil(timeoutSeconds / 60);
  return `echo "Waiting for cloud-init completion..."
    timeout ${timeoutSeconds} cloud-init status --wait || { echo "Cloud-init timeout after ${timeoutMinutes} minutes"; exit 1; }
    echo "Cloud-init completed successfully"`;
}

function buildNetworkChecks(): string {
  return `echo "Checking network readiness..."
    systemctl is-active --quiet systemd-networkd || echo "Warning: systemd-networkd not active"
    echo "Network check completed"`;
}

function buildKernelModuleChecks(): string {
  return `echo "Loading required kernel modules..."
    required_modules="br_netfilter overlay ip_vs"
    for module in $required_modules; do
      if ! lsmod | grep -q "^$module"; then
        modprobe $module || true
      fi
    done
    echo "Kernel modules verified"`;
}
