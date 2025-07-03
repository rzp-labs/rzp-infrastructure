import * as pulumi from "@pulumi/pulumi";

import { MetalLBReadinessChecker, MetalLBReadinessGate } from "../../../helpers/metallb/metallb-readiness-checker";

// Mock Pulumi runtime for testing - specific typed interfaces
interface IK8sMetadata {
  name: string;
  namespace: string;
  annotations?: Record<string, string>;
}

interface IConfigMapInputs {
  name: string;
  metadata: IK8sMetadata;
  data?: Record<string, string>;
}

interface IProviderInputs {
  name: string;
  kubeconfig: string;
}

// Only the specific types we actually need for this test
type MockResourceInputs = IConfigMapInputs | IProviderInputs;

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

describe("MetalLBReadinessChecker", () => {
  let readinessChecker: MetalLBReadinessChecker;
  const mockKubeconfig = pulumi.output("mock-kubeconfig");

  beforeEach(() => {
    readinessChecker = new MetalLBReadinessChecker(mockKubeconfig);
  });

  it("should create readiness validation resource", async () => {
    // Act
    const validation = readinessChecker.createReadinessValidation("test");

    // Assert
    expect(validation).toBeDefined();
  });

  it("should create validation with parent resource", async () => {
    // Arrange
    const mockParent = new pulumi.ComponentResource("test", "test-parent");

    // Act
    const validation = readinessChecker.createReadinessValidation("test", mockParent);

    // Assert
    expect(validation).toBeDefined();
  });
});

describe("MetalLBReadinessGate", () => {
  it("should create component resource with proper arguments", async () => {
    // Arrange
    const mockKubeconfig = pulumi.output("test-kubeconfig");
    const name = "test-gate";

    // Act
    const gate = new MetalLBReadinessGate(name, { kubeconfig: mockKubeconfig }, { parent: undefined });

    // Assert
    expect(gate).toBeDefined();
  });
});
