import * as k8s from "@pulumi/kubernetes";
import * as pulumi from "@pulumi/pulumi";

import { createMetalLBChartValues } from "../../config/metallb-config";
import { MetalLBReadinessGate } from "../../helpers/metallb/metallb-readiness-checker";
import { METALLB_DEFAULTS } from "../../shared/constants";
import type { IMetalLBBootstrapConfig } from "../../shared/types";

/**
 * MetalLB Bootstrap Component
 *
 * Deploys MetalLB load balancer controller with IP pool configuration.
 * Uses Helm chart with post-install hooks for proper timing and idempotency.
 */
export class MetalLBBootstrap extends pulumi.ComponentResource {
  public readonly namespace: k8s.core.v1.Namespace;
  public readonly chart: k8s.helm.v3.Chart;
  public readonly readinessGate: MetalLBReadinessGate;

  constructor(name: string, config: IMetalLBBootstrapConfig, opts?: pulumi.ComponentResourceOptions) {
    super("rzp:metallb:MetalLBBootstrap", name, {}, opts);

    // Create Kubernetes provider
    const k8sProvider = new k8s.Provider(`${name}-k8s-provider`, { kubeconfig: config.kubeconfig }, { parent: this });

    // Create MetalLB namespace
    this.namespace = this.createMetalLBNamespace(name, k8sProvider);

    // Deploy MetalLB Helm chart
    this.chart = this.createMetalLBChart(name, config, k8sProvider);

    // Create readiness gate that waits for MetalLB to be functionally ready
    this.readinessGate = this.createReadinessGate(name, config);

    this.registerOutputs({
      namespace: this.namespace,
      chart: this.chart,
      readinessGate: this.readinessGate,
    });
  }

  private createMetalLBNamespace(name: string, k8sProvider: k8s.Provider): k8s.core.v1.Namespace {
    return new k8s.core.v1.Namespace(
      `${name}-namespace`,
      {
        metadata: {
          name: METALLB_DEFAULTS.NAMESPACE,
          labels: {
            "app.kubernetes.io/name": "metallb",
            "app.kubernetes.io/managed-by": "pulumi",
            "pod-security.kubernetes.io/enforce": "privileged",
            "pod-security.kubernetes.io/audit": "privileged",
            "pod-security.kubernetes.io/warn": "privileged",
          },
        },
      },
      { provider: k8sProvider, parent: this },
    );
  }

  private createMetalLBChart(
    name: string,
    config: IMetalLBBootstrapConfig,
    k8sProvider: k8s.Provider,
  ): k8s.helm.v3.Chart {
    const chartConfig = this.createChartConfig(config);
    const chartOptions = this.createChartOptions(k8sProvider);

    return new k8s.helm.v3.Chart(`${name}-chart`, chartConfig, chartOptions);
  }

  private createChartConfig(config: IMetalLBBootstrapConfig) {
    return {
      chart: METALLB_DEFAULTS.CHART_NAME,
      fetchOpts: { repo: METALLB_DEFAULTS.CHART_REPO },
      version: METALLB_DEFAULTS.CHART_VERSION,
      namespace: this.namespace.metadata.name,
      values: createMetalLBChartValues(config.ipRange),
    };
  }

  private createChartOptions(k8sProvider: k8s.Provider) {
    return {
      provider: k8sProvider,
      parent: this,
      dependsOn: [this.namespace],
    };
  }

  private createReadinessGate(name: string, config: IMetalLBBootstrapConfig): MetalLBReadinessGate {
    return new MetalLBReadinessGate(
      `${name}-readiness-gate`,
      {
        kubeconfig: config.kubeconfig,
      },
      {
        parent: this,
        dependsOn: [this.chart],
      },
    );
  }
}
