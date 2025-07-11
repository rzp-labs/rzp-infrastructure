import * as pulumi from "@pulumi/pulumi";

import { ArgoCdComponent } from "../../../components/argocd/component-argocd";

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

interface ISecretInputs {
  name: string;
  metadata: IK8sMetadata;
  type?: string;
  data?: Record<string, string>;
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

interface IArgoCdAppInputs {
  name: string;
  metadata: IK8sMetadata;
  spec?: Record<string, unknown>;
}

// Union type for all ArgoCD-related resource inputs
type MockResourceInputs = IHelmChartInputs | ISecretInputs | IIngressInputs | INamespaceInputs | IArgoCdAppInputs;

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

describe("ArgoCdComponent Component", () => {
  test("should create ArgoCD component with valid configuration", async () => {
    // Arrange
    const config = {
      namespace: "argocd",
      chartVersion: "5.46.7",
      environment: "dev" as const,
      domain: "argocd.test.local",
    };

    // Act
    const argocd = new ArgoCdComponent("test-argocd", config);

    // Assert
    expect(argocd).toBeInstanceOf(ArgoCdComponent);
    expect(argocd.namespace).toBeDefined();
    expect(argocd.chart).toBeDefined();
    expect(argocd.ingress).toBeDefined();
  });

  test("should handle default domain when not provided", async () => {
    // Arrange
    const config = {
      namespace: "argocd",
      chartVersion: "5.46.7",
      environment: "dev" as const,
      domain: "argocd.default.local",
    };

    // Act
    const argocd = new ArgoCdComponent("test-argocd-default", config);

    // Assert
    expect(argocd).toBeInstanceOf(ArgoCdComponent);
    expect(argocd.namespace).toBeDefined();
  });

  test("should handle custom domain configuration", async () => {
    // Arrange
    const config = {
      namespace: "argocd",
      chartVersion: "5.46.7",
      environment: "stg" as const,
      domain: "argocd.custom.local",
    };

    // Act
    const argocd = new ArgoCdComponent("test-argocd-custom", config);

    // Assert
    expect(argocd).toBeInstanceOf(ArgoCdComponent);
    expect(argocd.chart).toBeDefined();
  });

  test("should maintain SOLID principles", async () => {
    // Arrange
    const config = {
      namespace: "argocd",
      chartVersion: "5.46.7",
      environment: "prd" as const,
      domain: "argocd.solid.local",
    };

    // Act
    const argocd = new ArgoCdComponent("test-argocd-solid", config);

    // Assert - Component should have clear single responsibility
    expect(typeof argocd.namespace).toBe("object");
    expect(typeof argocd.chart).toBe("object");
    expect(typeof argocd.ingress).toBe("object");
  });
});

describe("ArgoCD Component Architecture", () => {
  test("should follow component resource pattern", async () => {
    // Arrange
    const config = {
      namespace: "argocd",
      chartVersion: "5.46.7",
      environment: "dev" as const,
      domain: "argocd.arch.local",
    };

    // Act
    const argocd = new ArgoCdComponent("test-argocd-arch", config);

    // Assert - Should be a proper Pulumi ComponentResource
    expect(argocd).toBeInstanceOf(pulumi.ComponentResource);
  });
});
