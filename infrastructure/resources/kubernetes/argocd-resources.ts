import * as k8s from "@pulumi/kubernetes";
import type * as pulumi from "@pulumi/pulumi";

import { createArgoCdChartValues } from "../../config/argocd-config";
import { ARGOCD_DEFAULTS } from "../../shared/constants";
import type { IArgoCdBootstrapConfig } from "../../shared/types";

export function createArgoCdNamespace(name: string, parent: pulumi.Resource): k8s.core.v1.Namespace {
  return new k8s.core.v1.Namespace(
    `${name}-namespace`,
    {
      metadata: {
        name: ARGOCD_DEFAULTS.NAMESPACE,
        labels: {
          "app.kubernetes.io/name": "argocd",
          "app.kubernetes.io/part-of": "argocd",
        },
      },
    },
    { parent },
  );
}

export function createArgoCdChart(
  name: string,
  config: IArgoCdBootstrapConfig,
  namespace: k8s.core.v1.Namespace,
  parent: pulumi.Resource,
): k8s.helm.v3.Chart {
  const chartConfig = createArgoCdChartConfig(config, namespace);
  const chartOptions = createArgoCdChartOptions(parent);

  return new k8s.helm.v3.Chart(`${name}-chart`, chartConfig, chartOptions);
}

function createArgoCdChartConfig(config: IArgoCdBootstrapConfig, namespace: k8s.core.v1.Namespace) {
  return {
    chart: ARGOCD_DEFAULTS.CHART_NAME,
    fetchOpts: { repo: ARGOCD_DEFAULTS.CHART_REPO },
    version: ARGOCD_DEFAULTS.CHART_VERSION,
    namespace: namespace.metadata.name,
    values: createArgoCdChartValues(config),
  };
}

function createArgoCdChartOptions(parent: pulumi.Resource) {
  return { parent };
}
