import type * as k8s from "@pulumi/kubernetes";
import * as pulumi from "@pulumi/pulumi";

import { createMetalLBChartValues } from "../../config/metallb-config";
import { ChartComponent } from "../../shared/base-chart-component";
import { NamespaceComponent } from "../../shared/base-namespace-component";
import { METALLB_DEFAULTS } from "../../shared/constants";
import type { IMetalLBBootstrapConfig } from "../../shared/types";

/**
 * MetalLB Bootstrap Component
 *
 * Deploys MetalLB load balancer controller with IP pool configuration.
 * Uses Helm chart with post-install hooks for proper timing and idempotency.
 *
 * REFACTORED: Now uses generic NamespaceComponent and ChartComponent
 * instead of service-specific components, reducing duplication.
 */
export class MetalLBBootstrap extends pulumi.ComponentResource {
  public readonly namespace: k8s.core.v1.Namespace;
  public readonly chart: k8s.helm.v3.Chart;
  public readonly namespaceComponent: NamespaceComponent;
  public readonly chartComponent: ChartComponent;

  constructor(name: string, config: IMetalLBBootstrapConfig, opts?: pulumi.ComponentResourceOptions) {
    super("rzp:metallb:MetalLBBootstrap", name, {}, opts);

    this.namespaceComponent = this.createNamespace(name);
    this.namespace = this.namespaceComponent.namespace;

    this.chartComponent = this.createChart(name, config);
    this.chart = this.chartComponent.chart;

    this.registerAllOutputs();
  }

  private createNamespace(name: string): NamespaceComponent {
    return new NamespaceComponent(
      name,
      {
        namespaceName: METALLB_DEFAULTS.NAMESPACE,
        appName: "metallb",
        extraLabels: {
          "pod-security.kubernetes.io/enforce": "privileged",
          "pod-security.kubernetes.io/audit": "privileged",
          "pod-security.kubernetes.io/warn": "privileged",
        },
      },
      { parent: this },
    );
  }

  private createChart(name: string, config: IMetalLBBootstrapConfig): ChartComponent {
    return new ChartComponent(
      name,
      {
        chartName: METALLB_DEFAULTS.CHART_NAME,
        chartRepo: METALLB_DEFAULTS.CHART_REPO,
        chartVersion: METALLB_DEFAULTS.CHART_VERSION,
        namespace: this.namespace,
        values: createMetalLBChartValues(config.ipRange),
      },
      { parent: this },
    );
  }

  private registerAllOutputs(): void {
    this.registerOutputs({
      namespace: this.namespace,
      chart: this.chart,
    });
  }
}
