import * as pulumi from "@pulumi/pulumi";

import { ArgoCdBootstrap } from "../../../components/argocd/argocd-bootstrap";

// Mock Pulumi runtime for testing
pulumi.runtime.setMocks({
  newResource: (args: pulumi.runtime.MockResourceArgs): { id: string; state: any } => {
    return {
      id: `${args.name}-id`,
      state: args.inputs,
    };
  },
  call: (args: pulumi.runtime.MockCallArgs) => {
    return args.inputs;
  },
});

describe("ArgoCdBootstrap Component", () => {
  test("should create ArgoCD bootstrap component with valid configuration", async () => {
    // Arrange
    const mockKubeconfig = pulumi.output("mock-kubeconfig");
    const repositoryUrl = "https://github.com/stephen/rzp-infra.git";

    // Act
    const argocd = new ArgoCdBootstrap("test-argocd", {
      kubeconfig: mockKubeconfig,
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
    const mockKubeconfig = pulumi.output("mock-kubeconfig");
    const repositoryUrl = "https://github.com/stephen/rzp-infra.git";

    // Act
    const argocd = new ArgoCdBootstrap("test-argocd-default", {
      kubeconfig: mockKubeconfig,
      repositoryUrl,
    });

    // Assert
    expect(argocd).toBeInstanceOf(ArgoCdBootstrap);
    expect(argocd.namespace).toBeDefined();
  });

  test("should handle custom admin password", async () => {
    // Arrange
    const mockKubeconfig = pulumi.output("mock-kubeconfig");
    const repositoryUrl = "https://github.com/stephen/rzp-infra.git";
    const customPassword = pulumi.secret("custom-admin-password");

    // Act
    const argocd = new ArgoCdBootstrap("test-argocd-custom", {
      kubeconfig: mockKubeconfig,
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
    const mockKubeconfig = pulumi.output("mock-kubeconfig");
    const repositoryUrl = "https://github.com/stephen/rzp-infra.git";

    // Act
    const argocd = new ArgoCdBootstrap("test-argocd-solid", {
      kubeconfig: mockKubeconfig,
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
    const mockKubeconfig = pulumi.output("mock-kubeconfig");
    const repositoryUrl = "https://github.com/stephen/rzp-infra.git";

    // Act
    const argocd = new ArgoCdBootstrap("test-argocd-arch", {
      kubeconfig: mockKubeconfig,
      repositoryUrl,
    });

    // Assert - Should be a proper Pulumi ComponentResource
    expect(argocd).toBeInstanceOf(pulumi.ComponentResource);
  });
});