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
export function createCrdManagement(
  config: ICrdManagementConfig,
  opts?: pulumi.ComponentResourceOptions,
): ICrdManagementResources {
  const { componentName, namespace, timeoutSeconds = 300, requiredSettings = [] } = config;

  // Create ServiceAccount for CRD management jobs
  const serviceAccount = new k8s.core.v1.ServiceAccount(
    `${componentName}-crd-management-sa`,
    {
      metadata: {
        name: `${componentName}-crd-management`,
        namespace,
        labels: {
          "app.kubernetes.io/name": "longhorn",
          "app.kubernetes.io/managed-by": "pulumi",
          "app.kubernetes.io/component": "crd-management",
        },
      },
    },
    opts,
  );

  // Create ClusterRole for CRD management jobs (needs cluster-wide permissions for CRDs)
  const clusterRole = new k8s.rbac.v1.ClusterRole(
    `${componentName}-crd-management-clusterrole`,
    {
      metadata: {
        name: `${componentName}-crd-management-clusterrole`,
        labels: {
          "app.kubernetes.io/name": "longhorn",
          "app.kubernetes.io/managed-by": "pulumi",
          "app.kubernetes.io/component": "crd-management",
        },
      },
      rules: [
        // Permissions for CRD operations (cluster-scoped)
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
    { ...opts, dependsOn: [serviceAccount] },
  );

  const clusterRoleBinding = new k8s.rbac.v1.ClusterRoleBinding(
    `${componentName}-crd-management-clusterrolebinding`,
    {
      metadata: {
        name: `${componentName}-crd-management-clusterrolebinding`,
        labels: {
          "app.kubernetes.io/name": "longhorn",
          "app.kubernetes.io/managed-by": "pulumi",
          "app.kubernetes.io/component": "crd-management",
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
    { ...opts, dependsOn: [clusterRole] },
  );

  // Create CRD pre-creation and validation job with unique name
  const timestamp = Date.now().toString();
  const preCreationJob = new k8s.batch.v1.Job(
    `${componentName}-crd-precreation-${timestamp}`,
    {
      metadata: {
        name: `${componentName}-crd-precreation-${Date.now()}`,
        namespace,
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
            serviceAccountName: serviceAccount.metadata.name,
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
    { ...opts, dependsOn: [clusterRoleBinding] },
  );

  let settingsJob: k8s.batch.v1.Job | undefined;

  // Create settings pre-creation job if required settings are specified
  if (requiredSettings.length > 0) {
    const settingsScript = requiredSettings
      .map(
        (setting) => `
        echo "Checking if Longhorn setting ${setting.name} exists..."
        if kubectl get settings.longhorn.io ${setting.name} -n ${namespace} >/dev/null 2>&1; then
          CURRENT_VALUE=$(kubectl get settings.longhorn.io ${setting.name} -n ${namespace} -o jsonpath='{.value}')
          echo "Setting ${setting.name} already exists with value: $CURRENT_VALUE"
          if [ "$CURRENT_VALUE" = "${setting.value}" ]; then
            echo "Setting ${setting.name} already has the correct value: ${setting.value}"
          else
            echo "Updating setting ${setting.name} from $CURRENT_VALUE to ${setting.value}"
            kubectl patch settings.longhorn.io ${setting.name} -n ${namespace} --type='merge' -p='{"value":"${setting.value}"}'
            echo "Setting ${setting.name} updated successfully"
          fi
        else
          echo "Creating new Longhorn setting: ${setting.name}"
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
          echo "Setting ${setting.name} created successfully"
        fi

        # Verify the setting has the correct value
        echo "Verifying setting ${setting.name}..."
        FINAL_VALUE=$(kubectl get settings.longhorn.io ${setting.name} -n ${namespace} -o jsonpath='{.value}')
        if [ "$FINAL_VALUE" = "${setting.value}" ]; then
          echo "✓ Setting ${setting.name} verified with correct value: ${setting.value}"
        else
          echo "✗ Setting ${setting.name} has incorrect value: $FINAL_VALUE (expected: ${setting.value})"
          exit 1
        fi
        `,
      )
      .join("\n");

    settingsJob = new k8s.batch.v1.Job(
      `${componentName}-settings-precreation-${timestamp}`,
      {
        metadata: {
          name: `${componentName}-settings-precreation-${timestamp}`,
          namespace,
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
              serviceAccountName: serviceAccount.metadata.name,
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
    serviceAccount,
    clusterRole,
    clusterRoleBinding,
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
