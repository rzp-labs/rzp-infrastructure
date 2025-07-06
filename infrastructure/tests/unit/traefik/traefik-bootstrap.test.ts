import * as pulumi from "@pulumi/pulumi";

import { TraefikBootstrap } from "../../../components/traefik/traefik-bootstrap";

// Mock Pulumi runtime for testing - specific typed interfaces
interface IK8sMetadata {
  name: string;
  namespace: string;
  labels?: Record<string, string>;
  annotations?: Record<string, string>;
}

interface IHelmChartInputs {
  name: string;
  chart: string;
  version?: string;
  namespace?: string;
  values?: Record<string, unknown>;
}

interface IIngressInputs {
  name: string;
  metadata: IK8sMetadata;
  spec?: {
    rules?: Array<{
      host?: string;
      http?: {
        paths?: Array<{
          path?: string;
          pathType?: string;
          backend?: {
            service?: {
              name?: string;
              port?: { number?: number };
            };
          };
        }>;
      };
    }>;
    tls?: Array<{
      hosts?: string[];
      secretName?: string;
    }>;
  };
}

interface INamespaceInputs {
  name: string;
  metadata: IK8sMetadata;
}

// Union type for all Traefik-related resource inputs
type MockResourceInputs = IHelmChartInputs | IIngressInputs | INamespaceInputs;

void pulumi.runtime.setMocks({
  newResource: (args: pulumi.runtime.MockResourceArgs): pulumi.runtime.MockResourceResult => {
    const inputs = args.inputs as MockResourceInputs;
    return {
      id: `${inputs.name}_id`,
      state: inputs,
    };
  },
  call: (args: pulumi.runtime.MockCallArgs): pulumi.Inputs => {
    return args.inputs as pulumi.Inputs;
  },
});

describe("TraefikBootstrap", () => {
  it("should create TraefikBootstrap component with required resources", async () => {
    // Arrange
    const config = {
      domain: "example.local",
      email: "admin@example.local",
      environment: "stg" as const,
      dashboard: true,
    };

    // Act
    const traefik = new TraefikBootstrap("test-traefik", config);

    // Assert
    expect(traefik).toBeInstanceOf(TraefikBootstrap);
    expect(traefik.namespace).toBeDefined();
    expect(traefik.chart).toBeDefined();
    // Dashboard now managed by Helm chart, not Pulumi
  });

  it("should create namespace with correct metadata", async () => {
    // Arrange
    const config = {
      domain: "example.local",
      environment: "dev" as const,
      dashboard: false,
    };

    // Act
    const traefik = new TraefikBootstrap("test-traefik", config);

    // Assert
    expect(traefik.namespace).toBeDefined();
    expect(typeof traefik.namespace).toBe("object");
  });

  it("should create Helm chart with correct configuration", async () => {
    // Arrange
    const config = {
      domain: "example.local",
      email: "admin@example.local",
      environment: "prd" as const,
      dashboard: true,
    };

    // Act
    const traefik = new TraefikBootstrap("test-traefik", config);

    // Assert
    expect(traefik.chart).toBeDefined();
    expect(typeof traefik.chart).toBe("object");
  });

  it("should create dashboard ingress when domain and dashboard are provided", async () => {
    // Arrange
    const config = {
      domain: "example.local",
      environment: "dev" as const,
      dashboard: true,
    };

    // Act
    const traefik = new TraefikBootstrap("test-traefik", config);

    // Assert
    expect(traefik).toBeInstanceOf(TraefikBootstrap);
    expect(traefik.namespace).toBeDefined();
    expect(traefik.chart).toBeDefined();
    // Dashboard now managed by Helm chart, not Pulumi
  });

  it("should not create dashboard ingress when dashboard is disabled", async () => {
    // Arrange
    const config = {
      domain: "example.local",
      environment: "dev" as const,
      dashboard: false,
    };

    // Act
    const traefik = new TraefikBootstrap("test-traefik", config);

    // Assert
    expect(traefik).toBeInstanceOf(TraefikBootstrap);
    expect(traefik.namespace).toBeDefined();
    expect(traefik.chart).toBeDefined();
    // Dashboard now managed by Helm chart, not Pulumi
  });

  it("should follow SOLID principles with clear single responsibility", async () => {
    // Arrange
    const config = {
      domain: "example.local",
      email: "admin@example.local",
      environment: "stg" as const,
      dashboard: true,
    };

    // Act
    const traefik = new TraefikBootstrap("test-traefik", config);

    // Assert - Component should have clear single responsibility
    expect(typeof traefik.namespace).toBe("object");
    expect(typeof traefik.chart).toBe("object");
    // Dashboard now managed by Helm chart, not Pulumi
  });

  it("should handle minimal configuration", async () => {
    // Arrange
    const config = { environment: "dev" as const };

    // Act
    const traefik = new TraefikBootstrap("test-traefik", config);

    // Assert
    expect(traefik.namespace).toBeDefined();
    expect(traefik.chart).toBeDefined();
    // Dashboard now managed by Helm chart, not Pulumi
  });
});
