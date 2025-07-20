/**
 * Longhorn Prerequisite Validation Utilities
 *
 * Provides standardized prerequisite validation for Longhorn deployment.
 * Validates node-level requirements like open-iscsi installation and other
 * system dependencies before Longhorn deployment begins.
 */

import * as fs from "fs";
import * as path from "path";

import * as k8s from "@pulumi/kubernetes";
import type * as pulumi from "@pulumi/pulumi";

export interface IPrerequisiteValidationConfig {
  readonly componentName: string;
  readonly namespace: string;
  readonly timeoutSeconds?: number;
  readonly requiredPackages?: string[];
  readonly validateOpenIscsi?: boolean;
  readonly validateMultipath?: boolean;
  readonly nodeSelector?: Record<string, string>;
}

export interface IPrerequisiteValidationResources {
  readonly serviceAccount: k8s.core.v1.ServiceAccount;
  readonly role: k8s.rbac.v1.ClusterRole;
  readonly roleBinding: k8s.rbac.v1.ClusterRoleBinding;
  readonly configMap: k8s.core.v1.ConfigMap;
  readonly validationJob: k8s.batch.v1.Job;
}

/**
 * Creates a comprehensive prerequisite validation setup for Longhorn deployment.
 * Validates system dependencies on all nodes before allowing Longhorn installation.
 *
 * @param config - Configuration for prerequisite validation
 * @param opts - Pulumi component resource options
 * @returns Prerequisite validation resources that must complete before Longhorn deployment
 */
export function createPrerequisiteValidation(
  config: IPrerequisiteValidationConfig,
  opts?: pulumi.ComponentResourceOptions,
): IPrerequisiteValidationResources {
  const { componentName, namespace, timeoutSeconds = 600 } = config;

  // Validate configuration
  validatePrerequisiteConfig(config);

  // Read the external prerequisite validation script
  const scriptPath = path.join(__dirname, "../../scripts/longhorn/prerequisite-validation.sh");
  const prerequisiteScriptContent = fs.readFileSync(scriptPath, "utf8");

  // Create ServiceAccount for prerequisite validation
  const serviceAccount = new k8s.core.v1.ServiceAccount(
    `${componentName}-prerequisite-validation-sa`,
    {
      metadata: {
        name: `${componentName}-prerequisite-validation`,
        namespace,
        labels: {
          "app.kubernetes.io/name": "longhorn",
          "app.kubernetes.io/managed-by": "pulumi",
          "app.kubernetes.io/component": "prerequisite-validation",
        },
      },
    },
    opts,
  );

  // Create ClusterRole for prerequisite validation (needs cluster-wide permissions for nodes)
  const role = new k8s.rbac.v1.ClusterRole(
    `${componentName}-prerequisite-validation-role`,
    {
      metadata: {
        name: `${componentName}-prerequisite-validation-role`,
        labels: {
          "app.kubernetes.io/name": "longhorn",
          "app.kubernetes.io/managed-by": "pulumi",
          "app.kubernetes.io/component": "prerequisite-validation",
        },
      },
      rules: [
        // Permissions for node operations (cluster-scoped)
        {
          apiGroups: [""],
          resources: ["nodes"],
          verbs: ["get", "list", "watch"],
        },
        // Permissions for pod operations (for kubectl debug)
        {
          apiGroups: [""],
          resources: ["pods", "pods/log", "pods/ephemeralcontainers"],
          verbs: ["get", "list", "watch", "create", "delete", "patch"],
        },
        // Permissions for events
        {
          apiGroups: [""],
          resources: ["events"],
          verbs: ["create", "patch"],
        },
      ],
    },
    { ...opts, dependsOn: [serviceAccount] },
  );

  const roleBinding = new k8s.rbac.v1.ClusterRoleBinding(
    `${componentName}-prerequisite-validation-rolebinding`,
    {
      metadata: {
        name: `${componentName}-prerequisite-validation-rolebinding`,
        labels: {
          "app.kubernetes.io/name": "longhorn",
          "app.kubernetes.io/managed-by": "pulumi",
          "app.kubernetes.io/component": "prerequisite-validation",
        },
      },
      roleRef: {
        apiGroup: "rbac.authorization.k8s.io",
        kind: "ClusterRole",
        name: role.metadata.name,
      },
      subjects: [
        {
          kind: "ServiceAccount",
          name: serviceAccount.metadata.name,
          namespace,
        },
      ],
    },
    { ...opts, dependsOn: [role] },
  );

  // Create ConfigMap from external script file
  const configMap = new k8s.core.v1.ConfigMap(
    `${componentName}-prerequisite-validation-script`,
    {
      metadata: {
        name: `${componentName}-prerequisite-validation-script`,
        namespace,
        labels: {
          "app.kubernetes.io/name": "longhorn",
          "app.kubernetes.io/managed-by": "pulumi",
          "app.kubernetes.io/component": "prerequisite-validation",
        },
      },
      data: {
        "prerequisite-validation.sh": prerequisiteScriptContent,
      },
    },
    { ...opts, dependsOn: [serviceAccount] },
  );

  // Create prerequisite validation job with unique name
  const timestamp = Date.now().toString();
  const validationJob = new k8s.batch.v1.Job(
    `${componentName}-prerequisite-validation-${timestamp}`,
    {
      metadata: {
        name: `${componentName}-prerequisite-validation-${timestamp}`,
        namespace,
        labels: {
          "app.kubernetes.io/name": "longhorn",
          "app.kubernetes.io/managed-by": "pulumi",
          "app.kubernetes.io/component": "prerequisite-validation",
        },
      },
      spec: {
        ttlSecondsAfterFinished: 300, // Clean up after 5 minutes
        backoffLimit: 2, // Allow 2 retries
        template: {
          spec: {
            restartPolicy: "Never",
            serviceAccountName: serviceAccount.metadata.name,
            containers: [
              {
                name: "prerequisite-validation",
                image: "bitnami/kubectl:1.31.2",
                command: ["/bin/bash"],
                args: ["/scripts/prerequisite-validation.sh"],
                env: [
                  {
                    name: "NAMESPACE",
                    value: namespace,
                  },
                  {
                    name: "COMPONENT_NAME",
                    value: componentName,
                  },
                  {
                    name: "TIMEOUT_SECONDS",
                    value: timeoutSeconds.toString(),
                  },
                ],
                volumeMounts: [
                  {
                    name: "prerequisite-script",
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
                name: "prerequisite-script",
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
    { ...opts, dependsOn: [configMap, roleBinding] },
  );

  return {
    serviceAccount,
    role,
    roleBinding,
    configMap,
    validationJob,
  };
}

/**
 * Generates the validation script based on configuration options.
 *
 * @param options - Validation script generation options
 * @returns Complete bash script for prerequisite validation
 */

/**
 * Validates the prerequisite validation configuration to ensure all required fields are present
 * and meet the requirements for Longhorn prerequisite validation.
 *
 * @param config - Configuration to validate
 * @throws Error if configuration is invalid
 */
function validatePrerequisiteConfig(config: IPrerequisiteValidationConfig): void {
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

  // Validate required packages array
  if (config.requiredPackages !== undefined) {
    if (!Array.isArray(config.requiredPackages)) {
      throw new Error("requiredPackages must be an array");
    }

    for (const pkg of config.requiredPackages) {
      if (typeof pkg !== "string" || pkg.trim() === "") {
        throw new Error("All items in requiredPackages must be non-empty strings");
      }
    }
  }

  // Validate node selector
  if (config.nodeSelector !== undefined) {
    if (typeof config.nodeSelector !== "object" || config.nodeSelector === null) {
      throw new Error("nodeSelector must be an object");
    }

    for (const [key, value] of Object.entries(config.nodeSelector)) {
      if (typeof key !== "string" || typeof value !== "string") {
        throw new Error("nodeSelector keys and values must be strings");
      }
    }
  }
}

/**
 * Creates a simple prerequisite validation job for open-iscsi validation.
 * This is a convenience function for the most common Longhorn prerequisite validation use case.
 *
 * @param componentName - Name of the component for resource naming
 * @param namespace - Kubernetes namespace
 * @param opts - Pulumi component resource options
 * @returns Prerequisite validation resources with open-iscsi validation
 */
export function createOpenIscsiValidation(
  componentName: string,
  namespace: string,
  opts?: pulumi.ComponentResourceOptions,
): IPrerequisiteValidationResources {
  return createPrerequisiteValidation(
    {
      componentName,
      namespace,
      validateOpenIscsi: true,
      requiredPackages: ["open-iscsi"],
    },
    opts,
  );
}

/**
 * Creates a comprehensive prerequisite validation job for Longhorn with all recommended checks.
 * Includes open-iscsi, multipath-tools, and other system dependencies.
 *
 * @param componentName - Name of the component for resource naming
 * @param namespace - Kubernetes namespace
 * @param opts - Pulumi component resource options
 * @returns Prerequisite validation resources with comprehensive validation
 */
export function createComprehensiveValidation(
  componentName: string,
  namespace: string,
  opts?: pulumi.ComponentResourceOptions,
): IPrerequisiteValidationResources {
  return createPrerequisiteValidation(
    {
      componentName,
      namespace,
      validateOpenIscsi: true,
      validateMultipath: true,
      requiredPackages: ["open-iscsi", "multipath-tools"],
      timeoutSeconds: 900, // 15 minutes for comprehensive validation
    },
    opts,
  );
}
