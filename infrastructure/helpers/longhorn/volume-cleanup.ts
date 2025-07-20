import * as fs from "fs";
import * as path from "path";

import * as k8s from "@pulumi/kubernetes";
import type * as pulumi from "@pulumi/pulumi";

/**
 * Volume Cleanup Automation (Refactored)
 *
 * Following Kubernetes best practices:
 * - External script files instead of embedded bash
 * - ConfigMap from file pattern
 * - Follows Longhorn's own cleanup patterns
 */

export interface IVolumeCleanupConfig {
  readonly namespace: string;
  readonly environment: string;
  readonly enableAutoCleanup?: boolean;
  readonly cleanupIntervalMinutes?: number;
  readonly maxVolumeAgeHours?: number;
}

export interface IVolumeCleanupResources {
  readonly serviceAccount: k8s.core.v1.ServiceAccount;
  readonly role: k8s.rbac.v1.Role;
  readonly roleBinding: k8s.rbac.v1.RoleBinding;
  readonly cleanupScript: k8s.core.v1.ConfigMap;
  readonly cleanupJob: k8s.batch.v1.Job;
  readonly cronJob?: k8s.batch.v1.CronJob;
}

/**
 * Creates volume cleanup automation using external script files
 * Following the pattern used by Longhorn and other major Kubernetes projects
 */
export function createVolumeCleanup(
  name: string,
  config: IVolumeCleanupConfig,
  opts?: pulumi.ComponentResourceOptions,
): IVolumeCleanupResources {
  const parent = opts?.parent;

  // Read the external cleanup script
  const scriptPath = path.join(__dirname, "../../scripts/longhorn/volume-cleanup.sh");
  const cleanupScriptContent = fs.readFileSync(scriptPath, "utf8");

  // Create service account with minimal permissions
  const serviceAccount = new k8s.core.v1.ServiceAccount(
    `${name}-volume-cleanup-sa`,
    {
      metadata: {
        name: "longhorn-volume-cleanup",
        namespace: config.namespace,
        labels: {
          "app.kubernetes.io/name": "longhorn-volume-cleanup",
          "app.kubernetes.io/component": "volume-cleanup",
          "app.kubernetes.io/managed-by": "pulumi",
        },
      },
    },
    { parent },
  );

  // Create role with only necessary permissions (following principle of least privilege)
  const role = new k8s.rbac.v1.Role(
    `${name}-volume-cleanup-role`,
    {
      metadata: {
        name: "longhorn-volume-cleanup",
        namespace: config.namespace,
        labels: {
          "app.kubernetes.io/name": "longhorn-volume-cleanup",
          "app.kubernetes.io/component": "volume-cleanup",
          "app.kubernetes.io/managed-by": "pulumi",
        },
      },
      rules: [
        {
          apiGroups: ["longhorn.io"],
          resources: ["volumes"],
          verbs: ["get", "list", "delete"],
        },
        {
          apiGroups: [""],
          resources: ["persistentvolumes"],
          verbs: ["get", "list", "delete"],
        },
        {
          apiGroups: [""],
          resources: ["events"],
          verbs: ["create"],
        },
      ],
    },
    { parent },
  );

  // Create role binding
  const roleBinding = new k8s.rbac.v1.RoleBinding(
    `${name}-volume-cleanup-binding`,
    {
      metadata: {
        name: "longhorn-volume-cleanup",
        namespace: config.namespace,
        labels: {
          "app.kubernetes.io/name": "longhorn-volume-cleanup",
          "app.kubernetes.io/component": "volume-cleanup",
          "app.kubernetes.io/managed-by": "pulumi",
        },
      },
      subjects: [
        {
          kind: "ServiceAccount",
          name: serviceAccount.metadata.name,
          namespace: config.namespace,
        },
      ],
      roleRef: {
        kind: "Role",
        name: role.metadata.name,
        apiGroup: "rbac.authorization.k8s.io",
      },
    },
    { parent, dependsOn: [serviceAccount, role] },
  );

  // Create ConfigMap from external script file (best practice)
  const cleanupScript = new k8s.core.v1.ConfigMap(
    `${name}-volume-cleanup-script`,
    {
      metadata: {
        name: "longhorn-volume-cleanup-script",
        namespace: config.namespace,
        labels: {
          "app.kubernetes.io/name": "longhorn-volume-cleanup",
          "app.kubernetes.io/component": "volume-cleanup",
          "app.kubernetes.io/managed-by": "pulumi",
        },
      },
      data: {
        "volume-cleanup.sh": cleanupScriptContent,
      },
    },
    { parent },
  );

  // Create cleanup job
  const cleanupJob = new k8s.batch.v1.Job(
    `${name}-volume-cleanup-job`,
    {
      metadata: {
        name: "longhorn-volume-cleanup",
        namespace: config.namespace,
        labels: {
          "app.kubernetes.io/name": "longhorn-volume-cleanup",
          "app.kubernetes.io/component": "volume-cleanup",
          "app.kubernetes.io/managed-by": "pulumi",
        },
      },
      spec: {
        ttlSecondsAfterFinished: 86400, // Clean up job after 24 hours
        activeDeadlineSeconds: 600, // Kill job after 10 minutes to prevent hanging
        backoffLimit: 2, // Allow up to 2 retries
        template: {
          metadata: {
            labels: {
              "app.kubernetes.io/name": "longhorn-volume-cleanup",
              "app.kubernetes.io/component": "volume-cleanup",
            },
          },
          spec: {
            serviceAccountName: serviceAccount.metadata.name,
            restartPolicy: "OnFailure",
            containers: [
              {
                name: "volume-cleanup",
                image: "bitnami/kubectl:1.31.2", // Includes kubectl and jq
                command: ["/bin/bash"],
                args: ["/scripts/volume-cleanup.sh"],
                env: [
                  {
                    name: "NAMESPACE",
                    value: config.namespace,
                  },
                  {
                    name: "ENVIRONMENT",
                    value: config.environment,
                  },
                  {
                    name: "MAX_AGE_HOURS",
                    value: (config.maxVolumeAgeHours ?? 24).toString(),
                  },
                ],
                volumeMounts: [
                  {
                    name: "cleanup-script",
                    mountPath: "/scripts",
                    readOnly: true,
                  },
                ],
                resources: {
                  requests: {
                    cpu: "10m",
                    memory: "32Mi",
                  },
                  limits: {
                    cpu: "100m",
                    memory: "128Mi",
                  },
                },
              },
            ],
            volumes: [
              {
                name: "cleanup-script",
                configMap: {
                  name: cleanupScript.metadata.name,
                  defaultMode: 0o755,
                },
              },
            ],
          },
        },
      },
    },
    { parent, dependsOn: [serviceAccount, roleBinding, cleanupScript] },
  );

  // Create cron job for automatic cleanup (only for non-production environments)
  let cronJob: k8s.batch.v1.CronJob | undefined;
  if (config.enableAutoCleanup === true && config.environment !== "prd") {
    const schedule = `*/${config.cleanupIntervalMinutes ?? 30} * * * *`;

    cronJob = new k8s.batch.v1.CronJob(
      `${name}-volume-cleanup-cron`,
      {
        metadata: {
          name: "longhorn-volume-cleanup-cron",
          namespace: config.namespace,
          labels: {
            "app.kubernetes.io/name": "longhorn-volume-cleanup",
            "app.kubernetes.io/component": "volume-cleanup-cron",
            "app.kubernetes.io/managed-by": "pulumi",
          },
        },
        spec: {
          schedule,
          concurrencyPolicy: "Forbid",
          successfulJobsHistoryLimit: 3,
          failedJobsHistoryLimit: 1,
          jobTemplate: {
            spec: {
              ttlSecondsAfterFinished: 3600, // Clean up after 1 hour for cron jobs
              template: cleanupJob.spec.template,
            },
          },
        },
      },
      { parent, dependsOn: [serviceAccount, roleBinding, cleanupScript] },
    );
  }

  return {
    serviceAccount,
    role,
    roleBinding,
    cleanupScript,
    cleanupJob,
    cronJob,
  };
}
