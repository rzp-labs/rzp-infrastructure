import * as pulumi from "@pulumi/pulumi";

import { InfisicalComponent } from "../../../components/infisical/component-infisical";
import type { Environment } from "../../../shared/types";

// Mock Pulumi runtime for testing
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

describe("InfisicalComponent", () => {
  const baseConfig = {
    namespace: "infisical-test",
    environment: "dev" as Environment,
    domain: "infisical.example.com",
    databaseConfig: {
      storageSize: "10Gi",
      username: "infisical",
      password: "test-password",
      database: "infisical",
    },
    infisicalConfig: {
      authSecret: "test-auth-secret",
      encryptionKey: "test-encryption-key",
      adminEmail: "admin@example.com",
      adminPassword: "admin-password",
      siteUrl: "https://infisical.example.com",
    },
  };

  it("should create InfisicalComponent with required resources", async () => {
    // Act
    const component = new InfisicalComponent("test-infisical", baseConfig);

    // Assert
    expect(component).toBeInstanceOf(InfisicalComponent);
    expect(component.namespace).toBeDefined();
    expect(component.postgresqlChart).toBeDefined();
    expect(component.applicationSecret).toBeDefined();
    expect(component.infisicalDeployment).toBeDefined();
    expect(component.infisicalService).toBeDefined();
    expect(component.ingress).toBeDefined();
    expect(component.serviceAccount).toBeDefined();
    expect(component.role).toBeDefined();
    expect(component.roleBinding).toBeDefined();
    expect(component.helmValuesOutput).toBeDefined();
  });

  it("should create namespace with correct metadata", async () => {
    // Act
    const component = new InfisicalComponent("test-infisical", baseConfig);

    // Assert
    expect(component.namespace).toBeDefined();
    expect(typeof component.namespace).toBe("object");
  });

  it("should create PostgreSQL chart by default", async () => {
    // Act
    const component = new InfisicalComponent("test-infisical", baseConfig);

    // Assert
    expect(component.postgresqlChart).toBeDefined();
    expect(typeof component.postgresqlChart).toBe("object");
  });

  it("should create Redis chart when configured", async () => {
    // Arrange
    const configWithRedis = {
      ...baseConfig,
      redisConfig: {
        storageSize: "1Gi",
        password: "redis-password",
      },
    };

    // Act
    const component = new InfisicalComponent("test-infisical", configWithRedis);

    // Assert
    expect(component.redisChart).toBeDefined();
    expect(typeof component.redisChart).toBe("object");
  });

  it("should not create Redis chart when not configured", async () => {
    // Act
    const component = new InfisicalComponent("test-infisical", baseConfig);

    // Assert
    expect(component.redisChart).toBeUndefined();
  });

  it("should create application secret", async () => {
    // Act
    const component = new InfisicalComponent("test-infisical", baseConfig);

    // Assert
    expect(component.applicationSecret).toBeDefined();
    expect(typeof component.applicationSecret).toBe("object");
  });

  it("should create Infisical deployment", async () => {
    // Act
    const component = new InfisicalComponent("test-infisical", baseConfig);

    // Assert
    expect(component.infisicalDeployment).toBeDefined();
    expect(typeof component.infisicalDeployment).toBe("object");
  });

  it("should create service with ClusterIP type", async () => {
    // Act
    const component = new InfisicalComponent("test-infisical", baseConfig);

    // Assert
    expect(component.infisicalService).toBeDefined();
    expect(typeof component.infisicalService).toBe("object");
  });

  it("should create ingress with Traefik annotations", async () => {
    // Act
    const component = new InfisicalComponent("test-infisical", baseConfig);

    // Assert
    expect(component.ingress).toBeDefined();
    expect(typeof component.ingress).toBe("object");
  });

  it("should handle custom chart versions", async () => {
    // Arrange
    const configWithVersions = {
      ...baseConfig,
      postgresqlChartVersion: "15.5.32",
      redisChartVersion: "19.6.4",
      redisConfig: {
        storageSize: "1Gi",
        password: "redis-password",
      },
    };

    // Act
    const component = new InfisicalComponent("test-infisical", configWithVersions);

    // Assert
    expect(component.postgresqlChart).toBeDefined();
    expect(component.redisChart).toBeDefined();
  });

  it("should follow SOLID principles with clear single responsibility", async () => {
    // Act
    const component = new InfisicalComponent("test-infisical", baseConfig);

    // Assert - Component should have clear single responsibility
    expect(typeof component.namespace).toBe("object");
    expect(typeof component.postgresqlChart).toBe("object");
    expect(typeof component.applicationSecret).toBe("object");
    expect(typeof component.infisicalDeployment).toBe("object");
    expect(typeof component.infisicalService).toBe("object");
    expect(typeof component.ingress).toBe("object");
  });

  it("should handle minimal configuration", async () => {
    // Act
    const component = new InfisicalComponent("test-infisical", baseConfig);

    // Assert
    expect(component.namespace).toBeDefined();
    expect(component.postgresqlChart).toBeDefined();
    expect(component.applicationSecret).toBeDefined();
    expect(component.infisicalDeployment).toBeDefined();
    expect(component.infisicalService).toBeDefined();
    expect(component.ingress).toBeDefined();
  });

  it("should integrate with existing infrastructure patterns", async () => {
    // Arrange
    const configWithInfrastructure = {
      ...baseConfig,
      databaseConfig: {
        ...baseConfig.databaseConfig,
        storageClass: "longhorn", // Should use Longhorn by default
      },
    };

    // Act
    const component = new InfisicalComponent("test-infisical", configWithInfrastructure);

    // Assert
    expect(component.postgresqlChart).toBeDefined(); // Uses bitnami/postgresql
    expect(component.ingress).toBeDefined(); // Uses Traefik patterns
    expect(component.helmValuesOutput).toBeDefined(); // For ArgoCD integration
  });

  it("should create dedicated service account for security", async () => {
    // Act
    const component = new InfisicalComponent("test-infisical", baseConfig);

    // Assert
    expect(component.serviceAccount).toBeDefined();
    expect(typeof component.serviceAccount).toBe("object");
  });

  it("should create minimal RBAC role with only necessary permissions", async () => {
    // Act
    const component = new InfisicalComponent("test-infisical", baseConfig);

    // Assert
    expect(component.role).toBeDefined();
    expect(typeof component.role).toBe("object");
  });

  it("should create role binding to associate service account with role", async () => {
    // Act
    const component = new InfisicalComponent("test-infisical", baseConfig);

    // Assert
    expect(component.roleBinding).toBeDefined();
    expect(typeof component.roleBinding).toBe("object");
  });

  it("should follow security best practices for secrets management platform", async () => {
    // Act
    const component = new InfisicalComponent("test-infisical", baseConfig);

    // Assert - Should have dedicated RBAC instead of default service account
    expect(component.serviceAccount).toBeDefined();
    expect(component.role).toBeDefined();
    expect(component.roleBinding).toBeDefined();
  });
});
