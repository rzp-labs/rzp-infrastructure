import * as k8s from "@pulumi/kubernetes";
import * as pulumi from "@pulumi/pulumi";

/**
 * MetalLB IP Pool Configuration Component
 *
 * Creates IPAddressPool and L2Advertisement resources required for MetalLB load balancer functionality.
 * These cannot be created via Helm chart extraResources due to CRD timing limitations since MetalLB 0.13.0.
 * Must be deployed after MetalLB chart installation when CRDs are available.
 *
 * Follows the same pattern as cert-manager ClusterIssuer component.
 */
export class MetalLBPools extends pulumi.ComponentResource {
  public readonly ipAddressPool: k8s.apiextensions.CustomResource;
  public readonly l2Advertisement: k8s.apiextensions.CustomResource;

  constructor(name: string, args: { ipRange: string; namespace: string }, opts?: pulumi.ComponentResourceOptions) {
    super("rzp-infra:metallb:MetalLBPools", name, {}, opts);

    this.ipAddressPool = this.createIPAddressPool(name, args.ipRange, args.namespace);
    this.l2Advertisement = this.createL2Advertisement(name, args.namespace);

    this.registerOutputs({
      ipAddressPool: this.ipAddressPool,
      l2Advertisement: this.l2Advertisement,
    });
  }

  private createIPAddressPool(name: string, ipRange: string, namespace: string): k8s.apiextensions.CustomResource {
    return new k8s.apiextensions.CustomResource(
      `${name}-pool`,
      {
        apiVersion: "metallb.io/v1beta1",
        kind: "IPAddressPool",
        metadata: {
          name: "default-pool",
          namespace: namespace,
        },
        spec: {
          addresses: [ipRange],
        },
      },
      { parent: this },
    );
  }

  private createL2Advertisement(name: string, namespace: string): k8s.apiextensions.CustomResource {
    return new k8s.apiextensions.CustomResource(
      `${name}-l2adv`,
      {
        apiVersion: "metallb.io/v1beta1",
        kind: "L2Advertisement",
        metadata: {
          name: "default-l2-advertisement",
          namespace: namespace,
        },
        spec: {
          ipAddressPools: ["default-pool"],
        },
      },
      { parent: this, dependsOn: [this.ipAddressPool] },
    );
  }
}
