import * as k8s from "@pulumi/kubernetes";
import * as pulumi from "@pulumi/pulumi";

import { createMetalLBChartValues } from "../../config/metallb-config";
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

  constructor(name: string, config: IMetalLBBootstrapConfig, opts?: pulumi.ComponentResourceOptions) {
    super("rzp:metallb:MetalLBBootstrap", name, {}, opts);

    // Create MetalLB namespace
    this.namespace = this.createMetalLBNamespace(name);

    // Deploy MetalLB Helm chart
    this.chart = this.createMetalLBChart(name, config);

    this.registerOutputs({
      namespace: this.namespace,
      chart: this.chart,
    });
  }

  private createMetalLBNamespace(name: string): k8s.core.v1.Namespace {
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
      { parent: this },
    );
  }

  private createMetalLBChart(name: string, config: IMetalLBBootstrapConfig): k8s.helm.v3.Chart {
    const chartConfig = this.createChartConfig(config);
    const chartOptions = this.createChartOptions();

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

  private createChartOptions() {
    return {
      parent: this,
      dependsOn: [this.namespace],
    };
  }
}
