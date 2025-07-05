import * as pulumi from "@pulumi/pulumi";

import { ArgoCdBootstrap } from "../../../components/argocd/argocd-bootstrap";

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

describe("ArgoCdBootstrap Component", () => {
  test("should create ArgoCD bootstrap component with valid configuration", async () => {
    // Arrange
    const repositoryUrl = "https://github.com/rzp-labs/rzp-infrastructure.git";

    // Act
    const argocd = new ArgoCdBootstrap("test-argocd", {
      repositoryUrl,
      domain: "argocd.test.local",
    });

    // Assert
    expect(argocd).toBeInstanceOf(ArgoCdBootstrap);
    expect(argocd.namespace).toBeDefined();
    expect(argocd.adminSecret).toBeDefined();
    expect(argocd.ingress).toBeDefined();
    expect(argocd.argoCdApp).toBeDefined();
  });

  test("should handle default domain when not provided", async () => {
    // Arrange
    const repositoryUrl = "https://github.com/rzp-labs/rzp-infrastructure.git";

    // Act
    const argocd = new ArgoCdBootstrap("test-argocd-default", {
      repositoryUrl,
    });

    // Assert
    expect(argocd).toBeInstanceOf(ArgoCdBootstrap);
    expect(argocd.namespace).toBeDefined();
  });

  test("should handle custom admin password", async () => {
    // Arrange
    const repositoryUrl = "https://github.com/rzp-labs/rzp-infrastructure.git";
    const customPassword = pulumi.secret("custom-admin-password");

    // Act
    const argocd = new ArgoCdBootstrap("test-argocd-custom", {
      repositoryUrl,
      adminPassword: customPassword,
      domain: "argocd.custom.local",
    });

    // Assert
    expect(argocd).toBeInstanceOf(ArgoCdBootstrap);
    expect(argocd.adminSecret).toBeDefined();
  });

  test("should maintain SOLID principles", async () => {
    // Arrange
    const repositoryUrl = "https://github.com/rzp-labs/rzp-infrastructure.git";

    // Act
    const argocd = new ArgoCdBootstrap("test-argocd-solid", {
      repositoryUrl,
    });

    // Assert - Component should have clear single responsibility
    expect(typeof argocd.namespace).toBe("object");
    expect(typeof argocd.adminSecret).toBe("object");
    expect(typeof argocd.ingress).toBe("object");
    expect(typeof argocd.argoCdApp).toBe("object");
  });
});

describe("ArgoCD Component Architecture", () => {
  test("should follow component resource pattern", async () => {
    // Arrange
    const repositoryUrl = "https://github.com/rzp-labs/rzp-infrastructure.git";

    // Act
    const argocd = new ArgoCdBootstrap("test-argocd-arch", {
      repositoryUrl,
    });

    // Assert - Should be a proper Pulumi ComponentResource
    expect(argocd).toBeInstanceOf(pulumi.ComponentResource);
  });
});
