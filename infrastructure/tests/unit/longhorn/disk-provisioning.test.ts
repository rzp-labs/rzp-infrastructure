import * as k8s from "@pulumi/kubernetes";
import * as pulumi from "@pulumi/pulumi";

import { createDiskProvisioningJob } from "../../../helpers/longhorn/disk-provisioning";

// Mock Pulumi
void pulumi.runtime.setMocks({
  newResource: (args: pulumi.runtime.MockResourceArgs): { id: string; state: any } => {
    return {
      id: `${args.name}-id`,
      state: {
        ...args.inputs,
        metadata: {
          name: args.inputs.metadata?.name ?? args.name,
          namespace: args.inputs.metadata?.namespace ?? "default",
        },
      },
    };
  },
  call: (args: pulumi.runtime.MockCallArgs) => {
    return args.inputs;
  },
});

describe("Disk Provisioning", () => {
  let mockProvider: k8s.Provider;

  beforeEach(() => {
    mockProvider = new k8s.Provider("test-provider", {
      kubeconfig: "fake-kubeconfig",
    });
  });

  describe("createDiskProvisioningJob", () => {
    it("should create all required resources", () => {
      const resources = createDiskProvisioningJob(
        "test-disk-provisioning",
        {
          namespace: "longhorn-system",
          environment: "dev",
        },
        mockProvider,
      );

      // Verify all resources are created
      expect(resources.serviceAccount).toBeInstanceOf(k8s.core.v1.ServiceAccount);
      expect(resources.clusterRole).toBeInstanceOf(k8s.rbac.v1.ClusterRole);
      expect(resources.clusterRoleBinding).toBeInstanceOf(k8s.rbac.v1.ClusterRoleBinding);
      expect(resources.configMap).toBeInstanceOf(k8s.core.v1.ConfigMap);
      expect(resources.job).toBeInstanceOf(k8s.batch.v1.Job);
    });

    it("should handle custom configuration", () => {
      const resources = createDiskProvisioningJob(
        "test-disk-provisioning",
        {
          namespace: "longhorn-system",
          environment: "stg",
          diskPath: "/custom/path",
          storageReservedGb: 10,
          timeoutSeconds: 900,
          retryAttempts: 5,
        },
        mockProvider,
      );

      // Verify resources are created with custom config
      expect(resources.serviceAccount).toBeInstanceOf(k8s.core.v1.ServiceAccount);
      expect(resources.clusterRole).toBeInstanceOf(k8s.rbac.v1.ClusterRole);
      expect(resources.clusterRoleBinding).toBeInstanceOf(k8s.rbac.v1.ClusterRoleBinding);
      expect(resources.configMap).toBeInstanceOf(k8s.core.v1.ConfigMap);
      expect(resources.job).toBeInstanceOf(k8s.batch.v1.Job);
    });

    it("should create resources with different environments", () => {
      const environments: Array<"dev" | "stg" | "prd"> = ["dev", "stg", "prd"];

      environments.forEach((env) => {
        const resources = createDiskProvisioningJob(
          `test-${env}`,
          {
            namespace: `longhorn-${env}`,
            environment: env,
          },
          mockProvider,
        );

        expect(resources.serviceAccount).toBeInstanceOf(k8s.core.v1.ServiceAccount);
        expect(resources.clusterRole).toBeInstanceOf(k8s.rbac.v1.ClusterRole);
        expect(resources.clusterRoleBinding).toBeInstanceOf(k8s.rbac.v1.ClusterRoleBinding);
        expect(resources.configMap).toBeInstanceOf(k8s.core.v1.ConfigMap);
        expect(resources.job).toBeInstanceOf(k8s.batch.v1.Job);
      });
    });

    it("should create resources with minimal configuration", () => {
      const resources = createDiskProvisioningJob(
        "minimal-test",
        {
          namespace: "test-namespace",
          environment: "dev",
        },
        mockProvider,
      );

      // Verify all required resources exist
      expect(resources).toHaveProperty("serviceAccount");
      expect(resources).toHaveProperty("clusterRole");
      expect(resources).toHaveProperty("clusterRoleBinding");
      expect(resources).toHaveProperty("configMap");
      expect(resources).toHaveProperty("job");
    });

    it("should return proper interface structure", () => {
      const resources = createDiskProvisioningJob(
        "interface-test",
        {
          namespace: "test-namespace",
          environment: "prd",
        },
        mockProvider,
      );

      // Verify interface compliance
      expect(typeof resources).toBe("object");
      expect(resources.serviceAccount).toBeDefined();
      expect(resources.clusterRole).toBeDefined();
      expect(resources.clusterRoleBinding).toBeDefined();
      expect(resources.configMap).toBeDefined();
      expect(resources.job).toBeDefined();
    });
  });
});
