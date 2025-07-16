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
  readonly role: k8s.rbac.v1.Role;
  readonly roleBinding: k8s.rbac.v1.RoleBinding;
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
export function createCrdManagement(
  config: ICrdManagementConfig,
  opts?: pulumi.ComponentResourceOptions,
): ICrdManagementResources {
  const { componentName, namespace, timeoutSeconds = 300, requiredSettings = [] } = config;

  // Create RBAC for CRD management jobs
  const role = new k8s.rbac.v1.Role(
    `${componentName}-crd-management-role`,
    {
      metadata: {
        name: `${componentName}-crd-management-role`,
        namespace,
        labels: {
          "app.kubernetes.io/name": "longhorn",
          "app.kubernetes.io/managed-by": "pulumi",
          "app.kubernetes.io/component": "crd-management",
        },
      },
      rules: [
        // Permissions for CRD operations
        {
          apiGroups: ["apiextensions.k8s.io"],
          resources: ["customresourcedefinitions"],
          verbs: ["get", "list", "watch", "create", "update", "patch"],
        },
        // Permissions for Longhorn custom resources
        {
          apiGroups: ["longhorn.io"],
          resources: ["*"],
          verbs: ["get", "list", "watch", "create", "update", "patch", "delete"],
        },
        // Permissions for settings management
        {
          apiGroups: ["longhorn.io"],
          resources: ["settings"],
          verbs: ["get", "list", "watch", "create", "update", "patch", "delete"],
        },
      ],
    },
    opts,
  );

  const roleBinding = new k8s.rbac.v1.RoleBinding(
    `${componentName}-crd-management-rolebinding`,
    {
      metadata: {
        name: `${componentName}-crd-management-rolebinding`,
        namespace,
        labels: {
          "app.kubernetes.io/name": "longhorn",
          "app.kubernetes.io/managed-by": "pulumi",
          "app.kubernetes.io/component": "crd-management",
        },
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

  // Create CRD pre-creation and validation job
  const preCreationJob = new k8s.batch.v1.Job(
    `${componentName}-crd-precreation`,
    {
      metadata: {
        name: `${componentName}-crd-precreation`,
        namespace,
        generateName: `${componentName}-crd-precreation-`,
        labels: {
          "app.kubernetes.io/name": "longhorn",
          "app.kubernetes.io/managed-by": "pulumi",
          "app.kubernetes.io/component": "crd-management",
        },
      },
      spec: {
        ttlSecondsAfterFinished: 300, // Clean up after 5 minutes
        backoffLimit: 3, // Allow 3 retries
        template: {
          spec: {
            restartPolicy: "Never",
            containers: [
              {
                name: "crd-precreation",
                image: "bitnami/kubectl:latest",
                command: ["/bin/bash"],
                args: [
                  "-c",
                  `
                  set -euo pipefail

                  echo "Starting Longhorn CRD pre-creation and validation..."

                  # Function to check if CRD exists
                  check_crd_exists() {
                    local crd_name="$1"
                    if kubectl get crd "$crd_name" >/dev/null 2>&1; then
                      echo "CRD $crd_name already exists"
                      return 0
                    else
                      echo "CRD $crd_name does not exist"
                      return 1
                    fi
                  }

                  # Function to wait for CRD to be established
                  wait_for_crd() {
                    local crd_name="$1"
                    echo "Waiting for CRD $crd_name to be established..."
                    kubectl wait --for=condition=Established crd/"$crd_name" --timeout=${timeoutSeconds}s
                    echo "CRD $crd_name is established"
                  }

                  # List of required Longhorn CRDs
                  REQUIRED_CRDS=(
                    "settings.longhorn.io"
                    "volumes.longhorn.io"
                    "engines.longhorn.io"
                    "replicas.longhorn.io"
                    "nodes.longhorn.io"
                    "instancemanagers.longhorn.io"
                    "engineimages.longhorn.io"
                    "sharemanagers.longhorn.io"
                    "backingimages.longhorn.io"
                    "backingimagemanagers.longhorn.io"
                    "backups.longhorn.io"
                    "backupvolumes.longhorn.io"
                    "backuptargets.longhorn.io"
                    "recurringjobs.longhorn.io"
                  )

                  # Check for existing CRDs and validate versions
                  echo "Checking existing Longhorn CRDs..."
                  for crd in "\${REQUIRED_CRDS[@]}"; do
                    if check_crd_exists "$crd"; then
                      # Validate CRD version compatibility
                      crd_version=$(kubectl get crd "$crd" -o jsonpath='{.spec.versions[0].name}' 2>/dev/null || echo "unknown")
                      echo "Found CRD $crd with version: $crd_version"

                      # Check if CRD is in a good state
                      crd_status=$(kubectl get crd "$crd" -o jsonpath='{.status.conditions[?(@.type=="Established")].status}' 2>/dev/null || echo "unknown")
                      if [[ "$crd_status" != "True" ]]; then
                        echo "Warning: CRD $crd is not in Established state: $crd_status"
                      fi
                    fi
                  done

                  # Wait for any existing CRDs to be established
                  echo "Ensuring all existing Longhorn CRDs are established..."
                  for crd in "\${REQUIRED_CRDS[@]}"; do
                    if check_crd_exists "$crd"; then
                      wait_for_crd "$crd"
                    fi
                  done

                  echo "CRD pre-creation validation completed successfully"
                  `,
                ],
              },
            ],
          },
        },
      },
    },
    { ...opts, dependsOn: [roleBinding] },
  );

  let settingsJob: k8s.batch.v1.Job | undefined;

  // Create settings pre-creation job if required settings are specified
  if (requiredSettings.length > 0) {
    const settingsScript = requiredSettings
      .map(
        (setting) => `
        echo "Creating/updating Longhorn setting: ${setting.name}"
        kubectl apply -f - <<EOF
apiVersion: longhorn.io/v1beta2
kind: Setting
metadata:
  name: ${setting.name}
  namespace: ${namespace}
  labels:
    app.kubernetes.io/name: longhorn
    app.kubernetes.io/managed-by: pulumi
    app.kubernetes.io/component: settings
value: "${setting.value}"
EOF
        echo "Setting ${setting.name} created/updated successfully"

        # Verify the setting was applied correctly
        echo "Verifying setting ${setting.name}..."
        kubectl get settings.longhorn.io ${setting.name} -n ${namespace} -o jsonpath='{.value}' | grep -q "${setting.value}"
        echo "Setting ${setting.name} verified with value: ${setting.value}"
        `,
      )
      .join("\n");

    settingsJob = new k8s.batch.v1.Job(
      `${componentName}-settings-precreation`,
      {
        metadata: {
          name: `${componentName}-settings-precreation`,
          namespace,
          generateName: `${componentName}-settings-precreation-`,
          labels: {
            "app.kubernetes.io/name": "longhorn",
            "app.kubernetes.io/managed-by": "pulumi",
            "app.kubernetes.io/component": "settings-management",
          },
        },
        spec: {
          ttlSecondsAfterFinished: 300, // Clean up after 5 minutes
          backoffLimit: 3, // Allow 3 retries
          template: {
            spec: {
              restartPolicy: "Never",
              containers: [
                {
                  name: "settings-precreation",
                  image: "bitnami/kubectl:latest",
                  command: ["/bin/bash"],
                  args: [
                    "-c",
                    `
                    set -euo pipefail

                    echo "Starting Longhorn settings pre-creation..."

                    # Wait for settings CRD to be available
                    echo "Waiting for settings CRD to be available..."
                    kubectl wait --for=condition=Established crd/settings.longhorn.io --timeout=${timeoutSeconds}s

                    # Create required settings
                    ${settingsScript}

                    echo "Settings pre-creation completed successfully"
                    `,
                  ],
                },
              ],
            },
          },
        },
      },
      { ...opts, dependsOn: [preCreationJob] },
    );
  }

  return {
    role,
    roleBinding,
    preCreationJob,
    settingsJob,
  };
}

/**
 * Creates a job specifically for the deleting-confirmation-flag setting.
 * This is a convenience function for the most common Longhorn CRD management use case.
 *
 * @param componentName - Name of the component for resource naming
 * @param namespace - Kubernetes namespace
 * @param opts - Pulumi component resource options
 * @returns CRD management resources with deleting-confirmation-flag setting
 */
export function createDeletingConfirmationFlagJob(
  componentName: string,
  namespace: string,
  opts?: pulumi.ComponentResourceOptions,
): ICrdManagementResources {
  return createCrdManagement(
    {
      componentName,
      namespace,
      requiredSettings: [
        {
          name: "deleting-confirmation-flag",
          value: "true",
        },
      ],
    },
    opts,
  );
}
