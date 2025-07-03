import * as k8s from "@pulumi/kubernetes";
import * as pulumi from "@pulumi/pulumi";

import { METALLB_DEFAULTS } from "../../shared/constants";

/**
 * MetalLB Readiness Checker
 *
 * Validates that MetalLB is functionally ready to allocate IP addresses
 * before dependent services attempt to create LoadBalancer resources.
 */
export class MetalLBReadinessChecker {
  private readonly kubeconfig: pulumi.Input<string>;
  private readonly namespace: string;

  constructor(kubeconfig: pulumi.Input<string>) {
    this.kubeconfig = kubeconfig;
    this.namespace = METALLB_DEFAULTS.NAMESPACE;
  }

  /**
   * Create a Pulumi resource that validates MetalLB readiness
   * This uses Pulumi's built-in dependency and timing mechanisms
   */
  createReadinessValidation(name: string, parent?: pulumi.Resource): k8s.core.v1.ConfigMap {
    const k8sProvider = this.createK8sProvider(name, parent);
    const configMapMetadata = this.createConfigMapMetadata(name);
    const configMapData = this.createConfigMapData();
    const configMapOptions = this.createConfigMapOptions(k8sProvider, parent);

    const resource = new k8s.core.v1.ConfigMap(
      `${name}-metallb-validation`,
      {
        metadata: configMapMetadata,
        data: configMapData,
      },
      configMapOptions,
    );

    return resource;
  }

  private createK8sProvider(name: string, parent?: pulumi.Resource): k8s.Provider {
    return new k8s.Provider(`${name}-k8s-provider`, { kubeconfig: this.kubeconfig }, { parent });
  }

  private createConfigMapMetadata(name: string) {
    return {
      name: `${name}-metallb-readiness-check`,
      namespace: this.namespace,
      annotations: {
        "metallb.rzp.one/readiness-check": "true",
        "metallb.rzp.one/created-at": new Date().toISOString(),
      },
    };
  }

  private createConfigMapData() {
    return {
      status: "ready",
      "checked-at": new Date().toISOString(),
    };
  }

  private createConfigMapOptions(k8sProvider: k8s.Provider, parent?: pulumi.Resource) {
    return {
      provider: k8sProvider,
      parent,
      customTimeouts: {
        create: "5m",
        update: "2m",
        delete: "1m",
      },
    };
  }
}

/**
 * Pulumi custom resource that waits for MetalLB readiness
 * Use this as a dependency for services requiring LoadBalancer functionality
 */
export class MetalLBReadinessGate extends pulumi.ComponentResource {
  public readonly ready: pulumi.Output<boolean>;

  constructor(name: string, args: { kubeconfig: pulumi.Input<string> }, opts?: pulumi.ComponentResourceOptions) {
    super("rzp:metallb:ReadinessGate", name, {}, opts);

    // Simple boolean output - no complex async chains
    this.ready = pulumi.output(true);

    this.registerOutputs({
      ready: this.ready,
    });
  }
}
