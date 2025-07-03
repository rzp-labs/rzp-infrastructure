import * as k8s from "@pulumi/kubernetes";
import * as pulumi from "@pulumi/pulumi";

import { CERT_MANAGER_DEFAULTS } from "../../shared/constants";
import { createHelmChartOptions } from "../../shared/resource-options";

interface ICertManagerChartProps {
  namespace: k8s.core.v1.Namespace;
}

/**
 * Cert-Manager Helm Chart Component
 *
 * Native Pulumi ComponentResource that deploys cert-manager using Helm.
 * Replaces the createCertManagerChart factory function with a proper component.
 */
export class CertManagerChart extends pulumi.ComponentResource {
  public readonly chart: k8s.helm.v3.Chart;
  public readonly namespace: k8s.core.v1.Namespace;

  constructor(name: string, props: ICertManagerChartProps, opts?: pulumi.ComponentResourceOptions) {
    super("rzp:cert-manager:Chart", name, {}, opts);

    this.namespace = props.namespace;
    this.chart = this.createChart(name, props);
    this.registerOutputs({ chart: this.chart, namespace: this.namespace });
  }

  private createChart(name: string, props: ICertManagerChartProps): k8s.helm.v3.Chart {
    return new k8s.helm.v3.Chart(
      `${name}-chart`,
      {
        chart: CERT_MANAGER_DEFAULTS.CHART_NAME,
        fetchOpts: { repo: CERT_MANAGER_DEFAULTS.CHART_REPO },
        version: CERT_MANAGER_DEFAULTS.CHART_VERSION,
        namespace: props.namespace.metadata.name,
        values: {
          installCRDs: true,
          global: { rbac: { create: true } },
        },
      },
      createHelmChartOptions(this, [props.namespace]),
    );
  }
}
