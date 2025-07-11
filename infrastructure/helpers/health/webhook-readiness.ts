/**
 * Kubernetes Webhook Readiness Utilities
 *
 * Provides standardized webhook readiness checking for components that need
 * to wait for webhook deployments to be available before creating dependent resources.
 */

import * as k8s from "@pulumi/kubernetes";
import type * as pulumi from "@pulumi/pulumi";

export interface IWebhookReadinessConfig {
  readonly componentName: string;
  readonly namespace: string;
  readonly deploymentName: string;
  readonly timeoutSeconds?: number;
}

/**
 * Creates a Job that waits for a webhook deployment to be available using kubectl wait.
 * Includes proper RBAC permissions and auto-cleanup.
 *
 * @param config - Configuration for the webhook readiness check
 * @param opts - Pulumi component resource options
 * @returns Job resource that completes when webhook is ready
 */
export function createWebhookReadinessJob(
  config: IWebhookReadinessConfig,
  opts?: pulumi.ComponentResourceOptions,
): k8s.batch.v1.Job {
  const { componentName, namespace, deploymentName, timeoutSeconds = 300 } = config;

  // Create RBAC for webhook readiness job
  const role = new k8s.rbac.v1.Role(
    `${componentName}-webhook-readiness-role`,
    {
      metadata: {
        name: `${componentName}-webhook-readiness-role`,
        namespace,
      },
      rules: [
        {
          apiGroups: ["apps"],
          resources: ["deployments"],
          verbs: ["get", "list", "watch"],
        },
      ],
    },
    opts,
  );

  const roleBinding = new k8s.rbac.v1.RoleBinding(
    `${componentName}-webhook-readiness-rolebinding`,
    {
      metadata: {
        name: `${componentName}-webhook-readiness-rolebinding`,
        namespace,
      },
      roleRef: {
        apiGroup: "rbac.authorization.k8s.io",
        kind: "Role",
        name: role.metadata.name,
      },
      subjects: [
        {
          kind: "ServiceAccount",
          name: "default",
          namespace,
        },
      ],
    },
    { ...opts, dependsOn: [role] },
  );

  // Create the webhook readiness job
  const job = new k8s.batch.v1.Job(
    `${componentName}-webhook-readiness`,
    {
      metadata: {
        name: `${componentName}-webhook-readiness`,
        namespace,
        generateName: `${componentName}-webhook-readiness-`,
      },
      spec: {
        ttlSecondsAfterFinished: 60, // Clean up after 1 minute
        template: {
          spec: {
            restartPolicy: "Never",
            containers: [
              {
                name: "webhook-readiness",
                image: "bitnami/kubectl:latest",
                command: [
                  "kubectl",
                  "wait",
                  "--for=condition=available",
                  `deployment/${deploymentName}`,
                  `-n=${namespace}`,
                  `--timeout=${timeoutSeconds}s`,
                ],
              },
            ],
          },
        },
      },
    },
    { ...opts, dependsOn: [roleBinding] },
  );

  return job;
}
