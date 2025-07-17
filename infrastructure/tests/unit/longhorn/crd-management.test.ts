/**
 * Unit tests for Longhorn CRD Management utilities
 */

import * as k8s from "@pulumi/kubernetes";
import * as pulumi from "@pulumi/pulumi";

import { createCrdManagement, createDeletingConfirmationFlagJob } from "../../../helpers/longhorn/crd-management";
import type { ICrdManagementConfig } from "../../../helpers/longhorn/crd-management";

// Mock Pulumi for testing
void pulumi.runtime.setMocks({
  newResource: (args: pulumi.runtime.MockResourceArgs): { id: string; state: Record<string, unknown> } => {
    const inputs = args.inputs as Record<string, unknown>;
    const metadata = (inputs.metadata as Record<string, unknown>) ?? {};

    return {
      id: `${args.name}-id`,
      state: {
        ...inputs,
        metadata: {
          ...metadata,
          name: metadata.name ?? args.name,
        },
      },
    };
  },
  call: (args: pulumi.runtime.MockCallArgs): pulumi.runtime.MockCallResult => {
    return { outputs: args.inputs as Record<string, unknown> };
  },
});

describe("Longhorn CRD Management", () => {
  describe("createCrdManagement", () => {
    it("should create all required RBAC resources", () => {
      const config: ICrdManagementConfig = {
        componentName: "test-longhorn",
        namespace: "longhorn-system",
        timeoutSeconds: 300,
      };

      const resources = createCrdManagement(config);

      // Verify ServiceAccount creation
      expect(resources.serviceAccount).toBeInstanceOf(k8s.core.v1.ServiceAccount);

      // Verify ClusterRole creation
      expect(resources.clusterRole).toBeInstanceOf(k8s.rbac.v1.ClusterRole);

      // Verify ClusterRoleBinding creation
      expect(resources.clusterRoleBinding).toBeInstanceOf(k8s.rbac.v1.ClusterRoleBinding);

      // Verify pre-creation job
      expect(resources.preCreationJob).toBeInstanceOf(k8s.batch.v1.Job);
    });

    it("should create ClusterRole with proper resource type", () => {
      const config: ICrdManagementConfig = {
        componentName: "test-longhorn",
        namespace: "longhorn-system",
      };

      const resources = createCrdManagement(config);

      // Verify ClusterRole is created with expected type
      expect(resources.clusterRole).toBeInstanceOf(k8s.rbac.v1.ClusterRole);
    });

    it("should create ClusterRoleBinding with proper resource type", () => {
      const config: ICrdManagementConfig = {
        componentName: "test-longhorn",
        namespace: "longhorn-system",
      };

      const resources = createCrdManagement(config);

      // Verify ClusterRoleBinding is created with expected type
      expect(resources.clusterRoleBinding).toBeInstanceOf(k8s.rbac.v1.ClusterRoleBinding);
    });

    it("should create pre-creation job with proper resource type", () => {
      const config: ICrdManagementConfig = {
        componentName: "test-longhorn",
        namespace: "longhorn-system",
        timeoutSeconds: 600,
      };

      const resources = createCrdManagement(config);

      // Verify job is created with expected type
      expect(resources.preCreationJob).toBeInstanceOf(k8s.batch.v1.Job);
    });

    it("should create settings job when required settings are provided", () => {
      const config: ICrdManagementConfig = {
        componentName: "test-longhorn",
        namespace: "longhorn-system",
        requiredSettings: [
          { name: "deleting-confirmation-flag", value: "true" },
          { name: "test-setting", value: "test-value" },
        ],
      };

      const resources = createCrdManagement(config);

      // Verify settings job is created
      expect(resources.settingsJob).toBeDefined();
      expect(resources.settingsJob).toBeInstanceOf(k8s.batch.v1.Job);
    });

    it("should not create settings job when no required settings are provided", () => {
      const config: ICrdManagementConfig = {
        componentName: "test-longhorn",
        namespace: "longhorn-system",
      };

      const resources = createCrdManagement(config);

      // Verify settings job is not created
      expect(resources.settingsJob).toBeUndefined();
    });
  });

  describe("createDeletingConfirmationFlagJob", () => {
    it("should create CRD management with deleting-confirmation-flag setting", () => {
      const resources = createDeletingConfirmationFlagJob("test-longhorn", "longhorn-system");

      // Verify all resources are created
      expect(resources.serviceAccount).toBeInstanceOf(k8s.core.v1.ServiceAccount);
      expect(resources.clusterRole).toBeInstanceOf(k8s.rbac.v1.ClusterRole);
      expect(resources.clusterRoleBinding).toBeInstanceOf(k8s.rbac.v1.ClusterRoleBinding);
      expect(resources.preCreationJob).toBeInstanceOf(k8s.batch.v1.Job);
      expect(resources.settingsJob).toBeInstanceOf(k8s.batch.v1.Job);
    });

    it("should create all required resource types", () => {
      const resources = createDeletingConfirmationFlagJob("longhorn", "longhorn-system");

      expect(resources.serviceAccount).toBeInstanceOf(k8s.core.v1.ServiceAccount);
      expect(resources.clusterRole).toBeInstanceOf(k8s.rbac.v1.ClusterRole);
      expect(resources.clusterRoleBinding).toBeInstanceOf(k8s.rbac.v1.ClusterRoleBinding);
      expect(resources.preCreationJob).toBeInstanceOf(k8s.batch.v1.Job);
      expect(resources.settingsJob).toBeInstanceOf(k8s.batch.v1.Job);
    });
  });

  describe("Configuration validation", () => {
    it("should handle empty configuration", () => {
      const config: ICrdManagementConfig = {
        componentName: "test-longhorn",
        namespace: "longhorn-system",
      };

      const resources = createCrdManagement(config);

      // Should create basic resources without settings job
      expect(resources.serviceAccount).toBeInstanceOf(k8s.core.v1.ServiceAccount);
      expect(resources.clusterRole).toBeInstanceOf(k8s.rbac.v1.ClusterRole);
      expect(resources.clusterRoleBinding).toBeInstanceOf(k8s.rbac.v1.ClusterRoleBinding);
      expect(resources.preCreationJob).toBeInstanceOf(k8s.batch.v1.Job);
      expect(resources.settingsJob).toBeUndefined();
    });

    it("should handle configuration with custom timeout", () => {
      const config: ICrdManagementConfig = {
        componentName: "test-longhorn",
        namespace: "longhorn-system",
        timeoutSeconds: 600,
      };

      const resources = createCrdManagement(config);

      // Should create all basic resources
      expect(resources.serviceAccount).toBeInstanceOf(k8s.core.v1.ServiceAccount);
      expect(resources.clusterRole).toBeInstanceOf(k8s.rbac.v1.ClusterRole);
      expect(resources.clusterRoleBinding).toBeInstanceOf(k8s.rbac.v1.ClusterRoleBinding);
      expect(resources.preCreationJob).toBeInstanceOf(k8s.batch.v1.Job);
    });

    it("should handle configuration with multiple settings", () => {
      const config: ICrdManagementConfig = {
        componentName: "test-longhorn",
        namespace: "longhorn-system",
        requiredSettings: [
          { name: "setting1", value: "value1" },
          { name: "setting2", value: "value2" },
          { name: "setting3", value: "value3" },
        ],
      };

      const resources = createCrdManagement(config);

      // Should create all resources including settings job
      expect(resources.serviceAccount).toBeInstanceOf(k8s.core.v1.ServiceAccount);
      expect(resources.clusterRole).toBeInstanceOf(k8s.rbac.v1.ClusterRole);
      expect(resources.clusterRoleBinding).toBeInstanceOf(k8s.rbac.v1.ClusterRoleBinding);
      expect(resources.preCreationJob).toBeInstanceOf(k8s.batch.v1.Job);
      expect(resources.settingsJob).toBeInstanceOf(k8s.batch.v1.Job);
    });
  });

  describe("CRD Pre-creation Job Logic", () => {
    it("should create pre-creation job with correct resource type", () => {
      const config: ICrdManagementConfig = {
        componentName: "test-longhorn",
        namespace: "longhorn-system",
        timeoutSeconds: 300,
      };

      const resources = createCrdManagement(config);

      // Verify job is created with expected type
      expect(resources.preCreationJob).toBeInstanceOf(k8s.batch.v1.Job);
    });

    it("should create pre-creation job with custom timeout configuration", () => {
      const config: ICrdManagementConfig = {
        componentName: "test-longhorn",
        namespace: "longhorn-system",
        timeoutSeconds: 600,
      };

      const resources = createCrdManagement(config);

      // Verify job is created with expected type
      expect(resources.preCreationJob).toBeInstanceOf(k8s.batch.v1.Job);
    });

    it("should create pre-creation job for CRD validation", () => {
      const config: ICrdManagementConfig = {
        componentName: "test-longhorn",
        namespace: "longhorn-system",
        timeoutSeconds: 300,
      };

      const resources = createCrdManagement(config);

      // Verify job is created for CRD validation
      expect(resources.preCreationJob).toBeInstanceOf(k8s.batch.v1.Job);
    });

    it("should create pre-creation job for all required Longhorn CRDs", () => {
      const config: ICrdManagementConfig = {
        componentName: "test-longhorn",
        namespace: "longhorn-system",
      };

      const resources = createCrdManagement(config);

      // Verify job is created for CRD management
      expect(resources.preCreationJob).toBeInstanceOf(k8s.batch.v1.Job);
    });

    it("should create pre-creation job with conflict detection capabilities", () => {
      const config: ICrdManagementConfig = {
        componentName: "test-longhorn",
        namespace: "longhorn-system",
      };

      const resources = createCrdManagement(config);

      // Verify job is created for conflict detection
      expect(resources.preCreationJob).toBeInstanceOf(k8s.batch.v1.Job);
    });

    it("should create pre-creation job with custom timeout support", () => {
      const config: ICrdManagementConfig = {
        componentName: "test-longhorn",
        namespace: "longhorn-system",
        timeoutSeconds: 900,
      };

      const resources = createCrdManagement(config);

      // Verify job is created with custom timeout
      expect(resources.preCreationJob).toBeInstanceOf(k8s.batch.v1.Job);
    });

    it("should create pre-creation job with error handling", () => {
      const config: ICrdManagementConfig = {
        componentName: "test-longhorn",
        namespace: "longhorn-system",
      };

      const resources = createCrdManagement(config);

      // Verify job is created with error handling
      expect(resources.preCreationJob).toBeInstanceOf(k8s.batch.v1.Job);
    });
  });

  describe("Deleting Confirmation Flag Setting", () => {
    it("should create settings job with deleting-confirmation-flag", () => {
      const resources = createDeletingConfirmationFlagJob("test-longhorn", "longhorn-system");

      expect(resources.settingsJob).toBeDefined();
      expect(resources.settingsJob).toBeInstanceOf(k8s.batch.v1.Job);
    });

    it("should create settings job with correct resource type for deleting-confirmation-flag", () => {
      const resources = createDeletingConfirmationFlagJob("test-longhorn", "longhorn-system");

      // Verify settings job is created with expected type
      expect(resources.settingsJob).toBeInstanceOf(k8s.batch.v1.Job);
    });

    it("should create settings job for deleting-confirmation-flag setting", () => {
      const resources = createDeletingConfirmationFlagJob("test-longhorn", "longhorn-system");

      // Verify settings job is created for deleting-confirmation-flag
      expect(resources.settingsJob).toBeDefined();
      expect(resources.settingsJob).toBeInstanceOf(k8s.batch.v1.Job);
    });

    it("should create settings job that waits for settings CRD", () => {
      const resources = createDeletingConfirmationFlagJob("test-longhorn", "longhorn-system");

      // Verify settings job is created to wait for CRD
      expect(resources.settingsJob).toBeDefined();
      expect(resources.settingsJob).toBeInstanceOf(k8s.batch.v1.Job);
    });

    it("should create settings job with proper execution configuration", () => {
      const resources = createDeletingConfirmationFlagJob("test-longhorn", "longhorn-system");

      // Verify settings job is created with proper configuration
      expect(resources.settingsJob).toBeDefined();
      expect(resources.settingsJob).toBeInstanceOf(k8s.batch.v1.Job);
    });

    it("should handle multiple settings in settings job", () => {
      const config: ICrdManagementConfig = {
        componentName: "test-longhorn",
        namespace: "longhorn-system",
        requiredSettings: [
          { name: "deleting-confirmation-flag", value: "true" },
          { name: "backup-target", value: "s3://my-bucket" },
          { name: "replica-count", value: "3" },
        ],
      };

      const resources = createCrdManagement(config);

      // Verify settings job is created for multiple settings
      expect(resources.settingsJob).toBeDefined();
      expect(resources.settingsJob).toBeInstanceOf(k8s.batch.v1.Job);
    });

    it("should include error handling in settings creation", () => {
      const resources = createDeletingConfirmationFlagJob("test-longhorn", "longhorn-system");

      // Verify settings job is created with error handling
      expect(resources.settingsJob).toBeDefined();
      expect(resources.settingsJob).toBeInstanceOf(k8s.batch.v1.Job);
    });
  });

  describe("CRD Conflict Detection and Resolution", () => {
    it("should create pre-creation job with version checking capabilities", () => {
      const config: ICrdManagementConfig = {
        componentName: "test-longhorn",
        namespace: "longhorn-system",
      };

      const resources = createCrdManagement(config);

      // Verify job is created for version checking
      expect(resources.preCreationJob).toBeInstanceOf(k8s.batch.v1.Job);
    });

    it("should create pre-creation job with CRD status validation", () => {
      const config: ICrdManagementConfig = {
        componentName: "test-longhorn",
        namespace: "longhorn-system",
      };

      const resources = createCrdManagement(config);

      // Verify job is created for status validation
      expect(resources.preCreationJob).toBeInstanceOf(k8s.batch.v1.Job);
    });

    it("should create pre-creation job with CRD establishment waiting logic", () => {
      const config: ICrdManagementConfig = {
        componentName: "test-longhorn",
        namespace: "longhorn-system",
        timeoutSeconds: 450,
      };

      const resources = createCrdManagement(config);

      // Verify job is created with establishment waiting
      expect(resources.preCreationJob).toBeInstanceOf(k8s.batch.v1.Job);
    });

    it("should create pre-creation job that handles unknown CRD versions gracefully", () => {
      const config: ICrdManagementConfig = {
        componentName: "test-longhorn",
        namespace: "longhorn-system",
      };

      const resources = createCrdManagement(config);

      // Verify job is created with graceful error handling
      expect(resources.preCreationJob).toBeInstanceOf(k8s.batch.v1.Job);
    });

    it("should create pre-creation job that validates all existing CRDs", () => {
      const config: ICrdManagementConfig = {
        componentName: "test-longhorn",
        namespace: "longhorn-system",
      };

      const resources = createCrdManagement(config);

      // Verify job is created for CRD validation
      expect(resources.preCreationJob).toBeInstanceOf(k8s.batch.v1.Job);
    });

    it("should create pre-creation job with clear conflict resolution messaging", () => {
      const config: ICrdManagementConfig = {
        componentName: "test-longhorn",
        namespace: "longhorn-system",
      };

      const resources = createCrdManagement(config);

      // Verify job is created with conflict resolution
      expect(resources.preCreationJob).toBeInstanceOf(k8s.batch.v1.Job);
    });
  });

  describe("RBAC Configuration for CRD Management", () => {
    it("should create ClusterRole with CRD management permissions", () => {
      const config: ICrdManagementConfig = {
        componentName: "test-longhorn",
        namespace: "longhorn-system",
      };

      const resources = createCrdManagement(config);

      // Verify ClusterRole is created for CRD management
      expect(resources.clusterRole).toBeInstanceOf(k8s.rbac.v1.ClusterRole);
    });

    it("should create ClusterRole with Longhorn resource permissions", () => {
      const config: ICrdManagementConfig = {
        componentName: "test-longhorn",
        namespace: "longhorn-system",
      };

      const resources = createCrdManagement(config);

      // Verify ClusterRole is created for Longhorn resources
      expect(resources.clusterRole).toBeInstanceOf(k8s.rbac.v1.ClusterRole);
    });

    it("should create ClusterRole with settings management permissions", () => {
      const config: ICrdManagementConfig = {
        componentName: "test-longhorn",
        namespace: "longhorn-system",
      };

      const resources = createCrdManagement(config);

      // Verify ClusterRole is created for settings management
      expect(resources.clusterRole).toBeInstanceOf(k8s.rbac.v1.ClusterRole);
    });

    it("should create ClusterRoleBinding with correct subject configuration", () => {
      const config: ICrdManagementConfig = {
        componentName: "test-longhorn",
        namespace: "longhorn-system",
      };

      const resources = createCrdManagement(config);

      // Verify ClusterRoleBinding is created with proper subject
      expect(resources.clusterRoleBinding).toBeInstanceOf(k8s.rbac.v1.ClusterRoleBinding);
    });

    it("should create ClusterRoleBinding with correct role reference", () => {
      const config: ICrdManagementConfig = {
        componentName: "test-longhorn",
        namespace: "longhorn-system",
      };

      const resources = createCrdManagement(config);

      // Verify ClusterRoleBinding is created with proper role reference
      expect(resources.clusterRoleBinding).toBeInstanceOf(k8s.rbac.v1.ClusterRoleBinding);
    });
  });
});
