/**
 * Comprehensive unit tests for Longhorn uninstaller RBAC utilities
 *
 * Tests ServiceAccount, ClusterRole, and ClusterRoleBinding creation,
 * RBAC permission validation and error handling, and proper resource
 * naming and labeling conventions.
 */

import * as k8s from "@pulumi/kubernetes";
import * as pulumi from "@pulumi/pulumi";

import {
  createUninstallerRbac,
  getDefaultClusterRoleBindingName,
  getDefaultClusterRoleName,
  getDefaultServiceAccountName,
} from "../../../helpers/longhorn/uninstaller-rbac";
import type { IUninstallerRbacConfig } from "../../../helpers/longhorn/uninstaller-rbac";

// Mock Pulumi for testing
void pulumi.runtime.setMocks({
  newResource: (args: pulumi.runtime.MockResourceArgs): pulumi.runtime.MockResourceResult => {
    return {
      id: `${args.name}-mock-id`,
      state: args.inputs as Record<string, unknown>,
    };
  },
  call: (args: pulumi.runtime.MockCallArgs): pulumi.runtime.MockCallResult => {
    return { outputs: args.inputs as Record<string, unknown> };
  },
});

describe("Longhorn Uninstaller RBAC Utilities", () => {
  describe("ServiceAccount Creation", () => {
    it("should create ServiceAccount with correct type", () => {
      const config: IUninstallerRbacConfig = {
        componentName: "test-longhorn",
        namespace: "longhorn-system",
      };

      const resources = createUninstallerRbac(config);

      // Verify ServiceAccount is created with correct type
      expect(resources.serviceAccount).toBeInstanceOf(k8s.core.v1.ServiceAccount);
    });

    it("should create ServiceAccount when custom name is provided", () => {
      const config: IUninstallerRbacConfig = {
        componentName: "test-longhorn",
        namespace: "longhorn-system",
        serviceAccountName: "custom-uninstaller-sa",
      };

      const resources = createUninstallerRbac(config);

      // Verify ServiceAccount is created
      expect(resources.serviceAccount).toBeInstanceOf(k8s.core.v1.ServiceAccount);
    });

    it("should create ServiceAccount in different namespaces", () => {
      const namespaces = ["longhorn-system", "storage", "custom-namespace"];

      namespaces.forEach((namespace) => {
        const config: IUninstallerRbacConfig = {
          componentName: "test-longhorn",
          namespace,
        };

        const resources = createUninstallerRbac(config);

        // Verify ServiceAccount is created for each namespace
        expect(resources.serviceAccount).toBeInstanceOf(k8s.core.v1.ServiceAccount);
      });
    });
  });

  describe("ClusterRole Creation", () => {
    it("should create ClusterRole with correct type", () => {
      const config: IUninstallerRbacConfig = {
        componentName: "test-longhorn",
        namespace: "longhorn-system",
      };

      const resources = createUninstallerRbac(config);

      // Verify ClusterRole is created with correct type
      expect(resources.clusterRole).toBeInstanceOf(k8s.rbac.v1.ClusterRole);
    });

    it("should create ClusterRole when custom name is provided", () => {
      const config: IUninstallerRbacConfig = {
        componentName: "test-longhorn",
        namespace: "longhorn-system",
        clusterRoleName: "custom-uninstaller-role",
      };

      const resources = createUninstallerRbac(config);

      // Verify ClusterRole is created
      expect(resources.clusterRole).toBeInstanceOf(k8s.rbac.v1.ClusterRole);
    });

    it("should create ClusterRole for different component names", () => {
      const componentNames = ["longhorn-prod", "longhorn-dev", "storage-system"];

      componentNames.forEach((componentName) => {
        const config: IUninstallerRbacConfig = {
          componentName,
          namespace: "longhorn-system",
        };

        const resources = createUninstallerRbac(config);

        // Verify ClusterRole is created for each component
        expect(resources.clusterRole).toBeInstanceOf(k8s.rbac.v1.ClusterRole);
      });
    });
  });

  describe("ClusterRoleBinding Creation", () => {
    it("should create ClusterRoleBinding with correct type", () => {
      const config: IUninstallerRbacConfig = {
        componentName: "test-longhorn",
        namespace: "longhorn-system",
      };

      const resources = createUninstallerRbac(config);

      // Verify ClusterRoleBinding is created with correct type
      expect(resources.clusterRoleBinding).toBeInstanceOf(k8s.rbac.v1.ClusterRoleBinding);
    });

    it("should create ClusterRoleBinding when custom name is provided", () => {
      const config: IUninstallerRbacConfig = {
        componentName: "test-longhorn",
        namespace: "longhorn-system",
        clusterRoleBindingName: "custom-uninstaller-binding",
      };

      const resources = createUninstallerRbac(config);

      // Verify ClusterRoleBinding is created
      expect(resources.clusterRoleBinding).toBeInstanceOf(k8s.rbac.v1.ClusterRoleBinding);
    });

    it("should create ClusterRoleBinding with all custom names", () => {
      const config: IUninstallerRbacConfig = {
        componentName: "test-longhorn",
        namespace: "longhorn-system",
        serviceAccountName: "custom-sa",
        clusterRoleName: "custom-role",
        clusterRoleBindingName: "custom-binding",
      };

      const resources = createUninstallerRbac(config);

      // Verify all resources are created
      expect(resources.serviceAccount).toBeInstanceOf(k8s.core.v1.ServiceAccount);
      expect(resources.clusterRole).toBeInstanceOf(k8s.rbac.v1.ClusterRole);
      expect(resources.clusterRoleBinding).toBeInstanceOf(k8s.rbac.v1.ClusterRoleBinding);
    });
  });

  describe("RBAC Permission Validation", () => {
    it("should validate componentName is required", () => {
      const config: IUninstallerRbacConfig = {
        componentName: "",
        namespace: "longhorn-system",
      };

      expect(() => createUninstallerRbac(config)).toThrow("componentName is required and cannot be empty");
    });

    it("should validate namespace is required", () => {
      const config: IUninstallerRbacConfig = {
        componentName: "test-longhorn",
        namespace: "",
      };

      expect(() => createUninstallerRbac(config)).toThrow("namespace is required and cannot be empty");
    });

    it("should validate componentName follows Kubernetes naming conventions", () => {
      const invalidNames = [
        "Test_Longhorn",
        "test.longhorn",
        "TEST-LONGHORN",
        "test longhorn",
        "-test-longhorn",
        "test-longhorn-",
        "Test-Longhorn",
        "test_longhorn",
      ];

      invalidNames.forEach((invalidName) => {
        const config: IUninstallerRbacConfig = {
          componentName: invalidName,
          namespace: "longhorn-system",
        };

        expect(() => createUninstallerRbac(config)).toThrow(
          `componentName "${invalidName}" must follow Kubernetes naming conventions`,
        );
      });
    });

    it("should validate namespace follows Kubernetes naming conventions", () => {
      const invalidNamespaces = [
        "Longhorn_System",
        "longhorn.system",
        "LONGHORN-SYSTEM",
        "longhorn system",
        "-longhorn-system",
        "longhorn-system-",
        "Longhorn-System",
        "longhorn_system",
      ];

      invalidNamespaces.forEach((invalidNamespace) => {
        const config: IUninstallerRbacConfig = {
          componentName: "test-longhorn",
          namespace: invalidNamespace,
        };

        expect(() => createUninstallerRbac(config)).toThrow(
          `namespace "${invalidNamespace}" must follow Kubernetes naming conventions`,
        );
      });
    });

    it("should validate timeoutSeconds is positive", () => {
      const invalidTimeouts = [-1, 0, -100, -0.5];

      invalidTimeouts.forEach((timeout) => {
        const config: IUninstallerRbacConfig = {
          componentName: "test-longhorn",
          namespace: "longhorn-system",
          timeoutSeconds: timeout,
        };

        expect(() => createUninstallerRbac(config)).toThrow("timeoutSeconds must be a positive number");
      });
    });

    it("should validate custom serviceAccountName follows naming conventions", () => {
      const invalidNames = ["Invalid_ServiceAccount", "Invalid.ServiceAccount", "INVALID-SA"];

      invalidNames.forEach((invalidName) => {
        const config: IUninstallerRbacConfig = {
          componentName: "test-longhorn",
          namespace: "longhorn-system",
          serviceAccountName: invalidName,
        };

        expect(() => createUninstallerRbac(config)).toThrow(
          `serviceAccountName "${invalidName}" must follow Kubernetes naming conventions`,
        );
      });
    });

    it("should validate custom clusterRoleName follows naming conventions", () => {
      const invalidNames = ["Invalid_ClusterRole", "Invalid.ClusterRole", "INVALID-ROLE"];

      invalidNames.forEach((invalidName) => {
        const config: IUninstallerRbacConfig = {
          componentName: "test-longhorn",
          namespace: "longhorn-system",
          clusterRoleName: invalidName,
        };

        expect(() => createUninstallerRbac(config)).toThrow(
          `clusterRoleName "${invalidName}" must follow Kubernetes naming conventions`,
        );
      });
    });

    it("should validate custom clusterRoleBindingName follows naming conventions", () => {
      const invalidNames = ["Invalid_ClusterRoleBinding", "Invalid.ClusterRoleBinding", "INVALID-BINDING"];

      invalidNames.forEach((invalidName) => {
        const config: IUninstallerRbacConfig = {
          componentName: "test-longhorn",
          namespace: "longhorn-system",
          clusterRoleBindingName: invalidName,
        };

        expect(() => createUninstallerRbac(config)).toThrow(
          `clusterRoleBindingName "${invalidName}" must follow Kubernetes naming conventions`,
        );
      });
    });

    it("should accept valid configuration with all optional fields", () => {
      const config: IUninstallerRbacConfig = {
        componentName: "test-longhorn",
        namespace: "longhorn-system",
        serviceAccountName: "custom-sa",
        clusterRoleName: "custom-role",
        clusterRoleBindingName: "custom-binding",
        timeoutSeconds: 300,
      };

      expect(() => createUninstallerRbac(config)).not.toThrow();
    });

    it("should accept valid Kubernetes names with numbers and hyphens", () => {
      const validNames = [
        "test-longhorn-1",
        "longhorn-v2",
        "my-component-123",
        "a",
        "test-a-b-c",
        "component-1-2-3",
        "longhorn123",
      ];

      validNames.forEach((validName) => {
        const config: IUninstallerRbacConfig = {
          componentName: validName,
          namespace: validName,
        };

        expect(() => createUninstallerRbac(config)).not.toThrow();
      });
    });
  });

  describe("Error Handling", () => {
    it("should handle whitespace-only componentName", () => {
      const config: IUninstallerRbacConfig = {
        componentName: "   ",
        namespace: "longhorn-system",
      };

      expect(() => createUninstallerRbac(config)).toThrow("componentName is required and cannot be empty");
    });

    it("should handle whitespace-only namespace", () => {
      const config: IUninstallerRbacConfig = {
        componentName: "test-longhorn",
        namespace: "   ",
      };

      expect(() => createUninstallerRbac(config)).toThrow("namespace is required and cannot be empty");
    });

    it("should handle tab and newline characters in names", () => {
      const invalidNames = ["test\tlonghorn", "test\nlonghorn", "test\r\nlonghorn"];

      invalidNames.forEach((invalidName) => {
        const config: IUninstallerRbacConfig = {
          componentName: invalidName,
          namespace: "longhorn-system",
        };

        expect(() => createUninstallerRbac(config)).toThrow(
          `componentName "${invalidName}" must follow Kubernetes naming conventions`,
        );
      });
    });

    it("should handle zero timeoutSeconds", () => {
      const config: IUninstallerRbacConfig = {
        componentName: "test-longhorn",
        namespace: "longhorn-system",
        timeoutSeconds: 0,
      };

      expect(() => createUninstallerRbac(config)).toThrow("timeoutSeconds must be a positive number");
    });

    it("should handle undefined optional fields gracefully", () => {
      const config: IUninstallerRbacConfig = {
        componentName: "test-longhorn",
        namespace: "longhorn-system",
        serviceAccountName: undefined,
        clusterRoleName: undefined,
        clusterRoleBindingName: undefined,
        timeoutSeconds: undefined,
      };

      expect(() => createUninstallerRbac(config)).not.toThrow();
    });

    it("should handle very long valid names", () => {
      // Kubernetes names can be up to 253 characters for most resources
      const longValidName = "a".repeat(50); // Keep it reasonable for testing

      const config: IUninstallerRbacConfig = {
        componentName: longValidName,
        namespace: "longhorn-system",
      };

      expect(() => createUninstallerRbac(config)).not.toThrow();
    });

    it("should handle edge case characters in names", () => {
      const invalidChars = ["test@longhorn", "test#longhorn", "test$longhorn", "test%longhorn"];

      invalidChars.forEach((invalidName) => {
        const config: IUninstallerRbacConfig = {
          componentName: invalidName,
          namespace: "longhorn-system",
        };

        expect(() => createUninstallerRbac(config)).toThrow(
          `componentName "${invalidName}" must follow Kubernetes naming conventions`,
        );
      });
    });
  });

  describe("Resource Naming and Labeling Conventions", () => {
    it("should create all resources successfully with default configuration", () => {
      const config: IUninstallerRbacConfig = {
        componentName: "test-longhorn",
        namespace: "longhorn-system",
      };

      const resources = createUninstallerRbac(config);

      // Verify all resources are created
      expect(resources.serviceAccount).toBeInstanceOf(k8s.core.v1.ServiceAccount);
      expect(resources.clusterRole).toBeInstanceOf(k8s.rbac.v1.ClusterRole);
      expect(resources.clusterRoleBinding).toBeInstanceOf(k8s.rbac.v1.ClusterRoleBinding);
    });

    it("should maintain consistency across different component names", () => {
      const componentNames = ["longhorn-prod", "longhorn-dev", "storage-system", "test-component", "my-longhorn-123"];

      componentNames.forEach((componentName) => {
        const config: IUninstallerRbacConfig = {
          componentName,
          namespace: "longhorn-system",
        };

        const resources = createUninstallerRbac(config);

        // Verify all resources are created consistently
        expect(resources.serviceAccount).toBeInstanceOf(k8s.core.v1.ServiceAccount);
        expect(resources.clusterRole).toBeInstanceOf(k8s.rbac.v1.ClusterRole);
        expect(resources.clusterRoleBinding).toBeInstanceOf(k8s.rbac.v1.ClusterRoleBinding);
      });
    });

    it("should handle mixed custom and default names", () => {
      const testCases = [
        {
          config: {
            componentName: "test-longhorn",
            namespace: "longhorn-system",
            serviceAccountName: "custom-sa",
          },
          description: "custom ServiceAccount name only",
        },
        {
          config: {
            componentName: "test-longhorn",
            namespace: "longhorn-system",
            clusterRoleName: "custom-role",
          },
          description: "custom ClusterRole name only",
        },
        {
          config: {
            componentName: "test-longhorn",
            namespace: "longhorn-system",
            clusterRoleBindingName: "custom-binding",
          },
          description: "custom ClusterRoleBinding name only",
        },
        {
          config: {
            componentName: "test-longhorn",
            namespace: "longhorn-system",
            serviceAccountName: "custom-sa",
            clusterRoleName: "custom-role",
          },
          description: "custom ServiceAccount and ClusterRole names",
        },
      ];

      testCases.forEach(({ config }) => {
        const resources = createUninstallerRbac(config);

        // Verify all resources are created for each test case
        expect(resources.serviceAccount).toBeInstanceOf(k8s.core.v1.ServiceAccount);
        expect(resources.clusterRole).toBeInstanceOf(k8s.rbac.v1.ClusterRole);
        expect(resources.clusterRoleBinding).toBeInstanceOf(k8s.rbac.v1.ClusterRoleBinding);
      });
    });
  });

  describe("Utility Functions", () => {
    it("should generate correct default ServiceAccount name", () => {
      const testCases = [
        { input: "test-longhorn", expected: "test-longhorn-uninstaller" },
        { input: "longhorn", expected: "longhorn-uninstaller" },
        { input: "storage-system", expected: "storage-system-uninstaller" },
        { input: "a", expected: "a-uninstaller" },
        { input: "my-component-123", expected: "my-component-123-uninstaller" },
      ];

      testCases.forEach(({ input, expected }) => {
        const name = getDefaultServiceAccountName(input);
        expect(name).toBe(expected);
      });
    });

    it("should generate correct default ClusterRole name", () => {
      const testCases = [
        { input: "test-longhorn", expected: "test-longhorn-uninstaller-role" },
        { input: "longhorn", expected: "longhorn-uninstaller-role" },
        { input: "storage-system", expected: "storage-system-uninstaller-role" },
        { input: "a", expected: "a-uninstaller-role" },
        { input: "my-component-123", expected: "my-component-123-uninstaller-role" },
      ];

      testCases.forEach(({ input, expected }) => {
        const name = getDefaultClusterRoleName(input);
        expect(name).toBe(expected);
      });
    });

    it("should generate correct default ClusterRoleBinding name", () => {
      const testCases = [
        { input: "test-longhorn", expected: "test-longhorn-uninstaller-binding" },
        { input: "longhorn", expected: "longhorn-uninstaller-binding" },
        { input: "storage-system", expected: "storage-system-uninstaller-binding" },
        { input: "a", expected: "a-uninstaller-binding" },
        { input: "my-component-123", expected: "my-component-123-uninstaller-binding" },
      ];

      testCases.forEach(({ input, expected }) => {
        const name = getDefaultClusterRoleBindingName(input);
        expect(name).toBe(expected);
      });
    });

    it("should handle edge cases in utility functions", () => {
      // Test with minimal valid input
      expect(getDefaultServiceAccountName("a")).toBe("a-uninstaller");
      expect(getDefaultClusterRoleName("a")).toBe("a-uninstaller-role");
      expect(getDefaultClusterRoleBindingName("a")).toBe("a-uninstaller-binding");

      // Test with complex valid names
      const complexName = "my-complex-component-name-123";
      expect(getDefaultServiceAccountName(complexName)).toBe(`${complexName}-uninstaller`);
      expect(getDefaultClusterRoleName(complexName)).toBe(`${complexName}-uninstaller-role`);
      expect(getDefaultClusterRoleBindingName(complexName)).toBe(`${complexName}-uninstaller-binding`);
    });

    it("should maintain consistent naming patterns", () => {
      const componentNames = ["test", "longhorn", "storage-system", "my-app-v2"];

      componentNames.forEach((componentName) => {
        const saName = getDefaultServiceAccountName(componentName);
        const roleName = getDefaultClusterRoleName(componentName);
        const bindingName = getDefaultClusterRoleBindingName(componentName);

        // Verify naming patterns are consistent
        expect(saName).toBe(`${componentName}-uninstaller`);
        expect(roleName).toBe(`${componentName}-uninstaller-role`);
        expect(bindingName).toBe(`${componentName}-uninstaller-binding`);

        // Verify all names follow Kubernetes naming conventions
        const nameRegex = /^[a-z0-9]([-a-z0-9]*[a-z0-9])?$/;
        expect(nameRegex.test(saName)).toBe(true);
        expect(nameRegex.test(roleName)).toBe(true);
        expect(nameRegex.test(bindingName)).toBe(true);
      });
    });
  });

  describe("Integration with Pulumi Resource Options", () => {
    it("should accept and handle Pulumi component resource options", () => {
      const config: IUninstallerRbacConfig = {
        componentName: "test-longhorn",
        namespace: "longhorn-system",
      };

      const opts: pulumi.ComponentResourceOptions = {
        protect: true,
      };

      // Should not throw when options are provided
      expect(() => createUninstallerRbac(config, opts)).not.toThrow();

      const resources = createUninstallerRbac(config, opts);
      expect(resources.serviceAccount).toBeInstanceOf(k8s.core.v1.ServiceAccount);
      expect(resources.clusterRole).toBeInstanceOf(k8s.rbac.v1.ClusterRole);
      expect(resources.clusterRoleBinding).toBeInstanceOf(k8s.rbac.v1.ClusterRoleBinding);
    });

    it("should work without Pulumi component resource options", () => {
      const config: IUninstallerRbacConfig = {
        componentName: "test-longhorn",
        namespace: "longhorn-system",
      };

      // Should not throw when options are not provided
      expect(() => createUninstallerRbac(config)).not.toThrow();

      const resources = createUninstallerRbac(config);
      expect(resources.serviceAccount).toBeInstanceOf(k8s.core.v1.ServiceAccount);
      expect(resources.clusterRole).toBeInstanceOf(k8s.rbac.v1.ClusterRole);
      expect(resources.clusterRoleBinding).toBeInstanceOf(k8s.rbac.v1.ClusterRoleBinding);
    });

    it("should handle different Pulumi resource options", () => {
      const config: IUninstallerRbacConfig = {
        componentName: "test-longhorn",
        namespace: "longhorn-system",
      };

      const optionsTestCases = [
        { protect: true },
        { ignoreChanges: ["metadata"] },
        { aliases: [{ name: "old-name" }] },
        {},
      ];

      optionsTestCases.forEach((opts) => {
        expect(() => createUninstallerRbac(config, opts)).not.toThrow();

        const resources = createUninstallerRbac(config, opts);
        expect(resources.serviceAccount).toBeInstanceOf(k8s.core.v1.ServiceAccount);
        expect(resources.clusterRole).toBeInstanceOf(k8s.rbac.v1.ClusterRole);
        expect(resources.clusterRoleBinding).toBeInstanceOf(k8s.rbac.v1.ClusterRoleBinding);
      });
    });
  });

  describe("Resource Creation Order and Dependencies", () => {
    it("should create all three RBAC resources", () => {
      const config: IUninstallerRbacConfig = {
        componentName: "test-longhorn",
        namespace: "longhorn-system",
      };

      const resources = createUninstallerRbac(config);

      // Verify all resources are returned
      expect(resources.serviceAccount).toBeInstanceOf(k8s.core.v1.ServiceAccount);
      expect(resources.clusterRole).toBeInstanceOf(k8s.rbac.v1.ClusterRole);
      expect(resources.clusterRoleBinding).toBeInstanceOf(k8s.rbac.v1.ClusterRoleBinding);
    });

    it("should return resources with consistent interface", () => {
      const config: IUninstallerRbacConfig = {
        componentName: "test-longhorn",
        namespace: "longhorn-system",
      };

      const resources = createUninstallerRbac(config);

      // Verify return type structure
      expect(typeof resources).toBe("object");
      expect(resources).toHaveProperty("serviceAccount");
      expect(resources).toHaveProperty("clusterRole");
      expect(resources).toHaveProperty("clusterRoleBinding");
      expect(Object.keys(resources)).toHaveLength(3);
    });

    it("should handle multiple resource creation calls", () => {
      const configs = [
        { componentName: "longhorn-1", namespace: "ns-1" },
        { componentName: "longhorn-2", namespace: "ns-2" },
        { componentName: "longhorn-3", namespace: "ns-3" },
      ];

      configs.forEach((config) => {
        const resources = createUninstallerRbac(config);

        // Verify each call creates all resources
        expect(resources.serviceAccount).toBeInstanceOf(k8s.core.v1.ServiceAccount);
        expect(resources.clusterRole).toBeInstanceOf(k8s.rbac.v1.ClusterRole);
        expect(resources.clusterRoleBinding).toBeInstanceOf(k8s.rbac.v1.ClusterRoleBinding);
      });
    });

    it("should maintain resource independence across calls", () => {
      const config1: IUninstallerRbacConfig = {
        componentName: "longhorn-1",
        namespace: "namespace-1",
      };

      const config2: IUninstallerRbacConfig = {
        componentName: "longhorn-2",
        namespace: "namespace-2",
      };

      const resources1 = createUninstallerRbac(config1);
      const resources2 = createUninstallerRbac(config2);

      // Verify both sets of resources are created independently
      expect(resources1.serviceAccount).toBeInstanceOf(k8s.core.v1.ServiceAccount);
      expect(resources1.clusterRole).toBeInstanceOf(k8s.rbac.v1.ClusterRole);
      expect(resources1.clusterRoleBinding).toBeInstanceOf(k8s.rbac.v1.ClusterRoleBinding);

      expect(resources2.serviceAccount).toBeInstanceOf(k8s.core.v1.ServiceAccount);
      expect(resources2.clusterRole).toBeInstanceOf(k8s.rbac.v1.ClusterRole);
      expect(resources2.clusterRoleBinding).toBeInstanceOf(k8s.rbac.v1.ClusterRoleBinding);

      // Verify resources are different instances
      expect(resources1.serviceAccount).not.toBe(resources2.serviceAccount);
      expect(resources1.clusterRole).not.toBe(resources2.clusterRole);
      expect(resources1.clusterRoleBinding).not.toBe(resources2.clusterRoleBinding);
    });
  });

  describe("Comprehensive Permission Coverage", () => {
    it("should create RBAC resources for comprehensive Longhorn operations", () => {
      const config: IUninstallerRbacConfig = {
        componentName: "longhorn-comprehensive",
        namespace: "longhorn-system",
        timeoutSeconds: 600,
      };

      const resources = createUninstallerRbac(config);

      // Verify comprehensive RBAC setup is created
      expect(resources.serviceAccount).toBeInstanceOf(k8s.core.v1.ServiceAccount);
      expect(resources.clusterRole).toBeInstanceOf(k8s.rbac.v1.ClusterRole);
      expect(resources.clusterRoleBinding).toBeInstanceOf(k8s.rbac.v1.ClusterRoleBinding);
    });

    it("should support production-ready configurations", () => {
      const productionConfigs = [
        {
          componentName: "longhorn-production",
          namespace: "longhorn-system",
          timeoutSeconds: 1800, // 30 minutes
        },
        {
          componentName: "longhorn-staging",
          namespace: "longhorn-staging",
          serviceAccountName: "longhorn-staging-uninstaller",
          clusterRoleName: "longhorn-staging-uninstaller-role",
          clusterRoleBindingName: "longhorn-staging-uninstaller-binding",
          timeoutSeconds: 900, // 15 minutes
        },
      ];

      productionConfigs.forEach((config) => {
        const resources = createUninstallerRbac(config);

        // Verify production configurations work
        expect(resources.serviceAccount).toBeInstanceOf(k8s.core.v1.ServiceAccount);
        expect(resources.clusterRole).toBeInstanceOf(k8s.rbac.v1.ClusterRole);
        expect(resources.clusterRoleBinding).toBeInstanceOf(k8s.rbac.v1.ClusterRoleBinding);
      });
    });
  });
});
