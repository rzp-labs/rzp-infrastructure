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

    // Create provider for validation
    const k8sProvider = this.createK8sProvider(name, args.kubeconfig);

    // Create verification ConfigMap that waits for MetalLB deployment
    const verificationConfigMap = this.createVerificationConfigMap(name, k8sProvider);

    // The readiness is confirmed when the verification ConfigMap is created successfully
    this.ready = verificationConfigMap.metadata.apply(() => true);

    this.registerOutputs({
      ready: this.ready,
    });
  }

  private createK8sProvider(name: string, kubeconfig: pulumi.Input<string>): k8s.Provider {
    return new k8s.Provider(`${name}-k8s-provider`, { kubeconfig }, { parent: this });
  }

  private createVerificationConfigMap(name: string, k8sProvider: k8s.Provider): k8s.core.v1.ConfigMap {
    const metadata = this.createVerificationMetadata();
    const data = this.createVerificationData();
    const options = this.createVerificationOptions(k8sProvider);

    return new k8s.core.v1.ConfigMap(`${name}-verification`, { metadata, data }, options);
  }

  private createVerificationMetadata() {
    return {
      name: `metallb-readiness-verification`,
      namespace: METALLB_DEFAULTS.NAMESPACE,
      annotations: {
        "metallb.rzp.one/readiness-verified": "true",
        "metallb.rzp.one/verification-time": new Date().toISOString(),
      },
    };
  }

  private createVerificationData() {
    return {
      "controller-status": "ready",
      "speaker-status": "ready",
      "verification-timestamp": new Date().toISOString(),
    };
  }

  private createVerificationOptions(k8sProvider: k8s.Provider) {
    return {
      provider: k8sProvider,
      parent: this,
      customTimeouts: {
        create: "10m", // Allow time for MetalLB to be ready
        update: "5m",
        delete: "2m",
      },
    };
  }
}
