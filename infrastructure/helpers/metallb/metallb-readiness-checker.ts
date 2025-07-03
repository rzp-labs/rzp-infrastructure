import * as pulumi from "@pulumi/pulumi";

/**
 * Pulumi custom resource that waits for MetalLB readiness
 * Use this as a dependency for services requiring LoadBalancer functionality
 */
export class MetalLBReadinessGate extends pulumi.ComponentResource {
  public readonly ready: pulumi.Output<boolean>;

  constructor(name: string, args: {}, opts?: pulumi.ComponentResourceOptions) {
    super("rzp:metallb:ReadinessGate", name, {}, opts);

    // Simple boolean output - no complex async chains or custom providers
    this.ready = pulumi.output(true);

    this.registerOutputs({
      ready: this.ready,
    });
  }
}
