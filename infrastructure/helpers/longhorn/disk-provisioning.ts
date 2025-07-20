import * as fs from "fs";
import * as path from "path";

import * as k8s from "@pulumi/kubernetes";
import type * as pulumi from "@pulumi/pulumi";

import type { Environment } from "../../shared/types";

/**
 * Disk provisioning configuration for Longhorn nodes
 */
export interface IDiskProvisioningConfig {
  readonly namespace: string;
  readonly environment: Environment;
  readonly diskPath?: string;
  readonly storageReservedGb?: number;
  readonly timeoutSeconds?: number;
  readonly retryAttempts?: number;
}

/**
 * Resources created by disk provisioning automation
 */
export interface IDiskProvisioningResources {
  readonly configMap: k8s.core.v1.ConfigMap;
  readonly job: k8s.batch.v1.Job;
  readonly serviceAccount: k8s.core.v1.ServiceAccount;
  readonly clusterRole: k8s.rbac.v1.ClusterRole;
  readonly clusterRoleBinding: k8s.rbac.v1.ClusterRoleBinding;
}

/**
 * Creates a disk provisioning job that automatically configures default disks
 * on all Longhorn nodes when auto-creation fails or is incomplete.
 *
 * Following Kubernetes best practices:
 * - External script files instead of embedded bash
 * - ConfigMap from file pattern
 * - Principle of least privilege RBAC
 */
export function createDiskProvisioningJob(
  name: string,
  config: IDiskProvisioningConfig,
  provider?: k8s.Provider,
  dependsOn?: pulumi.Resource[],
): IDiskProvisioningResources {
  const diskPath = config.diskPath ?? "/var/lib/longhorn";
  const storageReservedBytes = (config.storageReservedGb ?? 6) * 1024 * 1024 * 1024;
  const timeoutSeconds = config.timeoutSeconds ?? 600;
  const retryAttempts = config.retryAttempts ?? 3;

  // Read the external provisioning script
  const scriptPath = path.join(__dirname, "../../scripts/longhorn/disk-provisioning.sh");
  const provisioningScriptContent = fs.readFileSync(scriptPath, "utf8");

  // Create ServiceAccount for the job
  const serviceAccount = new k8s.core.v1.ServiceAccount(
    `${name}-disk-provisioning-sa`,
    {
      metadata: {
        name: "longhorn-disk-provisioning",
        namespace: config.namespace,
        labels: {
          "app.kubernetes.io/name": "longhorn-disk-provisioning",
          "app.kubernetes.io/component": "automation",
          "app.kubernetes.io/part-of": "longhorn",
          environment: config.environment,
        },
      },
      automountServiceAccountToken: true,
    },
    { provider, dependsOn },
  );

  // Create ClusterRole with necessary permissions
  const clusterRole = new k8s.rbac.v1.ClusterRole(
    `${name}-disk-provisioning-role`,
    {
      metadata: {
        name: "longhorn-disk-provisioning",
        labels: {
          "app.kubernetes.io/name": "longhorn-disk-provisioning",
          "app.kubernetes.io/component": "automation",
          "app.kubernetes.io/part-of": "longhorn",
          environment: config.environment,
        },
      },
      rules: [
        {
          apiGroups: ["longhorn.io"],
          resources: ["nodes"],
          verbs: ["get", "list", "patch", "update"],
        },
        {
          apiGroups: [""],
          resources: ["nodes"],
          verbs: ["get", "list"],
        },
        {
          apiGroups: [""],
          resources: ["events"],
          verbs: ["create", "patch"],
        },
      ],
    },
    { provider },
  );

  // Create ClusterRoleBinding
  const clusterRoleBinding = new k8s.rbac.v1.ClusterRoleBinding(
    `${name}-disk-provisioning-binding`,
    {
      metadata: {
        name: "longhorn-disk-provisioning",
        labels: {
          "app.kubernetes.io/name": "longhorn-disk-provisioning",
          "app.kubernetes.io/component": "automation",
          "app.kubernetes.io/part-of": "longhorn",
          environment: config.environment,
        },
      },
      roleRef: {
        apiGroup: "rbac.authorization.k8s.io",
        kind: "ClusterRole",
        name: clusterRole.metadata.name,
      },
      subjects: [
        {
          kind: "ServiceAccount",
          name: serviceAccount.metadata.name,
          namespace: config.namespace,
        },
      ],
    },
    { provider, dependsOn: [clusterRole, serviceAccount] },
  );

  // Create ConfigMap from external script file (best practice)
  const configMap = new k8s.core.v1.ConfigMap(
    `${name}-disk-provisioning-script`,
    {
      metadata: {
        name: "longhorn-disk-provisioning-script",
        namespace: config.namespace,
        labels: {
          "app.kubernetes.io/name": "longhorn-disk-provisioning",
          "app.kubernetes.io/component": "automation",
          "app.kubernetes.io/part-of": "longhorn",
          environment: config.environment,
        },
      },
      data: {
        "disk-provisioning.sh": provisioningScriptContent,
      },
    },
    { provider, dependsOn: dependsOn ? [serviceAccount, ...dependsOn] : [serviceAccount] },
  );

  // Create the provisioning Job
  const job = new k8s.batch.v1.Job(
    `${name}-disk-provisioning-job`,
    {
      metadata: {
        name: "longhorn-disk-provisioning",
        namespace: config.namespace,
        labels: {
          "app.kubernetes.io/name": "longhorn-disk-provisioning",
          "app.kubernetes.io/component": "automation",
          "app.kubernetes.io/part-of": "longhorn",
          environment: config.environment,
        },
      },
      spec: {
        backoffLimit: retryAttempts,
        activeDeadlineSeconds: timeoutSeconds,
        template: {
          metadata: {
            labels: {
              "app.kubernetes.io/name": "longhorn-disk-provisioning",
              "app.kubernetes.io/component": "automation",
              "app.kubernetes.io/part-of": "longhorn",
              environment: config.environment,
            },
          },
          spec: {
            serviceAccountName: serviceAccount.metadata.name,
            restartPolicy: "Never",
            containers: [
              {
                name: "disk-provisioner",
                image: "bitnami/kubectl:1.31.2",
                command: ["/bin/bash"],
                args: ["/scripts/disk-provisioning.sh"],
                env: [
                  {
                    name: "DISK_PATH",
                    value: diskPath,
                  },
                  {
                    name: "STORAGE_RESERVED",
                    value: storageReservedBytes.toString(),
                  },
                  {
                    name: "TIMEOUT_SECONDS",
                    value: timeoutSeconds.toString(),
                  },
                  {
                    name: "RETRY_ATTEMPTS",
                    value: retryAttempts.toString(),
                  },
                  {
                    name: "NAMESPACE",
                    value: config.namespace,
                  },
                ],
                volumeMounts: [
                  {
                    name: "provisioning-script",
                    mountPath: "/scripts",
                    readOnly: true,
                  },
                ],
                resources: {
                  requests: {
                    cpu: "100m",
                    memory: "128Mi",
                  },
                  limits: {
                    cpu: "500m",
                    memory: "256Mi",
                  },
                },
              },
            ],
            volumes: [
              {
                name: "provisioning-script",
                configMap: {
                  name: configMap.metadata.name,
                  defaultMode: 0o755,
                },
              },
            ],
          },
        },
      },
    },
    {
      provider,
      dependsOn: dependsOn ? [configMap, clusterRoleBinding, ...dependsOn] : [configMap, clusterRoleBinding],
    },
  );

  return {
    configMap,
    job,
    serviceAccount,
    clusterRole,
    clusterRoleBinding,
  };
}
