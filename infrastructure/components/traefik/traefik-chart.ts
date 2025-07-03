import * as k8s from "@pulumi/kubernetes";
import * as pulumi from "@pulumi/pulumi";

import { createTraefikValues } from "../../config/traefik-config";

import { TRAEFIK_DEFAULTS } from "../../shared/constants";
import { createHelmChartOptions } from "../../shared/resource-options";

interface ITraefikChartProps {
  namespace: k8s.core.v1.Namespace;
}

/**
 * Traefik Helm Chart Component
 *
 * Native Pulumi ComponentResource that deploys Traefik using Helm.
 * Replaces the createTraefikChart factory function with a proper component.
 */
export class TraefikChart extends pulumi.ComponentResource {
  public readonly chart: k8s.helm.v3.Chart;
  public readonly namespace: k8s.core.v1.Namespace;

  constructor(name: string, props: ITraefikChartProps, opts?: pulumi.ComponentResourceOptions) {
    super("rzp:traefik:Chart", name, {}, opts);

    this.namespace = props.namespace;
    this.chart = this.createChart(name, props);
    this.registerOutputs({ chart: this.chart, namespace: this.namespace });
  }

  private createChart(name: string, props: ITraefikChartProps): k8s.helm.v3.Chart {
    return new k8s.helm.v3.Chart(
      `${name}-chart`,
{
        chart: TRAEFIK_DEFAULTS.CHART_NAME,
        fetchOpts: { repo: TRAEFIK_DEFAULTS.CHART_REPO },
        version: TRAEFIK_DEFAULTS.CHART_VERSION,
        namespace: props.namespace.metadata.name,
        values: createTraefikValues(),
      },
      createHelmChartOptions(this, [props.namespace]),
    );
  }
}
