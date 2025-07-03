import * as k8s from "@pulumi/kubernetes";
import * as pulumi from "@pulumi/pulumi";

import {
  createArgoCdApplicationSpec,
  createArgoCdChartValues,
  createArgoCdIngressAnnotations,
  createArgoCdIngressSpec,
} from "../../config/argocd-config";
import { ARGOCD_DEFAULTS } from "../../shared/constants";
import type { IArgoCdBootstrapConfig } from "../../shared/types";
import { withDefault } from "../../shared/utils";

export function createArgoCdNamespace(
  name: string,
  provider: k8s.Provider,
  parent: pulumi.Resource,
): k8s.core.v1.Namespace {
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
    { provider, parent },
  );
}

function resolveAdminPassword(config: IArgoCdBootstrapConfig): pulumi.Output<string> {
  const cfg = new pulumi.Config();
  return config.adminPassword ?? cfg.getSecret("argoCdAdminPassword") ?? pulumi.secret("argocd-admin-fallback");
}

function createAdminSecretMetadata(namespace: pulumi.Output<string>) {
  return {
    name: "argocd-initial-admin-secret",
    namespace,
    labels: {
      "app.kubernetes.io/name": "argocd-initial-admin-secret",
      "app.kubernetes.io/part-of": "argocd",
    },
  };
}

export function createArgoCdAdminSecret(
  name: string,
  config: IArgoCdBootstrapConfig,
  namespace: k8s.core.v1.Namespace,
  provider: k8s.Provider,
  parent: pulumi.Resource,
): k8s.core.v1.Secret {
  const adminPassword = resolveAdminPassword(config);

  return new k8s.core.v1.Secret(
    `${name}-admin-secret`,
    {
      metadata: createAdminSecretMetadata(namespace.metadata.name),
      type: "Opaque",
      data: {
        password: pulumi.output(adminPassword).apply((pwd: string) => Buffer.from(pwd).toString("base64")),
      },
    },
    { provider, parent },
  );
}

export function createArgoCdChart(
  name: string,
  config: IArgoCdBootstrapConfig,
  namespace: k8s.core.v1.Namespace,
  provider: k8s.Provider,
  parent: pulumi.Resource,
): k8s.helm.v3.Chart {
  const chartConfig = createArgoCdChartConfig(config, namespace);
  const chartOptions = createArgoCdChartOptions(provider, parent);

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

function createArgoCdChartOptions(provider: k8s.Provider, parent: pulumi.Resource) {
  return { provider, parent };
}

function createIngressMetadata(namespace: pulumi.Output<string>) {
  return {
    name: "argocd-server-ingress",
    namespace,
    annotations: createArgoCdIngressAnnotations(),
  };
}

export function createArgoCdIngress(
  name: string,
  config: IArgoCdBootstrapConfig,
  namespace: k8s.core.v1.Namespace,
  provider: k8s.Provider,
  parent: pulumi.Resource,
): k8s.networking.v1.Ingress {
  const domain = withDefault(config.domain, ARGOCD_DEFAULTS.DEFAULT_DOMAIN);

  return new k8s.networking.v1.Ingress(
    `${name}-ingress`,
    {
      metadata: createIngressMetadata(namespace.metadata.name),
      spec: createArgoCdIngressSpec(domain),
    },
    { provider, parent },
  );
}

function createApplicationMetadata(namespace: pulumi.Output<string>) {
  return {
    name: "argocd-bootstrap",
    namespace,
  };
}

export function createArgoCdSelfApp(
  name: string,
  config: IArgoCdBootstrapConfig,
  namespace: k8s.core.v1.Namespace,
  provider: k8s.Provider,
  parent: pulumi.Resource,
): k8s.apiextensions.CustomResource {
  return new k8s.apiextensions.CustomResource(
    `${name}-self-app`,
    {
      apiVersion: "argoproj.io/v1alpha1",
      kind: "Application",
      metadata: createApplicationMetadata(namespace.metadata.name),
      spec: createArgoCdApplicationSpec(config, namespace.metadata.name),
    },
    { provider, parent },
  );
}
