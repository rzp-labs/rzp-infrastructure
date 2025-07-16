/**
 * Longhorn Uninstaller RBAC Utilities
 *
 * Provides standardized RBAC configuration for Longhorn uninstaller jobs.
 * Creates ServiceAccount, ClusterRole, and ClusterRoleBinding with comprehensive
 * permissions for Longhorn CRDs, Jobs, and cleanup operations.
 */

import * as k8s from "@pulumi/kubernetes";
import type * as pulumi from "@pulumi/pulumi";

export interface IUninstallerRbacConfig {
  readonly componentName: string;
  readonly namespace: string;
  readonly serviceAccountName?: string;
  readonly clusterRoleName?: string;
  readonly clusterRoleBindingName?: string;
  readonly timeoutSeconds?: number;
}

export interface IUninstallerRbacResources {
  readonly serviceAccount: k8s.core.v1.ServiceAccount;
  readonly clusterRole: k8s.rbac.v1.ClusterRole;
  readonly clusterRoleBinding: k8s.rbac.v1.ClusterRoleBinding;
}

/**
 * Creates comprehensive RBAC resources for Longhorn uninstaller operations.
 * Includes ServiceAccount, ClusterRole with all required permissions, and ClusterRoleBinding.
 *
 * @param config - Configuration for the uninstaller RBAC setup
 * @param opts - Pulumi component resource options
 * @returns Object containing all created RBAC resources
 */
export function createUninstallerRbac(
  config: IUninstallerRbacConfig,
  opts?: pulumi.ComponentResourceOptions,
): IUninstallerRbacResources {
  const {
    componentName,
    namespace,
    serviceAccountName = `${componentName}-uninstaller`,
    clusterRoleName = `${componentName}-uninstaller-role`,
    clusterRoleBindingName = `${componentName}-uninstaller-binding`,
  } = config;

  // Validate configuration
  validateRbacConfig(config);

  // Create ServiceAccount for uninstaller operations
  const serviceAccount = new k8s.core.v1.ServiceAccount(
    `${componentName}-uninstaller-sa`,
    {
      metadata: {
        name: serviceAccountName,
        namespace,
        labels: {
          "app.kubernetes.io/name": "longhorn",
          "app.kubernetes.io/managed-by": "pulumi",
          "app.kubernetes.io/component": "uninstaller-rbac",
          "app.kubernetes.io/part-of": componentName,
        },
        annotations: {
          "pulumi.com/description": "ServiceAccount for Longhorn uninstaller operations",
        },
      },
    },
    opts,
  );

  // Create ClusterRole with comprehensive permissions for uninstaller operations
  const clusterRole = new k8s.rbac.v1.ClusterRole(
    `${componentName}-uninstaller-role`,
    {
      metadata: {
        name: clusterRoleName,
        labels: {
          "app.kubernetes.io/name": "longhorn",
          "app.kubernetes.io/managed-by": "pulumi",
          "app.kubernetes.io/component": "uninstaller-rbac",
          "app.kubernetes.io/part-of": componentName,
        },
        annotations: {
          "pulumi.com/description": "ClusterRole for Longhorn uninstaller with comprehensive permissions",
        },
      },
      rules: [
        // Core Kubernetes resources
        {
          apiGroups: [""],
          resources: [
            "pods",
            "pods/log",
            "pods/exec",
            "services",
            "endpoints",
            "persistentvolumes",
            "persistentvolumeclaims",
            "configmaps",
            "secrets",
            "nodes",
            "events",
            "namespaces",
          ],
          verbs: ["*"],
        },
        // Apps resources
        {
          apiGroups: ["apps"],
          resources: ["deployments", "daemonsets", "replicasets", "statefulsets"],
          verbs: ["*"],
        },
        // Batch resources (Jobs, CronJobs)
        {
          apiGroups: ["batch"],
          resources: ["jobs", "cronjobs"],
          verbs: ["*"],
        },
        // Extensions and networking
        {
          apiGroups: ["extensions", "networking.k8s.io"],
          resources: ["ingresses", "networkpolicies"],
          verbs: ["*"],
        },
        // Storage resources
        {
          apiGroups: ["storage.k8s.io"],
          resources: ["storageclasses", "volumeattachments", "csinodes", "csidrivers", "csistoragecapacities"],
          verbs: ["*"],
        },
        // Longhorn CRDs - comprehensive permissions
        {
          apiGroups: ["longhorn.io"],
          resources: [
            "engines",
            "replicas",
            "volumes",
            "instancemanagers",
            "engineimages",
            "nodes",
            "settings",
            "backups",
            "backupvolumes",
            "backuptargets",
            "backingimages",
            "backingimagemanagers",
            "sharemanagers",
            "snapshots",
            "supportbundles",
            "systembackups",
            "systemrestores",
            "recurringjobs",
            "orphans",
            "volumeattachments",
          ],
          verbs: ["*"],
        },
        // Custom Resource Definitions management
        {
          apiGroups: ["apiextensions.k8s.io"],
          resources: ["customresourcedefinitions"],
          verbs: ["get", "list", "watch", "create", "update", "patch", "delete"],
        },
        // RBAC resources (for self-management)
        {
          apiGroups: ["rbac.authorization.k8s.io"],
          resources: ["roles", "rolebindings", "clusterroles", "clusterrolebindings"],
          verbs: ["get", "list", "watch", "create", "update", "patch", "delete"],
        },
        // Admission controllers and webhooks
        {
          apiGroups: ["admissionregistration.k8s.io"],
          resources: ["mutatingwebhookconfigurations", "validatingwebhookconfigurations"],
          verbs: ["get", "list", "watch", "create", "update", "patch", "delete"],
        },
        // Coordination for leader election
        {
          apiGroups: ["coordination.k8s.io"],
          resources: ["leases"],
          verbs: ["*"],
        },
        // Metrics and monitoring
        {
          apiGroups: ["metrics.k8s.io"],
          resources: ["pods", "nodes"],
          verbs: ["get", "list"],
        },
        // Policy resources
        {
          apiGroups: ["policy"],
          resources: ["poddisruptionbudgets", "podsecuritypolicies"],
          verbs: ["*"],
        },
        // Security context constraints (OpenShift compatibility)
        {
          apiGroups: ["security.openshift.io"],
          resources: ["securitycontextconstraints"],
          verbs: ["use"],
        },
      ],
    },
    { ...opts, dependsOn: [serviceAccount] },
  );

  // Create ClusterRoleBinding to associate ServiceAccount with ClusterRole
  const clusterRoleBinding = new k8s.rbac.v1.ClusterRoleBinding(
    `${componentName}-uninstaller-binding`,
    {
      metadata: {
        name: clusterRoleBindingName,
        labels: {
          "app.kubernetes.io/name": "longhorn",
          "app.kubernetes.io/managed-by": "pulumi",
          "app.kubernetes.io/component": "uninstaller-rbac",
          "app.kubernetes.io/part-of": componentName,
        },
        annotations: {
          "pulumi.com/description": "ClusterRoleBinding for Longhorn uninstaller ServiceAccount",
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
          namespace,
        },
      ],
    },
    { ...opts, dependsOn: [serviceAccount, clusterRole] },
  );

  return {
    serviceAccount,
    clusterRole,
    clusterRoleBinding,
  };
}

/**
 * Validates the RBAC configuration to ensure all required fields are present
 * and meet the requirements for Longhorn uninstaller operations.
 *
 * @param config - Configuration to validate
 * @throws Error if configuration is invalid
 */
function validateRbacConfig(config: IUninstallerRbacConfig): void {
  if (!config.componentName || config.componentName.trim() === "") {
    throw new Error("componentName is required and cannot be empty");
  }

  if (!config.namespace || config.namespace.trim() === "") {
    throw new Error("namespace is required and cannot be empty");
  }

  // Validate Kubernetes naming conventions
  const nameRegex = /^[a-z0-9]([-a-z0-9]*[a-z0-9])?$/;

  if (!nameRegex.test(config.componentName)) {
    throw new Error(
      `componentName "${config.componentName}" must follow Kubernetes naming conventions (lowercase alphanumeric with hyphens)`,
    );
  }

  if (!nameRegex.test(config.namespace)) {
    throw new Error(
      `namespace "${config.namespace}" must follow Kubernetes naming conventions (lowercase alphanumeric with hyphens)`,
    );
  }

  // Validate optional timeout
  if (config.timeoutSeconds !== undefined && config.timeoutSeconds <= 0) {
    throw new Error("timeoutSeconds must be a positive number");
  }

  // Validate optional custom names if provided
  if (config.serviceAccountName !== undefined && !nameRegex.test(config.serviceAccountName)) {
    throw new Error(`serviceAccountName "${config.serviceAccountName}" must follow Kubernetes naming conventions`);
  }

  if (config.clusterRoleName !== undefined && !nameRegex.test(config.clusterRoleName)) {
    throw new Error(`clusterRoleName "${config.clusterRoleName}" must follow Kubernetes naming conventions`);
  }

  if (config.clusterRoleBindingName !== undefined && !nameRegex.test(config.clusterRoleBindingName)) {
    throw new Error(
      `clusterRoleBindingName "${config.clusterRoleBindingName}" must follow Kubernetes naming conventions`,
    );
  }
}

/**
 * Utility function to get the default ServiceAccount name for a component.
 * Follows the naming convention used throughout the project.
 *
 * @param componentName - Name of the component
 * @returns Default ServiceAccount name
 */
export function getDefaultServiceAccountName(componentName: string): string {
  return `${componentName}-uninstaller`;
}

/**
 * Utility function to get the default ClusterRole name for a component.
 * Follows the naming convention used throughout the project.
 *
 * @param componentName - Name of the component
 * @returns Default ClusterRole name
 */
export function getDefaultClusterRoleName(componentName: string): string {
  return `${componentName}-uninstaller-role`;
}

/**
 * Utility function to get the default ClusterRoleBinding name for a component.
 * Follows the naming convention used throughout the project.
 *
 * @param componentName - Name of the component
 * @returns Default ClusterRoleBinding name
 */
export function getDefaultClusterRoleBindingName(componentName: string): string {
  return `${componentName}-uninstaller-binding`;
}
