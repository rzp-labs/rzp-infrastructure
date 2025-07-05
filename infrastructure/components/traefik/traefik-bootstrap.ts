import type * as k8s from "@pulumi/kubernetes";
import * as pulumi from "@pulumi/pulumi";

import { createTraefikChartValues } from "../../config/traefik-config";
import { ChartComponent } from "../../shared/base-chart-component";
import { NamespaceComponent } from "../../shared/base-namespace-component";
import { TRAEFIK_DEFAULTS } from "../../shared/constants";
import type { ITraefikBootstrapConfig } from "../../shared/types";

import { TraefikDashboard } from "./traefik-dashboard";

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
  public readonly dashboardComponent: TraefikDashboard;
  public readonly namespace: k8s.core.v1.Namespace;
  public readonly chart: k8s.helm.v3.Chart;
  public readonly dashboard: k8s.networking.v1.Ingress | undefined;

  constructor(name: string, config: ITraefikBootstrapConfig, opts?: pulumi.ComponentResourceOptions) {
    super("rzp:traefik:TraefikBootstrap", name, {}, opts);

    this.namespaceComponent = this.createNamespace(name);
    this.namespace = this.namespaceComponent.namespace;

    this.chartComponent = this.createChart(name);
    this.chart = this.chartComponent.chart;

    this.dashboardComponent = this.createDashboard(name, config);
    this.dashboard = this.dashboardComponent.ingress;

    this.registerAllOutputs();
  }

  private createNamespace(name: string): NamespaceComponent {
    return new NamespaceComponent(
      name,
      { namespaceName: TRAEFIK_DEFAULTS.NAMESPACE, appName: "traefik" },
      { parent: this },
    );
  }

  private createChart(name: string): ChartComponent {
    return new ChartComponent(
      name,
      {
        chartName: TRAEFIK_DEFAULTS.CHART_NAME,
        chartRepo: TRAEFIK_DEFAULTS.CHART_REPO,
        chartVersion: TRAEFIK_DEFAULTS.CHART_VERSION,
        namespace: this.namespace,
        values: createTraefikChartValues(),
      },
      { parent: this },
    );
  }

  private createDashboard(name: string, config: ITraefikBootstrapConfig): TraefikDashboard {
    const serviceName = `${name}-chart`;
    return new TraefikDashboard(
      name,
      { config, namespace: this.namespace, serviceName, chart: this.chart },
      { parent: this },
    );
  }

  private registerAllOutputs(): void {
    this.registerOutputs({
      namespace: this.namespace,
      chart: this.chart,
      dashboard: this.dashboard,
    });
  }
}
