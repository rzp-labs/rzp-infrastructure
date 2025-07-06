import type * as k8s from "@pulumi/kubernetes";
import * as pulumi from "@pulumi/pulumi";

import { createTraefikChartValues } from "../../config/traefik-config";
import { ChartComponent } from "../../shared/base-chart-component";
import { NamespaceComponent } from "../../shared/base-namespace-component";
import { TRAEFIK_DEFAULTS } from "../../shared/constants";
import type { ITraefikBootstrapConfig } from "../../shared/types";

/**
 * Traefik Bootstrap Component
 *
 * Deploys Traefik ingress controller via Helm for platform bootstrap.
 * This enables ArgoCD to be accessible via ingress while allowing
 * ArgoCD to manage Traefik configuration in GitOps mode later.
 *
 * REFACTORED: Now uses generic NamespaceComponent and ChartComponent
 * instead of service-specific components, reducing duplication.
 */
export class TraefikBootstrap extends pulumi.ComponentResource {
  public readonly namespaceComponent: NamespaceComponent;
  public readonly chartComponent: ChartComponent;
  public readonly namespace: k8s.core.v1.Namespace;
  public readonly chart: k8s.helm.v3.Chart;

  constructor(name: string, config: ITraefikBootstrapConfig, opts?: pulumi.ComponentResourceOptions) {
    super("rzp:traefik:TraefikBootstrap", name, {}, opts);

    this.namespaceComponent = this.createNamespace(name);
    this.namespace = this.namespaceComponent.namespace;

    this.chartComponent = this.createChart(name, config);
    this.chart = this.chartComponent.chart;

    this.registerAllOutputs();
  }

  private createNamespace(name: string): NamespaceComponent {
    return new NamespaceComponent(
      name,
      { namespaceName: TRAEFIK_DEFAULTS.NAMESPACE, appName: "traefik" },
      { parent: this },
    );
  }

  private createChart(name: string, config: ITraefikBootstrapConfig): ChartComponent {
    return new ChartComponent(
      name,
      {
        chartName: TRAEFIK_DEFAULTS.CHART_NAME,
        chartRepo: TRAEFIK_DEFAULTS.CHART_REPO,
        chartVersion: TRAEFIK_DEFAULTS.CHART_VERSION,
        namespace: this.namespace,
        values: createTraefikChartValues(config),
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
