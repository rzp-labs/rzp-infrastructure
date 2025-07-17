/**
 * Longhorn Prerequisite Validation Utilities
 *
 * Provides standardized prerequisite validation for Longhorn deployment.
 * Validates node-level requirements like open-iscsi installation and other
 * system dependencies before Longhorn deployment begins.
 */

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
  const {
    componentName,
    namespace,
    timeoutSeconds = 600,
    requiredPackages = ["open-iscsi"],
    validateOpenIscsi = true,
    validateMultipath = false,
    nodeSelector = {},
  } = config;

  // Validate configuration
  validatePrerequisiteConfig(config);

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
        // Permissions for pod operations
        {
          apiGroups: [""],
          resources: ["pods", "pods/log"],
          verbs: ["get", "list", "watch", "create", "delete"],
        },
        // Permissions for DaemonSet operations
        {
          apiGroups: ["apps"],
          resources: ["daemonsets"],
          verbs: ["get", "list", "watch", "create", "delete"],
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

  // Generate validation script based on configuration
  const validationScript = generateValidationScript({
    requiredPackages,
    validateOpenIscsi,
    validateMultipath,
    timeoutSeconds,
  });

  // Create prerequisite validation job with unique name
  const timestamp = Date.now().toString();
  const validationJob = new k8s.batch.v1.Job(
    `${componentName}-prerequisite-validation-${timestamp}`,
    {
      metadata: {
        name: `${componentName}-prerequisite-validation-${Date.now()}`,
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
            nodeSelector: Object.keys(nodeSelector).length > 0 ? nodeSelector : undefined,
            containers: [
              {
                name: "prerequisite-validation",
                image: "bitnami/kubectl:latest",
                command: ["/bin/bash"],
                args: ["-c", validationScript],
                env: [
                  {
                    name: "NAMESPACE",
                    value: namespace,
                  },
                  {
                    name: "COMPONENT_NAME",
                    value: componentName,
                  },
                ],
              },
            ],
          },
        },
      },
    },
    { ...opts, dependsOn: [roleBinding] },
  );

  return {
    serviceAccount,
    role,
    roleBinding,
    validationJob,
  };
}

/**
 * Generates the validation script based on configuration options.
 *
 * @param options - Validation script generation options
 * @returns Complete bash script for prerequisite validation
 */
function generateValidationScript(options: {
  requiredPackages: string[];
  validateOpenIscsi: boolean;
  validateMultipath: boolean;
  timeoutSeconds: number;
}): string {
  const { requiredPackages, validateOpenIscsi, validateMultipath, timeoutSeconds } = options;

  const openIscsiValidation = validateOpenIscsi
    ? `
          # Validate open-iscsi
          if ! check_package "iscsid" "iscsid"; then
            echo "WARNING: open-iscsi (iscsid) not found or not running"
            echo "Checking if Longhorn is already deployed and working..."

            # Check if Longhorn is already running successfully
            if kubectl get pods -n \$NAMESPACE -l app=longhorn-manager --field-selector=status.phase=Running >/dev/null 2>&1; then
              echo "✓ Longhorn manager pods are running - prerequisite validation relaxed for existing deployment"
            else
              echo "ERROR: open-iscsi (iscsid) is required but not found, and Longhorn is not running"
              VALIDATION_FAILED=1
            fi
          fi

          # Check for iscsi initiator name
          if nsenter --target 1 --mount --uts --ipc --net --pid -- test -f /etc/iscsi/initiatorname.iscsi; then
            echo "✓ iSCSI initiator name file exists"
            nsenter --target 1 --mount --uts --ipc --net --pid -- cat /etc/iscsi/initiatorname.iscsi
          else
            echo "⚠ iSCSI initiator name file not found"
          fi
          `
    : "";

  const multipathValidation = validateMultipath
    ? `
          # Validate multipath (optional but recommended)
          if ! check_package "multipathd" "multipathd"; then
            echo "WARNING: multipath-tools (multipathd) not found - this may affect storage performance"
          fi
          `
    : "";

  const customPackageValidation = requiredPackages
    .filter((pkg) => pkg !== "open-iscsi") // Already handled above
    .map(
      (pkg) => `
          if ! check_package "${pkg}" "${pkg}"; then
            echo "ERROR: ${pkg} is required but not found"
            VALIDATION_FAILED=1
          fi
          `,
    )
    .join("");

  return `
set -euo pipefail

echo "Starting Longhorn prerequisite validation..."

# Function to log with timestamp
log() {
  echo "[$(date '+%Y-%m-%d %H:%M:%S')] $*"
}

# Function to check if a command exists
command_exists() {
  command -v "$1" >/dev/null 2>&1
}

# Function to validate node prerequisites using DaemonSet
validate_node_prerequisites() {
  log "Creating DaemonSet for node prerequisite validation..."

  # Create DaemonSet for node validation
  kubectl apply -f - <<EOF
apiVersion: apps/v1
kind: DaemonSet
metadata:
  name: \$COMPONENT_NAME-node-validator
  namespace: \$NAMESPACE
  labels:
    app.kubernetes.io/name: longhorn
    app.kubernetes.io/component: node-validator
spec:
  selector:
    matchLabels:
      app.kubernetes.io/name: longhorn
      app.kubernetes.io/component: node-validator
  template:
    metadata:
      labels:
        app.kubernetes.io/name: longhorn
        app.kubernetes.io/component: node-validator
    spec:
      hostNetwork: true
      hostPID: true
      containers:
      - name: node-validator
        image: alpine:latest
        command: ["/bin/sh"]
        args:
        - -c
        - |
          set -e

          echo "Validating node: $(hostname)"

          # Install required tools
          apk add --no-cache util-linux findutils

          # Function to install a package based on the detected OS
          install_package() {
            local package="$1"

            echo "Detecting OS for package installation..."

            # Detect OS and install appropriate package
            if nsenter --target 1 --mount --uts --ipc --net --pid -- test -f /etc/debian_version; then
              echo "Detected Debian/Ubuntu - using apt-get"
              if nsenter --target 1 --mount --uts --ipc --net --pid -- apt-get update && \
                 nsenter --target 1 --mount --uts --ipc --net --pid -- apt-get install -y "$package"; then
                return 0
              fi
            elif nsenter --target 1 --mount --uts --ipc --net --pid -- test -f /etc/redhat-release; then
              echo "Detected RHEL/CentOS - using yum/dnf"
              # Try dnf first (newer systems), then yum
              if nsenter --target 1 --mount --uts --ipc --net --pid -- command -v dnf >/dev/null 2>&1; then
                if nsenter --target 1 --mount --uts --ipc --net --pid -- dnf install -y "iscsi-initiator-utils"; then
                  return 0
                fi
              elif nsenter --target 1 --mount --uts --ipc --net --pid -- command -v yum >/dev/null 2>&1; then
                if nsenter --target 1 --mount --uts --ipc --net --pid -- yum install -y "iscsi-initiator-utils"; then
                  return 0
                fi
              fi
            elif nsenter --target 1 --mount --uts --ipc --net --pid -- test -f /etc/SUSE-brand || \
                 nsenter --target 1 --mount --uts --ipc --net --pid -- test -f /etc/SuSE-release; then
              echo "Detected SUSE - using zypper"
              if nsenter --target 1 --mount --uts --ipc --net --pid -- zypper install -y "$package"; then
                return 0
              fi
            elif nsenter --target 1 --mount --uts --ipc --net --pid -- command -v apk >/dev/null 2>&1; then
              echo "Detected Alpine - using apk"
              if nsenter --target 1 --mount --uts --ipc --net --pid -- apk add "$package"; then
                return 0
              fi
            else
              echo "Unknown OS - cannot determine package manager"
              return 1
            fi

            echo "Package installation failed"
            return 1
          }

          # Function to check if a package/service is available and start it if needed
          check_package() {
            local package="$1"
            local service="$2"

            echo "Checking for $package..."

            # Check if service is running (systemd)
            if nsenter --target 1 --mount --uts --ipc --net --pid -- systemctl is-active "$service" >/dev/null 2>&1; then
              echo "✓ $package service ($service) is active"
              return 0
            fi

            # Check if service exists but not active - try to start it
            if nsenter --target 1 --mount --uts --ipc --net --pid -- systemctl list-unit-files | grep -q "$service"; then
              echo "⚠ $package service ($service) exists but is not active - attempting to start"

              # Try to start and enable the service
              if nsenter --target 1 --mount --uts --ipc --net --pid -- systemctl start "$service" && \
                 nsenter --target 1 --mount --uts --ipc --net --pid -- systemctl enable "$service"; then
                echo "✓ $package service ($service) started and enabled successfully"
                return 0
              else
                echo "✗ Failed to start $package service ($service)"
                nsenter --target 1 --mount --uts --ipc --net --pid -- systemctl status "$service" || true
                return 1
              fi
            fi

            # Check for binary existence
            if nsenter --target 1 --mount --uts --ipc --net --pid -- which "$package" >/dev/null 2>&1; then
              echo "⚠ $package binary found but service not available"
              return 1
            fi

            # Check common package locations
            for path in /usr/bin /usr/sbin /bin /sbin; do
              if nsenter --target 1 --mount --uts --ipc --net --pid -- test -x "$path/$package"; then
                echo "⚠ $package found at $path/$package but service not available"
                return 1
              fi
            done

            echo "✗ $package not found - attempting to install"

            # Attempt to install the package based on the OS
            if install_package "$package"; then
              echo "✓ $package installed successfully"

              # Try to start and enable the service after installation
              if nsenter --target 1 --mount --uts --ipc --net --pid -- systemctl start "$service" && \
                 nsenter --target 1 --mount --uts --ipc --net --pid -- systemctl enable "$service"; then
                echo "✓ $package service ($service) started and enabled after installation"
                return 0
              else
                echo "⚠ $package installed but failed to start service ($service)"
                nsenter --target 1 --mount --uts --ipc --net --pid -- systemctl status "$service" || true
                return 1
              fi
            else
              echo "✗ Failed to install $package"
              return 1
            fi
          }

          # Validation results
          VALIDATION_FAILED=0

          ${openIscsiValidation}

          ${multipathValidation}

          # Check for additional required packages
          ${customPackageValidation}

          # Check kernel modules
          echo "Checking kernel modules..."
          REQUIRED_MODULES="iscsi_tcp libiscsi scsi_transport_iscsi"
          for module in $REQUIRED_MODULES; do
            if nsenter --target 1 --mount --uts --ipc --net --pid -- lsmod | grep -q "$module"; then
              echo "✓ Kernel module $module is loaded"
            else
              echo "⚠ Kernel module $module is not loaded (may be loaded on demand)"
            fi
          done

          # Check for block device support
          echo "Checking block device support..."
          if nsenter --target 1 --mount --uts --ipc --net --pid -- test -d /sys/block; then
            echo "✓ Block device support available"
          else
            echo "✗ Block device support not found"
            VALIDATION_FAILED=1
          fi

          # Final validation result
          if [ $VALIDATION_FAILED -eq 0 ]; then
            echo "✓ Node validation passed for $(hostname)"
            # Create success marker
            touch /tmp/validation-success
          else
            echo "✗ Node validation failed for $(hostname)"
            exit 1
          fi
        securityContext:
          privileged: true
        volumeMounts:
        - name: host-root
          mountPath: /host
          readOnly: true
        - name: host-sys
          mountPath: /sys
          readOnly: true
        - name: host-proc
          mountPath: /proc
          readOnly: true
      volumes:
      - name: host-root
        hostPath:
          path: /
      - name: host-sys
        hostPath:
          path: /sys
      - name: host-proc
        hostPath:
          path: /proc
      tolerations:
      - operator: Exists
      restartPolicy: Always
EOF

  log "Waiting for DaemonSet to be ready..."
  kubectl rollout status daemonset/\$COMPONENT_NAME-node-validator -n \$NAMESPACE --timeout=${timeoutSeconds}s

  log "Checking validation results..."

  # Get all nodes
  NODES=$(kubectl get nodes -o jsonpath='{.items[*].metadata.name}')
  VALIDATION_SUCCESS=true

  for node in $NODES; do
    log "Checking validation result for node: $node"

    # Get pod for this node
    POD=$(kubectl get pods -n \$NAMESPACE -l app.kubernetes.io/component=node-validator --field-selector spec.nodeName=$node -o jsonpath='{.items[0].metadata.name}' 2>/dev/null || echo "")

    if [ -z "$POD" ]; then
      log "ERROR: No validation pod found for node $node"
      VALIDATION_SUCCESS=false
      continue
    fi

    # Check pod status
    POD_STATUS=$(kubectl get pod $POD -n \$NAMESPACE -o jsonpath='{.status.phase}' 2>/dev/null || echo "Unknown")

    if [ "$POD_STATUS" != "Running" ]; then
      log "ERROR: Validation pod $POD on node $node is not running (status: $POD_STATUS)"
      kubectl describe pod $POD -n \$NAMESPACE || true
      kubectl logs $POD -n \$NAMESPACE || true
      VALIDATION_SUCCESS=false
      continue
    fi

    # Check if validation succeeded
    if kubectl exec $POD -n \$NAMESPACE -- test -f /tmp/validation-success 2>/dev/null; then
      log "✓ Node $node passed validation"
    else
      log "✗ Node $node failed validation"
      kubectl logs $POD -n \$NAMESPACE || true
      VALIDATION_SUCCESS=false
    fi
  done

  # Cleanup DaemonSet
  log "Cleaning up validation DaemonSet..."
  kubectl delete daemonset \$COMPONENT_NAME-node-validator -n \$NAMESPACE --ignore-not-found=true

  if [ "$VALIDATION_SUCCESS" = "true" ]; then
    log "✓ All nodes passed prerequisite validation"
  else
    log "✗ One or more nodes failed prerequisite validation"
    exit 1
  fi
}

# Function to provide remediation guidance
provide_remediation_guidance() {
  log "Prerequisite validation failed. Here's how to fix common issues:"
  echo ""
  echo "=== AUTOMATIC REMEDIATION ATTEMPTED ==="
  echo "The validation job automatically tried to start required services."
  echo "If this failed, manual intervention may be required."
  echo ""
  echo "=== MANUAL REMEDIATION STEPS ==="
  echo ""
  echo "1. For open-iscsi installation:"
  echo "   Ubuntu/Debian: sudo apt-get update && sudo apt-get install open-iscsi"
  echo "   RHEL/CentOS:   sudo yum install iscsi-initiator-utils"
  echo "   SUSE:          sudo zypper install open-iscsi"
  echo ""
  echo "2. After installation, enable and start the service:"
  echo "   sudo systemctl enable iscsid"
  echo "   sudo systemctl start iscsid"
  echo ""
  echo "3. For multipath-tools (optional but recommended):"
  echo "   Ubuntu/Debian: sudo apt-get install multipath-tools"
  echo "   RHEL/CentOS:   sudo yum install device-mapper-multipath"
  echo ""
  echo "4. Verify installation with:"
  echo "   systemctl status iscsid"
  echo "   systemctl is-active iscsid"
  echo "   cat /etc/iscsi/initiatorname.iscsi"
  echo ""
  echo "5. Check kernel modules (should load automatically):"
  echo "   lsmod | grep iscsi"
  echo ""
  echo "=== DEBUGGING COMMANDS ==="
  echo "To debug on specific nodes:"
  echo "   kubectl debug node/<node-name> -it --image=busybox -- chroot /host systemctl status iscsid"
  echo "   kubectl debug node/<node-name> -it --image=busybox -- chroot /host systemctl start iscsid"
}

# Main validation execution
main() {
  log "Starting comprehensive prerequisite validation for Longhorn..."

  # Validate kubectl is available
  if ! command_exists "kubectl"; then
    log "ERROR: kubectl is not available"
    exit 1
  fi

  # Validate cluster connectivity
  if ! kubectl get nodes >/dev/null 2>&1; then
    log "ERROR: Cannot connect to Kubernetes cluster"
    exit 1
  fi

  # Check if Longhorn is already running successfully
  log "Checking if Longhorn is already deployed and working..."
  if kubectl get pods -n $NAMESPACE -l app=longhorn-manager --field-selector=status.phase=Running >/dev/null 2>&1; then
    log "✓ Longhorn manager pods are running - skipping prerequisite validation for existing deployment"
    log "✓ Prerequisite validation completed successfully (existing deployment)"
    exit 0
  fi

  log "No existing Longhorn deployment found - proceeding with prerequisite validation"

  # Run node prerequisite validation
  if validate_node_prerequisites; then
    log "✓ Prerequisite validation completed successfully"
    log "Longhorn deployment can proceed"
  else
    log "✗ Prerequisite validation failed"
    provide_remediation_guidance
    exit 1
  fi
}

# Execute main function
main
`;
}

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
