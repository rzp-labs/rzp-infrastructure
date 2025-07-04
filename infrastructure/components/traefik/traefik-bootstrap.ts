import type * as k8s from "@pulumi/kubernetes";
import * as pulumi from "@pulumi/pulumi";

import type { ITraefikBootstrapConfig } from "../../shared/types";

import { TraefikChart } from "./traefik-chart";
import { TraefikDashboard } from "./traefik-dashboard";
import { TraefikNamespace } from "./traefik-namespace";

/**
 * Traefik Bootstrap Component
 *
 * Deploys Traefik ingress controller via Helm for platform bootstrap.
 * This enables ArgoCD to be accessible via ingress while allowing
 * ArgoCD to manage Traefik configuration in GitOps mode later.
 */
export class TraefikBootstrap extends pulumi.ComponentResource {
  public readonly namespaceComponent: TraefikNamespace;
  public readonly chartComponent: TraefikChart;
  public readonly dashboardComponent: TraefikDashboard;
  public readonly namespace: k8s.core.v1.Namespace;
  public readonly chart: k8s.helm.v3.Chart;
  public readonly dashboard: k8s.networking.v1.Ingress | undefined;

  constructor(name: string, config: ITraefikBootstrapConfig, opts?: pulumi.ComponentResourceOptions) {
    super("rzp:traefik:TraefikBootstrap", name, {}, opts);

    // Create Traefik namespace using ComponentResource
    this.namespaceComponent = new TraefikNamespace(name, { parent: this });
    this.namespace = this.namespaceComponent.namespace;

    // Deploy Traefik using ComponentResource
    this.chartComponent = new TraefikChart(name, { namespace: this.namespace }, { parent: this });
    this.chart = this.chartComponent.chart;

    // Generate service name based on Helm chart naming convention: ${release-name}-chart
    const serviceName = `${name}-chart`;

    // Create dashboard using ComponentResource with correct service name
    this.dashboardComponent = new TraefikDashboard(
      name,
      { config, namespace: this.namespace, serviceName, chart: this.chart },
      { parent: this },
    );
    this.dashboard = this.dashboardComponent.ingress;

    this.registerOutputs({
      namespace: this.namespace,
      chart: this.chart,
      dashboard: this.dashboard,
    });
  }
}
