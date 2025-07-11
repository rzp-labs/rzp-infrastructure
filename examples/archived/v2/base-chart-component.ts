import * as k8s from "@pulumi/kubernetes";
import * as pulumi from "@pulumi/pulumi";

import { helmChartResourceOptions } from "./resource-options";

/**
 * Configuration for creating a generic Helm chart component
 */
export interface IChartConfig {
  readonly chartName: string;
  readonly chartRepo: string;
  readonly chartVersion: string;
  readonly namespace: k8s.core.v1.Namespace;
  readonly values?: unknown;
  readonly dependsOn?: pulumi.Resource[];
}

/**
 * Generic Helm Chart Component
 *
 * Replaces the individual chart components (ArgoCdChart, TraefikChart, etc.)
 * with a single configurable component. This eliminates duplication while maintaining
 * proper Pulumi ComponentResource patterns.
 *
 * Usage:
 *   const chartComponent = new ChartComponent("my-app", {
 *     chartName: "my-chart",
 *     chartRepo: "https://charts.example.com",
 *     chartVersion: "1.0.0",
 *     namespace: namespaceComponent.namespace,
 *     values: { replicas: 3 }
 *   });
 */
export class ChartComponent extends pulumi.ComponentResource {
  public readonly chart: k8s.helm.v3.Chart;

  constructor(name: string, config: IChartConfig, opts?: pulumi.ComponentResourceOptions) {
    super("rzp-infra:shared:Chart", name, {}, opts);

    this.chart = this.createChart(name, config);
    this.registerOutputs({ chart: this.chart });
  }

  private createChart(name: string, config: IChartConfig): k8s.helm.v3.Chart {
    return new k8s.helm.v3.Chart(
      `${name}-chart`,
      {
        chart: config.chartName,
        fetchOpts: { repo: config.chartRepo },
        version: config.chartVersion,
        namespace: config.namespace.metadata.name,
        values: config.values ?? {},
      },
      {
        ...helmChartResourceOptions,
        parent: this,
        dependsOn: [config.namespace, ...(config.dependsOn ?? [])],
      },
    );
  }
}
