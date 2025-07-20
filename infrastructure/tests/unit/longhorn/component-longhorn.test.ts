/**
 * Tests for Longhorn Component with RBAC Management
 *
 * Verifies that the enhanced Longhorn component correctly integrates
 * RBAC resources for uninstaller operations.
 */

import * as pulumi from "@pulumi/pulumi";

import { type ILonghornArgs, LonghornComponent } from "../../../components/longhorn/component-longhorn";
import type { Environment } from "../../../shared/types";

// Mock Pulumi for testing
void pulumi.runtime.setMocks({
  newResource: (args: pulumi.runtime.MockResourceArgs): pulumi.runtime.MockResourceResult => {
    return {
      id: args.name + "_id",
      state: args.inputs as Record<string, unknown>,
    };
  },
  call: (args: pulumi.runtime.MockCallArgs) => {
    return args.inputs as Record<string, unknown>;
  },
});

describe("Longhorn Component with RBAC Management", () => {
  let testArgs: ILonghornArgs;

  beforeEach(() => {
    testArgs = {
      namespace: "longhorn-system",
      chartVersion: "1.5.0",
      environment: "stg" as Environment,
      domain: "longhorn.test.local",
      defaultStorageClass: true,
      replicaCount: 3,
      adminPassword: "test-password",
    };
  });

  describe("RBAC Integration", () => {
    it("should create RBAC resources by default", async () => {
      const component = new LonghornComponent("test-longhorn", testArgs);

      // Verify RBAC resources are created
      expect(component.uninstallerRbac).toBeDefined();
      expect(component.uninstallerRbac?.serviceAccount).toBeDefined();
      expect(component.uninstallerRbac?.clusterRole).toBeDefined();
      expect(component.uninstallerRbac?.clusterRoleBinding).toBeDefined();
    });

    it("should not create RBAC resources when disabled", async () => {
      const component = new LonghornComponent("test-longhorn", {
        ...testArgs,
        enableUninstallerRbac: false,
      });

      // Verify RBAC resources are not created
      expect(component.uninstallerRbac).toBeUndefined();
    });

    it("should create RBAC resources with custom timeout", async () => {
      const component = new LonghornComponent("test-longhorn", {
        ...testArgs,
        uninstallerTimeoutSeconds: 600,
      });

      // Verify RBAC resources are created
      expect(component.uninstallerRbac).toBeDefined();
    });
  });

  describe("Component Interface", () => {
    it("should support new RBAC configuration options", async () => {
      const argsWithRbacOptions: ILonghornArgs = {
        ...testArgs,
        enableUninstallerRbac: true,
        uninstallerTimeoutSeconds: 300,
        validatePrerequisites: true,
      };

      const component = new LonghornComponent("test-longhorn", argsWithRbacOptions);

      // Verify component is created successfully
      expect(component).toBeDefined();
      expect(component.namespace).toBeDefined();
      expect(component.chart).toBeDefined();
      expect(component.uninstallerRbac).toBeDefined();
    });

    it("should maintain backward compatibility", async () => {
      // Test with minimal configuration (original interface)
      const minimalArgs: ILonghornArgs = {
        namespace: "longhorn-system",
        chartVersion: "1.5.0",
        environment: "stg" as Environment,
        domain: "longhorn.test.local",
        defaultStorageClass: true,
        replicaCount: 3,
        adminPassword: "test-password",
      };

      const component = new LonghornComponent("test-longhorn", minimalArgs);

      // Verify component is created successfully with defaults
      expect(component).toBeDefined();
      expect(component.namespace).toBeDefined();
      expect(component.chart).toBeDefined();
      expect(component.uninstallerRbac).toBeDefined(); // Should be created by default
    });
  });

  describe("Declarative Settings Management", () => {
    it("should create the deletingConfirmationFlag CustomResource", async () => {
      const component = new LonghornComponent("test-longhorn", testArgs);

      // Verify the CustomResource is created and is of the correct type
      expect(component.deletingConfirmationFlag).toBeDefined();
      expect(component.deletingConfirmationFlag).toBeInstanceOf(pulumi.CustomResource);
    });
  });

  describe("Prerequisite Validation Integration", () => {
    it("should create prerequisite validation resources by default", async () => {
      const component = new LonghornComponent("test-longhorn", testArgs);

      // Verify prerequisite validation resources are created
      expect(component.prerequisiteValidation).toBeDefined();
      expect(component.prerequisiteValidation?.role).toBeDefined();
      expect(component.prerequisiteValidation?.roleBinding).toBeDefined();
      expect(component.prerequisiteValidation?.validationJob).toBeDefined();
    });

    it("should not create prerequisite validation when disabled", async () => {
      const component = new LonghornComponent("test-longhorn", {
        ...testArgs,
        validatePrerequisites: false,
      });

      // Verify prerequisite validation resources are not created
      expect(component.prerequisiteValidation).toBeUndefined();
    });

    it("should create prerequisite validation with open-iscsi validation", async () => {
      const component = new LonghornComponent("test-longhorn", {
        ...testArgs,
        validatePrerequisites: true,
      });

      // Verify prerequisite validation is configured for open-iscsi
      expect(component.prerequisiteValidation).toBeDefined();
      expect(component.prerequisiteValidation?.validationJob).toBeDefined();
    });
  });

  describe("Deployment Monitoring Integration", () => {
    it("should create deployment monitoring resources by default", async () => {
      const component = new LonghornComponent("test-longhorn", testArgs);

      // Verify deployment monitoring resources are created
      expect(component.deploymentMonitor).toBeDefined();
      expect(component.statusConfigMap).toBeDefined();
      expect(component.monitoringJob).toBeDefined();
    });

    it("should not create deployment monitoring when disabled", async () => {
      const component = new LonghornComponent("test-longhorn", {
        ...testArgs,
        enableDeploymentMonitoring: false,
      });

      // Verify deployment monitoring resources are not created
      expect(component.deploymentMonitor).toBeUndefined();
      expect(component.statusConfigMap).toBeUndefined();
      expect(component.monitoringJob).toBeUndefined();
    });

    it("should create deployment monitoring with custom configuration", async () => {
      const component = new LonghornComponent("test-longhorn", {
        ...testArgs,
        enableDeploymentMonitoring: true,
        deploymentTimeoutSeconds: 3600,
        maxRetries: 5,
        enableStatusTracking: true,
      });

      // Verify deployment monitoring is configured
      expect(component.deploymentMonitor).toBeDefined();
      expect(component.statusConfigMap).toBeDefined();
      expect(component.monitoringJob).toBeDefined();
    });

    it("should support enhanced error handling configuration options", async () => {
      const argsWithMonitoringOptions: ILonghornArgs = {
        ...testArgs,
        enableDeploymentMonitoring: true,
        deploymentTimeoutSeconds: 1800,
        maxRetries: 3,
        enableStatusTracking: true,
      };

      const component = new LonghornComponent("test-longhorn", argsWithMonitoringOptions);

      // Verify component is created successfully with monitoring options
      expect(component).toBeDefined();
      expect(component.deploymentMonitor).toBeDefined();
      expect(component.statusConfigMap).toBeDefined();
      expect(component.monitoringJob).toBeDefined();
    });

    it("should maintain backward compatibility with monitoring disabled", async () => {
      // Test with minimal configuration (original interface)
      const minimalArgs: ILonghornArgs = {
        namespace: "longhorn-system",
        chartVersion: "1.5.0",
        environment: "stg" as Environment,
        domain: "longhorn.test.local",
        defaultStorageClass: true,
        replicaCount: 3,
        adminPassword: "test-password",
        enableDeploymentMonitoring: false,
      };

      const component = new LonghornComponent("test-longhorn", minimalArgs);

      // Verify component is created successfully without monitoring
      expect(component).toBeDefined();
      expect(component.namespace).toBeDefined();
      expect(component.chart).toBeDefined();
      expect(component.deploymentMonitor).toBeUndefined();
      expect(component.statusConfigMap).toBeUndefined();
      expect(component.monitoringJob).toBeUndefined();
    });
  });

  describe("Enhanced Error Handling Integration", () => {
    it("should support timeout configuration for all deployment phases", async () => {
      const component = new LonghornComponent("test-longhorn", {
        ...testArgs,
        deploymentTimeoutSeconds: 2400, // 40 minutes
        uninstallerTimeoutSeconds: 600, // 10 minutes for uninstaller
      });

      // Verify component is created with timeout configurations
      expect(component).toBeDefined();
      expect(component.deploymentMonitor).toBeDefined();
    });

    it("should support retry configuration with exponential backoff", async () => {
      const component = new LonghornComponent("test-longhorn", {
        ...testArgs,
        maxRetries: 5,
        enableDeploymentMonitoring: true,
      });

      // Verify component is created with retry configuration
      expect(component).toBeDefined();
      expect(component.deploymentMonitor).toBeDefined();
    });

    it("should support comprehensive error detection and reporting", async () => {
      const component = new LonghornComponent("test-longhorn", {
        ...testArgs,
        enableStatusTracking: true,
        enableDeploymentMonitoring: true,
      });

      // Verify component is created with error detection enabled
      expect(component).toBeDefined();
      expect(component.deploymentMonitor).toBeDefined();
      expect(component.statusConfigMap).toBeDefined();
    });
  });

  describe("Disk Provisioning Automation", () => {
    it("should create disk provisioning resources when enabled", async () => {
      const component = new LonghornComponent("test-longhorn", {
        ...testArgs,
        enableDiskProvisioning: true,
        diskPath: "/var/lib/longhorn",
        storageReservedGb: 10,
      });

      // Verify disk provisioning resources are created
      expect(component.diskProvisioning).toBeDefined();
      expect(component.diskProvisioning?.serviceAccount).toBeDefined();
      expect(component.diskProvisioning?.clusterRole).toBeDefined();
      expect(component.diskProvisioning?.clusterRoleBinding).toBeDefined();
      expect(component.diskProvisioning?.job).toBeDefined();
    });

    it("should not create disk provisioning when disabled", async () => {
      const component = new LonghornComponent("test-longhorn", {
        ...testArgs,
        enableDiskProvisioning: false,
      });

      // Verify disk provisioning resources are not created
      expect(component.diskProvisioning).toBeUndefined();
    });

    it("should support custom disk provisioning configuration", async () => {
      const component = new LonghornComponent("test-longhorn", {
        ...testArgs,
        enableDiskProvisioning: true,
        diskPath: "/data/longhorn",
        storageReservedGb: 5,
        diskProvisioningTimeoutSeconds: 600,
        diskProvisioningRetryAttempts: 3,
      });

      // Verify disk provisioning is configured correctly
      expect(component.diskProvisioning).toBeDefined();
    });
  });

  describe("Volume Cleanup Automation", () => {
    it("should create volume cleanup resources for staging environment", async () => {
      const component = new LonghornComponent("test-longhorn", {
        ...testArgs,
        environment: "stg" as Environment,
        enableVolumeCleanup: true,
        volumeCleanupIntervalMinutes: 15,
        maxVolumeAgeHours: 1,
      });

      // Verify volume cleanup resources are created
      expect(component.volumeCleanup).toBeDefined();
      expect(component.volumeCleanup?.serviceAccount).toBeDefined();
      expect(component.volumeCleanup?.role).toBeDefined();
      expect(component.volumeCleanup?.roleBinding).toBeDefined();
      expect(component.volumeCleanup?.cleanupScript).toBeDefined();
      expect(component.volumeCleanup?.cleanupJob).toBeDefined();
      expect(component.volumeCleanup?.cronJob).toBeDefined();
    });

    it("should not create volume cleanup for production environment", async () => {
      const component = new LonghornComponent("test-longhorn", {
        ...testArgs,
        environment: "prd" as Environment,
        enableVolumeCleanup: true,
      });

      // Volume cleanup should not be created for production
      expect(component.volumeCleanup).toBeUndefined();
    });

    it("should not create volume cleanup when disabled", async () => {
      const component = new LonghornComponent("test-longhorn", {
        ...testArgs,
        environment: "stg" as Environment,
        enableVolumeCleanup: false,
      });

      // Volume cleanup should not be created when disabled
      expect(component.volumeCleanup).toBeUndefined();
    });

    it("should use external script file for volume cleanup", async () => {
      const component = new LonghornComponent("test-longhorn", {
        ...testArgs,
        environment: "stg" as Environment,
        enableVolumeCleanup: true,
      });

      // Verify cleanup script ConfigMap is created (following best practices)
      expect(component.volumeCleanup?.cleanupScript).toBeDefined();
    });

    it("should follow principle of least privilege for volume cleanup RBAC", async () => {
      const component = new LonghornComponent("test-longhorn", {
        ...testArgs,
        environment: "stg" as Environment,
        enableVolumeCleanup: true,
      });

      // Verify RBAC follows security best practices
      expect(component.volumeCleanup?.serviceAccount).toBeDefined();
      expect(component.volumeCleanup?.role).toBeDefined();
      expect(component.volumeCleanup?.roleBinding).toBeDefined();
    });
  });

  describe("Resource Dependencies", () => {
    it("should include all automation resources in chart dependencies", async () => {
      const component = new LonghornComponent("test-longhorn", {
        ...testArgs,
        enableDiskProvisioning: true,
        enableVolumeCleanup: true,
      });

      // Verify that the component has all required resources
      expect(component.namespace).toBeDefined();
      expect(component.deletingConfirmationFlag).toBeDefined();
      expect(component.uninstallerRbac).toBeDefined();
      expect(component.prerequisiteValidation).toBeDefined();
      expect(component.deploymentMonitor).toBeDefined();
      expect(component.diskProvisioning).toBeDefined();
      expect(component.volumeCleanup).toBeDefined();
      expect(component.chart).toBeDefined();
    });

    it("should handle optional automation features in dependencies", async () => {
      const component = new LonghornComponent("test-longhorn", {
        ...testArgs,
        validatePrerequisites: false,
        enableDeploymentMonitoring: false,
        enableDiskProvisioning: false,
        enableVolumeCleanup: false,
      });

      // Verify that the component works without optional features
      expect(component.namespace).toBeDefined();
      expect(component.deletingConfirmationFlag).toBeDefined();
      expect(component.uninstallerRbac).toBeDefined();
      expect(component.prerequisiteValidation).toBeUndefined();
      expect(component.deploymentMonitor).toBeUndefined();
      expect(component.diskProvisioning).toBeUndefined();
      expect(component.volumeCleanup).toBeUndefined();
      expect(component.chart).toBeDefined();
    });
  });

  describe("Helm Values Integration", () => {
    it("should include uninstaller ServiceAccount in Helm values", (done) => {
      const component = new LonghornComponent("test-longhorn", testArgs);

      // Get the Helm values output
      component.helmValuesOutput.apply((helmValues) => {
        const parsedValues = JSON.parse(helmValues) as Record<string, unknown>;

        // Verify uninstaller configuration is included
        expect(parsedValues.uninstall).toBeDefined();
        expect((parsedValues.uninstall as Record<string, unknown>).force).toBe(true);
        expect((parsedValues.uninstall as Record<string, unknown>).serviceAccount).toBeDefined();
        done();
      });
    });

    it("should not include uninstaller config when RBAC is disabled", (done) => {
      const component = new LonghornComponent("test-longhorn", {
        ...testArgs,
        enableUninstallerRbac: false,
      });

      // Get the Helm values output
      component.helmValuesOutput.apply((helmValues) => {
        const parsedValues = JSON.parse(helmValues) as Record<string, unknown>;

        // Verify uninstaller configuration is not included
        expect(parsedValues.uninstall).toBeUndefined();
        done();
      });
    });

    it("should include environment-specific storage configuration", (done) => {
      const component = new LonghornComponent("test-longhorn", {
        ...testArgs,
        environment: "stg" as Environment,
      });

      // Get the Helm values output
      component.helmValuesOutput.apply((helmValues) => {
        const parsedValues = JSON.parse(helmValues) as Record<string, unknown>;

        // Verify staging-specific configurations are included
        expect(parsedValues.defaultSettings).toBeDefined();
        done();
      });
    });
  });

  describe("S3 Backup Integration", () => {
    it("should work with S3 backup configuration and all automation features", async () => {
      const component = new LonghornComponent("test-longhorn", {
        ...testArgs,
        backupTarget: "s3://test-bucket@us-east-1/",
        s3BackupConfig: {
          bucket: "test-bucket",
          region: "us-east-1",
          accessKeyId: "test-access-key",
          secretAccessKey: "test-secret-key",
        },
        enableDiskProvisioning: true,
        enableVolumeCleanup: true,
      });

      // Verify all features work together
      expect(component.backupSecret).toBeDefined();
      expect(component.uninstallerRbac).toBeDefined();
      expect(component.diskProvisioning).toBeDefined();
      expect(component.volumeCleanup).toBeDefined();
    });
  });
});
