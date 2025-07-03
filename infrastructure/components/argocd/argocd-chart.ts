import * as k8s from "@pulumi/kubernetes";
import * as pulumi from "@pulumi/pulumi";

import { createArgoCdChartValues } from "../../config/argocd-config";
import { ARGOCD_DEFAULTS } from "../../shared/constants";
import { createHelmChartOptions } from "../../shared/resource-options";
import type { IArgoCdBootstrapConfig } from "../../shared/types";

interface IArgoCdChartProps {
  config: IArgoCdBootstrapConfig;
  namespace: k8s.core.v1.Namespace;
}

/**
 * ArgoCD Helm Chart Component
 *
 * Native Pulumi ComponentResource that deploys ArgoCD using Helm.
 * Replaces the createArgoCdChart factory function with a proper component.
 */
export class ArgoCdChart extends pulumi.ComponentResource {
  public readonly chart: k8s.helm.v3.Chart;
  public readonly namespace: k8s.core.v1.Namespace;

  constructor(name: string, props: IArgoCdChartProps, opts?: pulumi.ComponentResourceOptions) {
    super("rzp:argocd:Chart", name, {}, opts);

    this.namespace = props.namespace;
    this.chart = this.createChart(name, props);
    this.registerOutputs({ chart: this.chart, namespace: this.namespace });
  }

  private createChart(name: string, props: IArgoCdChartProps): k8s.helm.v3.Chart {
    return new k8s.helm.v3.Chart(
      `${name}-chart`,
      {
        chart: ARGOCD_DEFAULTS.CHART_NAME,
        fetchOpts: { repo: ARGOCD_DEFAULTS.CHART_REPO },
        version: ARGOCD_DEFAULTS.CHART_VERSION,
        namespace: props.namespace.metadata.name,
        values: createArgoCdChartValues(props.config),
      },
      createHelmChartOptions(this, [props.namespace]),
    );
  }
}
