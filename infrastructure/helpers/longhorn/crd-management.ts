/**
 * Longhorn CRD Management Utilities
 *
 * Provides standardized CRD pre-creation and management for Longhorn components.
 * Follows the webhook-readiness pattern to ensure proper sequencing between
 * CRD creation and Helm chart deployment.
 */

import * as k8s from "@pulumi/kubernetes";
import type * as pulumi from "@pulumi/pulumi";

export interface ICrdManagementConfig {
  readonly componentName: string;
  readonly namespace: string;
  readonly timeoutSeconds?: number;
  readonly requiredSettings?: Array<{
    name: string;
    value: string;
  }>;
}

export interface ICrdManagementResources {
  readonly serviceAccount: k8s.core.v1.ServiceAccount;
  readonly clusterRole: k8s.rbac.v1.ClusterRole;
  readonly clusterRoleBinding: k8s.rbac.v1.ClusterRoleBinding;
  readonly preCreationJob: k8s.batch.v1.Job;
  readonly settingsJob?: k8s.batch.v1.Job;
}

/**
 * Creates a comprehensive CRD management setup for Longhorn deployment.
 * Includes CRD validation, settings pre-creation, and proper RBAC permissions.
 *
 * @param config - Configuration for CRD management
 * @param opts - Pulumi component resource options
 * @returns CRD management resources that must complete before Helm deployment
 */
/**
 * Creates a Longhorn Setting custom resource directly.
 * This is a declarative, idempotent way to manage Longhorn settings, replacing
 * the previous method of using a noisy, timestamped Kubernetes Job.
 *
 * @param componentName - Name of the component for resource naming
 * @param namespace - Kubernetes namespace
 * @param opts - Pulumi component resource options
 * @returns The created Longhorn Setting custom resource.
 */
export function createDeletingConfirmationFlagJob(
  componentName: string,
  namespace: string,
  opts?: pulumi.ComponentResourceOptions,
): k8s.apiextensions.CustomResource {
  // Declaratively create the 'deleting-confirmation-flag' setting as a CustomResource.
  // This is idempotent and avoids the noise of creating a new Job on every run.
  return new k8s.apiextensions.CustomResource(
    `${componentName}-deleting-confirmation-flag`,
    {
      apiVersion: "longhorn.io/v1beta2",
      kind: "Setting",
      metadata: {
        name: "deleting-confirmation-flag",
        namespace,
        labels: {
          "app.kubernetes.io/name": "longhorn",
          "app.kubernetes.io/managed-by": "pulumi",
          "app.kubernetes.io/component": "settings",
        },
      },
      value: "true",
    },
    opts,
  );
}
