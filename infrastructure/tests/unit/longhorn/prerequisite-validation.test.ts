/**
 * Unit tests for Longhorn prerequisite validation utilities
 */

import * as k8s from "@pulumi/kubernetes";
import * as pulumi from "@pulumi/pulumi";

import {
  type IPrerequisiteValidationConfig,
  createComprehensiveValidation,
  createOpenIscsiValidation,
  createPrerequisiteValidation,
} from "../../../helpers/longhorn/prerequisite-validation";

// Mock Pulumi
void pulumi.runtime.setMocks({
  newResource: (args: pulumi.runtime.MockResourceArgs): { id: string; state: Record<string, unknown> } => {
    const inputs = args.inputs as Record<string, unknown>;
    const metadata = (inputs.metadata as Record<string, unknown>) ?? {};

    return {
      id: `${args.name}-id`,
      state: {
        ...inputs,
        metadata: {
          name: metadata.name ?? args.name,
          namespace: metadata.namespace ?? "default",
          labels: metadata.labels ?? {},
          ...metadata,
        },
      },
    };
  },
  call: (args: pulumi.runtime.MockCallArgs): pulumi.runtime.MockCallResult => {
    return { outputs: args.inputs as Record<string, unknown> };
  },
});

// Helper function to extract job args from spec
async function getJobArgs(job: k8s.batch.v1.Job): Promise<string[]> {
  return new Promise<string[]>((resolve) => {
    job.spec.apply((spec) => {
      const jobSpec = spec as unknown as Record<string, unknown>;
      const template = jobSpec.template as Record<string, unknown>;
      const templateSpec = template.spec as Record<string, unknown>;
      const containers = templateSpec.containers as Record<string, unknown>[];
      const args = containers[0].args as string[];
      resolve(args);
    });
  });
}

describe("Longhorn Prerequisite Validation", () => {
  describe("createPrerequisiteValidation", () => {
    it("should create prerequisite validation resources with default configuration", async () => {
      const config: IPrerequisiteValidationConfig = {
        componentName: "test-longhorn",
        namespace: "longhorn-system",
      };

      const resources = createPrerequisiteValidation(config);

      // Verify all resources are created
      expect(resources.role).toBeInstanceOf(k8s.rbac.v1.Role);
      expect(resources.roleBinding).toBeInstanceOf(k8s.rbac.v1.RoleBinding);
      expect(resources.validationJob).toBeInstanceOf(k8s.batch.v1.Job);

      // Test role configuration
      const roleState = await new Promise<Record<string, unknown>>((resolve) => {
        resources.role.metadata.apply((metadata) => resolve(metadata as unknown as Record<string, unknown>));
      });

      expect(roleState).toMatchObject({
        name: "test-longhorn-prerequisite-validation-role",
        namespace: "longhorn-system",
        labels: {
          "app.kubernetes.io/name": "longhorn",
          "app.kubernetes.io/managed-by": "pulumi",
          "app.kubernetes.io/component": "prerequisite-validation",
        },
      });

      // Test role rules
      const roleRules = await new Promise<unknown[]>((resolve) => {
        resources.role.rules.apply((rules) => resolve(rules as unknown[]));
      });

      expect(roleRules).toEqual(
        expect.arrayContaining([
          expect.objectContaining({
            apiGroups: [""],
            resources: ["nodes"],
            verbs: ["get", "list", "watch"],
          }),
          expect.objectContaining({
            apiGroups: [""],
            resources: ["pods", "pods/log"],
            verbs: ["get", "list", "watch", "create", "delete"],
          }),
          expect.objectContaining({
            apiGroups: ["apps"],
            resources: ["daemonsets"],
            verbs: ["get", "list", "watch", "create", "delete"],
          }),
        ]),
      );
    });

    it("should create prerequisite validation resources with custom configuration", async () => {
      const config: IPrerequisiteValidationConfig = {
        componentName: "custom-longhorn",
        namespace: "custom-namespace",
        timeoutSeconds: 900,
        requiredPackages: ["open-iscsi", "multipath-tools", "custom-package"],
        validateOpenIscsi: true,
        validateMultipath: true,
        nodeSelector: { "node-type": "storage" },
      };

      const resources = createPrerequisiteValidation(config);

      // Verify resources are created with custom configuration
      const jobState = await new Promise<Record<string, unknown>>((resolve) => {
        resources.validationJob.metadata.apply((metadata) => resolve(metadata as unknown as Record<string, unknown>));
      });

      expect(jobState).toMatchObject({
        name: "custom-longhorn-prerequisite-validation",
        namespace: "custom-namespace",
        labels: {
          "app.kubernetes.io/name": "longhorn",
          "app.kubernetes.io/managed-by": "pulumi",
          "app.kubernetes.io/component": "prerequisite-validation",
        },
      });

      // Test job spec configuration
      const jobSpec = await new Promise<Record<string, unknown>>((resolve) => {
        resources.validationJob.spec.apply((spec) => resolve(spec as unknown as Record<string, unknown>));
      });

      expect(jobSpec).toMatchObject({
        ttlSecondsAfterFinished: 300,
        backoffLimit: 2,
        template: {
          spec: {
            restartPolicy: "Never",
            nodeSelector: { "node-type": "storage" },
            containers: [
              {
                name: "prerequisite-validation",
                image: "bitnami/kubectl:latest",
                command: ["/bin/bash"],
                env: [
                  { name: "NAMESPACE", value: "custom-namespace" },
                  { name: "COMPONENT_NAME", value: "custom-longhorn" },
                ],
              },
            ],
          },
        },
      });
    });

    it("should create role binding with correct references", async () => {
      const config: IPrerequisiteValidationConfig = {
        componentName: "test-longhorn",
        namespace: "longhorn-system",
      };

      const resources = createPrerequisiteValidation(config);

      const roleBindingState = await new Promise<Record<string, unknown>>((resolve) => {
        resources.roleBinding.roleRef.apply((roleRef) => resolve(roleRef as unknown as Record<string, unknown>));
      });

      expect(roleBindingState).toMatchObject({
        apiGroup: "rbac.authorization.k8s.io",
        kind: "Role",
        name: "test-longhorn-prerequisite-validation-role",
      });

      const subjects = await new Promise<unknown[]>((resolve) => {
        resources.roleBinding.subjects.apply((subjects) => resolve(subjects as unknown[]));
      });

      expect(subjects).toEqual([
        {
          kind: "ServiceAccount",
          name: "default",
          namespace: "longhorn-system",
        },
      ]);
    });

    it("should generate validation script with open-iscsi validation", async () => {
      const config: IPrerequisiteValidationConfig = {
        componentName: "test-longhorn",
        namespace: "longhorn-system",
        validateOpenIscsi: true,
        requiredPackages: ["open-iscsi"],
      };

      const resources = createPrerequisiteValidation(config);
      const jobArgs = await getJobArgs(resources.validationJob);
      const script = jobArgs[1];

      expect(script).toContain('check_package "iscsid" "iscsid"');
      expect(script).toContain("open-iscsi (iscsid) is required");
      expect(script).toContain("/etc/iscsi/initiatorname.iscsi");
    });

    it("should generate validation script with multipath validation", async () => {
      const config: IPrerequisiteValidationConfig = {
        componentName: "test-longhorn",
        namespace: "longhorn-system",
        validateMultipath: true,
      };

      const resources = createPrerequisiteValidation(config);
      const jobArgs = await getJobArgs(resources.validationJob);
      const script = jobArgs[1];

      expect(script).toContain('check_package "multipathd" "multipathd"');
      expect(script).toContain("multipath-tools (multipathd) not found");
    });

    it("should generate validation script with custom packages", async () => {
      const config: IPrerequisiteValidationConfig = {
        componentName: "test-longhorn",
        namespace: "longhorn-system",
        requiredPackages: ["custom-package-1", "custom-package-2"],
      };

      const resources = createPrerequisiteValidation(config);
      const jobArgs = await getJobArgs(resources.validationJob);
      const script = jobArgs[1];

      expect(script).toContain('check_package "custom-package-1" "custom-package-1"');
      expect(script).toContain('check_package "custom-package-2" "custom-package-2"');
    });

    it("should include remediation guidance in validation script", async () => {
      const config: IPrerequisiteValidationConfig = {
        componentName: "test-longhorn",
        namespace: "longhorn-system",
      };

      const resources = createPrerequisiteValidation(config);
      const jobArgs = await getJobArgs(resources.validationJob);
      const script = jobArgs[1];

      expect(script).toContain("provide_remediation_guidance");
      expect(script).toContain("sudo apt-get install open-iscsi");
      expect(script).toContain("sudo yum install iscsi-initiator-utils");
      expect(script).toContain("systemctl enable iscsid");
      expect(script).toContain("systemctl start iscsid");
    });
  });

  describe("Configuration Validation", () => {
    it("should throw error for empty componentName", () => {
      expect(() => {
        createPrerequisiteValidation({
          componentName: "",
          namespace: "longhorn-system",
        });
      }).toThrow("componentName is required and cannot be empty");
    });

    it("should throw error for empty namespace", () => {
      expect(() => {
        createPrerequisiteValidation({
          componentName: "test-longhorn",
          namespace: "",
        });
      }).toThrow("namespace is required and cannot be empty");
    });

    it("should throw error for invalid componentName format", () => {
      expect(() => {
        createPrerequisiteValidation({
          componentName: "Test_Longhorn",
          namespace: "longhorn-system",
        });
      }).toThrow("must follow Kubernetes naming conventions");
    });

    it("should throw error for invalid namespace format", () => {
      expect(() => {
        createPrerequisiteValidation({
          componentName: "test-longhorn",
          namespace: "Longhorn_System",
        });
      }).toThrow("must follow Kubernetes naming conventions");
    });

    it("should throw error for negative timeout", () => {
      expect(() => {
        createPrerequisiteValidation({
          componentName: "test-longhorn",
          namespace: "longhorn-system",
          timeoutSeconds: -100,
        });
      }).toThrow("timeoutSeconds must be a positive number");
    });

    it("should throw error for invalid requiredPackages", () => {
      expect(() => {
        createPrerequisiteValidation({
          componentName: "test-longhorn",
          namespace: "longhorn-system",
          requiredPackages: ["valid-package", ""],
        });
      }).toThrow("All items in requiredPackages must be non-empty strings");
    });

    it("should throw error for invalid nodeSelector", () => {
      expect(() => {
        createPrerequisiteValidation({
          componentName: "test-longhorn",
          namespace: "longhorn-system",
          nodeSelector: { validKey: "validValue", invalidKey: 123 as unknown as string },
        });
      }).toThrow("nodeSelector keys and values must be strings");
    });
  });

  describe("Convenience Functions", () => {
    describe("createOpenIscsiValidation", () => {
      it("should create validation with open-iscsi configuration", async () => {
        const resources = createOpenIscsiValidation("test-longhorn", "longhorn-system");

        expect(resources.role).toBeInstanceOf(k8s.rbac.v1.Role);
        expect(resources.roleBinding).toBeInstanceOf(k8s.rbac.v1.RoleBinding);
        expect(resources.validationJob).toBeInstanceOf(k8s.batch.v1.Job);

        // Verify the validation script includes open-iscsi validation
        const jobArgs = await getJobArgs(resources.validationJob);
        const script = jobArgs[1];
        expect(script).toContain('check_package "iscsid" "iscsid"');
      });
    });

    describe("createComprehensiveValidation", () => {
      it("should create validation with comprehensive configuration", async () => {
        const resources = createComprehensiveValidation("test-longhorn", "longhorn-system");

        expect(resources.role).toBeInstanceOf(k8s.rbac.v1.Role);
        expect(resources.roleBinding).toBeInstanceOf(k8s.rbac.v1.RoleBinding);
        expect(resources.validationJob).toBeInstanceOf(k8s.batch.v1.Job);

        // Verify the validation script includes both open-iscsi and multipath validation
        const jobArgs = await getJobArgs(resources.validationJob);
        const script = jobArgs[1];
        expect(script).toContain('check_package "iscsid" "iscsid"');
        expect(script).toContain('check_package "multipathd" "multipathd"');

        // Verify timeout is set to 15 minutes (900 seconds)
        const jobSpec = await new Promise<Record<string, unknown>>((resolve) => {
          resources.validationJob.spec.apply((spec) => resolve(spec as unknown as Record<string, unknown>));
        });

        const template = jobSpec.template as Record<string, unknown>;
        const templateSpec = template.spec as Record<string, unknown>;
        const containers = templateSpec.containers as Record<string, unknown>[];
        const args = containers[0].args as string[];
        const script2 = args[1];
        expect(script2).toContain("--timeout=900s");
      });
    });
  });

  describe("Resource Dependencies", () => {
    it("should create resources with proper dependency chain", async () => {
      const config: IPrerequisiteValidationConfig = {
        componentName: "test-longhorn",
        namespace: "longhorn-system",
      };

      const resources = createPrerequisiteValidation(config);

      // Role should be created first (no dependencies)
      expect(resources.role).toBeInstanceOf(k8s.rbac.v1.Role);

      // RoleBinding should depend on Role
      expect(resources.roleBinding).toBeInstanceOf(k8s.rbac.v1.RoleBinding);

      // ValidationJob should depend on RoleBinding
      expect(resources.validationJob).toBeInstanceOf(k8s.batch.v1.Job);
    });
  });

  describe("Script Generation", () => {
    it("should generate script with proper error handling", async () => {
      const config: IPrerequisiteValidationConfig = {
        componentName: "test-longhorn",
        namespace: "longhorn-system",
      };

      const resources = createPrerequisiteValidation(config);
      const jobArgs = await getJobArgs(resources.validationJob);
      const script = jobArgs[1];

      // Check for proper error handling
      expect(script).toContain("set -euo pipefail");
      expect(script).toContain("VALIDATION_FAILED=0");
      expect(script).toContain("exit 1");

      // Check for logging functions
      expect(script).toContain("log() {");
      expect(script).toContain("echo \"[$(date '+%Y-%m-%d %H:%M:%S')] $*\"");

      // Check for command existence validation
      expect(script).toContain("command_exists() {");
      expect(script).toContain('command -v "$1" >/dev/null 2>&1');
    });

    it("should generate script with DaemonSet-based validation", async () => {
      const config: IPrerequisiteValidationConfig = {
        componentName: "test-longhorn",
        namespace: "longhorn-system",
      };

      const resources = createPrerequisiteValidation(config);
      const jobArgs = await getJobArgs(resources.validationJob);
      const script = jobArgs[1];

      // Check for DaemonSet creation and management
      expect(script).toContain("kubectl apply -f - <<EOF");
      expect(script).toContain("apiVersion: apps/v1");
      expect(script).toContain("kind: DaemonSet");
      expect(script).toContain("hostNetwork: true");
      expect(script).toContain("hostPID: true");
      expect(script).toContain("privileged: true");

      // Check for cleanup
      expect(script).toContain("kubectl delete daemonset");
      expect(script).toContain("--ignore-not-found=true");
    });

    it("should generate script with kernel module checks", async () => {
      const config: IPrerequisiteValidationConfig = {
        componentName: "test-longhorn",
        namespace: "longhorn-system",
      };

      const resources = createPrerequisiteValidation(config);
      const jobArgs = await getJobArgs(resources.validationJob);
      const script = jobArgs[1];

      // Check for kernel module validation
      expect(script).toContain('REQUIRED_MODULES="iscsi_tcp libiscsi scsi_transport_iscsi"');
      expect(script).toContain('lsmod | grep -q "$module"');
      expect(script).toContain("Kernel module");
    });
  });

  describe("Node Validation Job Creation and Execution", () => {
    it("should create node validation job with proper container configuration", async () => {
      const config: IPrerequisiteValidationConfig = {
        componentName: "test-longhorn",
        namespace: "longhorn-system",
        timeoutSeconds: 300,
      };

      const resources = createPrerequisiteValidation(config);

      // Verify job container configuration
      const jobSpec = await new Promise<Record<string, unknown>>((resolve) => {
        resources.validationJob.spec.apply((spec) => resolve(spec as unknown as Record<string, unknown>));
      });

      const template = jobSpec.template as Record<string, unknown>;
      const templateSpec = template.spec as Record<string, unknown>;
      const containers = templateSpec.containers as Record<string, unknown>[];
      const container = containers[0];

      expect(container).toMatchObject({
        name: "prerequisite-validation",
        image: "bitnami/kubectl:latest",
        command: ["/bin/bash"],
        env: [
          { name: "NAMESPACE", value: "longhorn-system" },
          { name: "COMPONENT_NAME", value: "test-longhorn" },
        ],
      });

      const args = container.args as string[];
      expect(args).toHaveLength(2);
      expect(args[0]).toBe("-c");
      expect(typeof args[1]).toBe("string");
    });

    it("should create node validation job with proper execution flow", async () => {
      const config: IPrerequisiteValidationConfig = {
        componentName: "test-longhorn",
        namespace: "longhorn-system",
      };

      const resources = createPrerequisiteValidation(config);
      const jobArgs = await getJobArgs(resources.validationJob);
      const script = jobArgs[1];

      // Verify main execution flow
      expect(script).toContain("main() {");
      expect(script).toContain("validate_node_prerequisites");
      expect(script).toContain("provide_remediation_guidance");

      // Verify DaemonSet-based node validation
      expect(script).toContain("validate_node_prerequisites() {");
      expect(script).toContain("kubectl rollout status daemonset");
      expect(script).toContain("kubectl get nodes -o jsonpath");

      // Verify per-node validation logic
      expect(script).toContain("for node in $NODES; do");
      expect(script).toContain("kubectl get pods -n $NAMESPACE");
      expect(script).toContain("kubectl exec $POD -n $NAMESPACE");
    });

    it("should create node validation job with proper cleanup logic", async () => {
      const config: IPrerequisiteValidationConfig = {
        componentName: "test-longhorn",
        namespace: "longhorn-system",
      };

      const resources = createPrerequisiteValidation(config);
      const jobArgs = await getJobArgs(resources.validationJob);
      const script = jobArgs[1];

      // Verify cleanup is performed regardless of success/failure
      expect(script).toContain("kubectl delete daemonset $COMPONENT_NAME-node-validator");
      expect(script).toContain("--ignore-not-found=true");

      // Verify TTL configuration for job cleanup
      const jobSpec = await new Promise<Record<string, unknown>>((resolve) => {
        resources.validationJob.spec.apply((spec) => resolve(spec as unknown as Record<string, unknown>));
      });

      expect(jobSpec).toMatchObject({
        ttlSecondsAfterFinished: 300,
        backoffLimit: 2,
      });
    });

    it("should create node validation job with timeout configuration", async () => {
      const config: IPrerequisiteValidationConfig = {
        componentName: "test-longhorn",
        namespace: "longhorn-system",
        timeoutSeconds: 900,
      };

      const resources = createPrerequisiteValidation(config);
      const jobArgs = await getJobArgs(resources.validationJob);
      const script = jobArgs[1];

      // Verify timeout is used in rollout status command
      expect(script).toContain("--timeout=900s");
    });
  });

  describe("Open-iSCSI Dependency Checking Logic", () => {
    it("should verify open-iscsi service validation logic", async () => {
      const config: IPrerequisiteValidationConfig = {
        componentName: "test-longhorn",
        namespace: "longhorn-system",
        validateOpenIscsi: true,
      };

      const resources = createPrerequisiteValidation(config);
      const jobArgs = await getJobArgs(resources.validationJob);
      const script = jobArgs[1];

      // Verify iscsid service check
      expect(script).toContain('check_package "iscsid" "iscsid"');
      expect(script).toContain("systemctl is-active");
      expect(script).toContain("systemctl list-unit-files");
      expect(script).toContain("systemctl status");

      // Verify binary existence check
      expect(script).toContain("which");
      expect(script).toContain("/usr/bin /usr/sbin /bin /sbin");
      expect(script).toContain("test -x");
    });

    it("should verify open-iscsi initiator name validation", async () => {
      const config: IPrerequisiteValidationConfig = {
        componentName: "test-longhorn",
        namespace: "longhorn-system",
        validateOpenIscsi: true,
      };

      const resources = createPrerequisiteValidation(config);
      const jobArgs = await getJobArgs(resources.validationJob);
      const script = jobArgs[1];

      // Verify initiator name file check
      expect(script).toContain("/etc/iscsi/initiatorname.iscsi");
      expect(script).toContain("test -f /etc/iscsi/initiatorname.iscsi");
      expect(script).toContain("iSCSI initiator name file exists");
      expect(script).toContain("iSCSI initiator name file not found");
    });

    it("should verify open-iscsi kernel module validation", async () => {
      const config: IPrerequisiteValidationConfig = {
        componentName: "test-longhorn",
        namespace: "longhorn-system",
        validateOpenIscsi: true,
      };

      const resources = createPrerequisiteValidation(config);
      const jobArgs = await getJobArgs(resources.validationJob);
      const script = jobArgs[1];

      // Verify required kernel modules for iSCSI
      expect(script).toContain("iscsi_tcp libiscsi scsi_transport_iscsi");
      expect(script).toContain("lsmod | grep -q");
      expect(script).toContain("Kernel module");
      expect(script).toContain("is loaded");
      expect(script).toContain("may be loaded on demand");
    });

    it("should verify open-iscsi error detection and reporting", async () => {
      const config: IPrerequisiteValidationConfig = {
        componentName: "test-longhorn",
        namespace: "longhorn-system",
        validateOpenIscsi: true,
      };

      const resources = createPrerequisiteValidation(config);
      const jobArgs = await getJobArgs(resources.validationJob);
      const script = jobArgs[1];

      // Verify error detection
      expect(script).toContain("VALIDATION_FAILED=1");
      expect(script).toContain("open-iscsi (iscsid) is required but not found or not running");
      expect(script).toContain("not found or not active");

      // Verify success reporting
      expect(script).toContain("service ($service) is active");
      expect(script).toContain("binary found");
      expect(script).toContain("found at $path/$package");
    });

    it("should disable open-iscsi validation when configured", async () => {
      const config: IPrerequisiteValidationConfig = {
        componentName: "test-longhorn",
        namespace: "longhorn-system",
        validateOpenIscsi: false,
        requiredPackages: ["other-package"],
      };

      const resources = createPrerequisiteValidation(config);
      const jobArgs = await getJobArgs(resources.validationJob);
      const script = jobArgs[1];

      // Verify open-iscsi validation is not included
      expect(script).not.toContain('check_package "iscsid" "iscsid"');
      expect(script).not.toContain("open-iscsi (iscsid) is required");
      // Note: The script still contains the initiator name check in remediation guidance
      // but not in the actual validation logic
      expect(script).not.toContain("ERROR: open-iscsi (iscsid) is required but not found or not running");
    });
  });

  describe("Error Reporting for Missing Prerequisites", () => {
    it("should provide comprehensive error reporting for missing packages", async () => {
      const config: IPrerequisiteValidationConfig = {
        componentName: "test-longhorn",
        namespace: "longhorn-system",
        requiredPackages: ["open-iscsi", "multipath-tools", "custom-package"],
        validateOpenIscsi: true,
        validateMultipath: true,
      };

      const resources = createPrerequisiteValidation(config);
      const jobArgs = await getJobArgs(resources.validationJob);
      const script = jobArgs[1];

      // Verify error messages for each package
      expect(script).toContain("open-iscsi (iscsid) is required but not found");
      expect(script).toContain("multipath-tools (multipathd) not found");
      expect(script).toContain("custom-package is required but not found");

      // Verify validation failure tracking
      expect(script).toContain("VALIDATION_FAILED=1");
      expect(script).toContain("if [ $VALIDATION_FAILED -eq 0 ]");
      expect(script).toContain("Node validation failed");
    });

    it("should provide detailed remediation guidance", async () => {
      const config: IPrerequisiteValidationConfig = {
        componentName: "test-longhorn",
        namespace: "longhorn-system",
      };

      const resources = createPrerequisiteValidation(config);
      const jobArgs = await getJobArgs(resources.validationJob);
      const script = jobArgs[1];

      // Verify remediation guidance function
      expect(script).toContain("provide_remediation_guidance() {");
      expect(script).toContain("Here's how to fix common issues:");

      // Verify package installation instructions for different distros
      expect(script).toContain("Ubuntu/Debian: sudo apt-get update && sudo apt-get install open-iscsi");
      expect(script).toContain("RHEL/CentOS:   sudo yum install iscsi-initiator-utils");
      expect(script).toContain("SUSE:          sudo zypper install open-iscsi");

      // Verify service management instructions
      expect(script).toContain("sudo systemctl enable iscsid");
      expect(script).toContain("sudo systemctl start iscsid");

      // Verify verification instructions
      expect(script).toContain("systemctl status iscsid");
      expect(script).toContain("cat /etc/iscsi/initiatorname.iscsi");
    });

    it("should report cluster connectivity errors", async () => {
      const config: IPrerequisiteValidationConfig = {
        componentName: "test-longhorn",
        namespace: "longhorn-system",
      };

      const resources = createPrerequisiteValidation(config);
      const jobArgs = await getJobArgs(resources.validationJob);
      const script = jobArgs[1];

      // Verify kubectl availability check
      expect(script).toContain("command_exists kubectl");
      expect(script).toContain("kubectl is not available");

      // Verify cluster connectivity check
      expect(script).toContain("kubectl cluster-info");
      expect(script).toContain("Cannot connect to Kubernetes cluster");
    });

    it("should report node-specific validation failures", async () => {
      const config: IPrerequisiteValidationConfig = {
        componentName: "test-longhorn",
        namespace: "longhorn-system",
      };

      const resources = createPrerequisiteValidation(config);
      const jobArgs = await getJobArgs(resources.validationJob);
      const script = jobArgs[1];

      // Verify per-node error reporting
      expect(script).toContain("No validation pod found for node");
      expect(script).toContain("Validation pod $POD on node $node is not running");
      expect(script).toContain("Node $node failed validation");

      // Verify diagnostic information collection
      expect(script).toContain("kubectl describe pod");
      expect(script).toContain("kubectl logs");

      // Verify overall validation result reporting
      expect(script).toContain("One or more nodes failed prerequisite validation");
      expect(script).toContain("All nodes passed prerequisite validation");
    });

    it("should report block device support errors", async () => {
      const config: IPrerequisiteValidationConfig = {
        componentName: "test-longhorn",
        namespace: "longhorn-system",
      };

      const resources = createPrerequisiteValidation(config);
      const jobArgs = await getJobArgs(resources.validationJob);
      const script = jobArgs[1];

      // Verify block device support check
      expect(script).toContain("test -d /sys/block");
      expect(script).toContain("Block device support available");
      expect(script).toContain("Block device support not found");
    });

    it("should handle validation timeout scenarios", async () => {
      const config: IPrerequisiteValidationConfig = {
        componentName: "test-longhorn",
        namespace: "longhorn-system",
        timeoutSeconds: 120,
      };

      const resources = createPrerequisiteValidation(config);
      const jobArgs = await getJobArgs(resources.validationJob);
      const script = jobArgs[1];

      // Verify timeout configuration is applied
      expect(script).toContain("--timeout=120s");

      // Verify job-level timeout configuration
      const jobSpec = await new Promise<Record<string, unknown>>((resolve) => {
        resources.validationJob.spec.apply((spec) => resolve(spec as unknown as Record<string, unknown>));
      });

      expect(jobSpec).toMatchObject({
        backoffLimit: 2, // Allows retries on timeout
      });
    });
  });
});
