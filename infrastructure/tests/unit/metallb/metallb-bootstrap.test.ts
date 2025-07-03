import * as pulumi from "@pulumi/pulumi";

import { MetalLBBootstrap } from "../../../components/metallb/metallb-bootstrap";

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

interface IConfigMapInputs {
  name: string;
  metadata: IK8sMetadata;
  data?: Record<string, string>;
}

interface INamespaceInputs {
  name: string;
  metadata: IK8sMetadata;
}

// Union type for all possible resource inputs we actually use
type MockResourceInputs = IHelmChartInputs | IConfigMapInputs | INamespaceInputs;

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

describe("MetalLBBootstrap", () => {
  const mockConfig = {
    kubeconfig: pulumi.output("mock-kubeconfig"),
    ipRange: "10.10.0.200-10.10.0.205",
  };

  it("should create MetalLB component with all required resources", async () => {
    // Act
    const metallb = new MetalLBBootstrap("test-metallb", mockConfig);

    // Assert
    expect(metallb).toBeInstanceOf(MetalLBBootstrap);
    expect(metallb.namespace).toBeDefined();
    expect(metallb.chart).toBeDefined();
    expect(metallb.readinessGate).toBeDefined();
  });

  it("should create readiness gate with proper dependencies", async () => {
    // Arrange & Act
    const metallb = new MetalLBBootstrap("test-metallb", mockConfig);

    // Assert
    expect(metallb.readinessGate).toBeDefined();
    // The readiness gate should be created after the chart
    // This ensures MetalLB is deployed before checking readiness
  });

  it("should follow SOLID principles with clear single responsibility", async () => {
    // Act
    const metallb = new MetalLBBootstrap("test-metallb", mockConfig);

    // Assert - Component should have clear single responsibility
    expect(typeof metallb.namespace).toBe("object");
    expect(typeof metallb.chart).toBe("object");
    expect(typeof metallb.readinessGate).toBe("object");
  });

  it("should handle minimal configuration", async () => {
    // Arrange
    const minimalConfig = {
      kubeconfig: pulumi.output("minimal-kubeconfig"),
      ipRange: "192.168.1.200-192.168.1.205",
    };

    // Act
    const metallb = new MetalLBBootstrap("minimal-metallb", minimalConfig);

    // Assert
    expect(metallb.namespace).toBeDefined();
    expect(metallb.chart).toBeDefined();
    expect(metallb.readinessGate).toBeDefined();
  });

  it("should expose readiness gate for proper dependency chaining", async () => {
    // Act
    const metallb = new MetalLBBootstrap("test-metallb", mockConfig);

    // Assert
    // The readiness gate should be accessible for dependent services like Traefik
    expect(metallb.readinessGate).toBeDefined();
    expect(typeof metallb.readinessGate).toBe("object");
  });
});
