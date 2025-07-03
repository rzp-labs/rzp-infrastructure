import * as k8s from "@pulumi/kubernetes";
import type * as pulumi from "@pulumi/pulumi";

import { createTraefikValues } from "../../config/traefik-config";
import { TRAEFIK_DEFAULTS } from "../../shared/constants";
import type { ITraefikBootstrapConfig } from "../../shared/types";

import { createTraefikDashboardIngress } from "./traefik-ingress";

export function createTraefikNamespace(name: string, parent: pulumi.Resource): k8s.core.v1.Namespace {
  return new k8s.core.v1.Namespace(
    `${name}-namespace`,
    {
      metadata: {
        name: TRAEFIK_DEFAULTS.NAMESPACE,
        labels: {
          "app.kubernetes.io/name": "traefik",
          "app.kubernetes.io/managed-by": "pulumi",
        },
      },
    },
    { parent },
  );
}

export function createTraefikChart(
  name: string,
  config: ITraefikBootstrapConfig,
  namespace: k8s.core.v1.Namespace,
  parent: pulumi.Resource,
): k8s.helm.v3.Chart {
  const chartConfig = createTraefikChartConfig(namespace);
  const chartOptions = createTraefikChartOptions(parent, namespace);

  return new k8s.helm.v3.Chart(`${name}-chart`, chartConfig, chartOptions);
}

function createTraefikChartConfig(namespace: k8s.core.v1.Namespace) {
  return {
    chart: TRAEFIK_DEFAULTS.CHART_NAME,
    fetchOpts: { repo: TRAEFIK_DEFAULTS.CHART_REPO },
    version: TRAEFIK_DEFAULTS.CHART_VERSION,
    namespace: namespace.metadata.name,
    values: createTraefikValues(),
  };
}

function createTraefikChartOptions(parent: pulumi.Resource, namespace: k8s.core.v1.Namespace) {
  return { parent, dependsOn: [namespace] };
}

export function createTraefikDashboard(
  name: string,
  config: ITraefikBootstrapConfig,
  namespace: k8s.core.v1.Namespace,
  parent: pulumi.Resource,
): k8s.networking.v1.Ingress | undefined {
  return createTraefikDashboardIngress(name, config, namespace, parent);
}
