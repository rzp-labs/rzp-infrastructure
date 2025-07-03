import * as k8s from "@pulumi/kubernetes";
import * as pulumi from "@pulumi/pulumi";

import { CERT_MANAGER_DEFAULTS } from "../../shared/constants";
import type { ICertManagerBootstrapConfig } from "../../shared/types";

export function createCertManagerNamespace(
  name: string,
  provider: k8s.Provider,
  parent: pulumi.Resource,
): k8s.core.v1.Namespace {
  return new k8s.core.v1.Namespace(
    `${name}-namespace`,
    {
      metadata: {
        name: CERT_MANAGER_DEFAULTS.NAMESPACE,
        labels: {
          "app.kubernetes.io/name": "cert-manager",
          "app.kubernetes.io/managed-by": "pulumi",
        },
      },
    },
    { provider, parent },
  );
}

export function createCertManagerChart(
  name: string,
  namespace: k8s.core.v1.Namespace,
  provider: k8s.Provider,
  parent: pulumi.Resource,
): k8s.helm.v3.Chart {
  const chartConfig = createCertManagerChartConfig(namespace);
  const chartOptions = createCertManagerChartOptions(provider, parent, namespace);

  return new k8s.helm.v3.Chart(`${name}-chart`, chartConfig, chartOptions);
}

function createCertManagerChartConfig(namespace: k8s.core.v1.Namespace) {
  return {
    chart: CERT_MANAGER_DEFAULTS.CHART_NAME,
    fetchOpts: {
      repo: CERT_MANAGER_DEFAULTS.CHART_REPO,
    },
    version: CERT_MANAGER_DEFAULTS.CHART_VERSION,
    namespace: namespace.metadata.name,
    values: createCertManagerChartValues(),
  };
}

function createCertManagerChartValues() {
  return {
    installCRDs: true,
    global: { rbac: { create: true } },
  };
}

function createCertManagerChartOptions(
  provider: k8s.Provider,
  parent: pulumi.Resource,
  namespace: k8s.core.v1.Namespace,
) {
  return { provider, parent, dependsOn: [namespace] };
}

export function createCertManagerSecret(
  name: string,
  config: ICertManagerBootstrapConfig,
  namespace: k8s.core.v1.Namespace,
  provider: k8s.Provider,
  parent: pulumi.Resource,
): k8s.core.v1.Secret {
  const secretConfig = createCertManagerSecretConfig(config, namespace);
  const secretOptions = createCertManagerSecretOptions(provider, parent, namespace);

  return new k8s.core.v1.Secret(`${name}-cloudflare-secret`, secretConfig, secretOptions);
}

function createCertManagerSecretConfig(config: ICertManagerBootstrapConfig, namespace: k8s.core.v1.Namespace) {
  return {
    metadata: {
      name: "cloudflare-api-token",
      namespace: namespace.metadata.name,
    },
    type: "Opaque",
    data: {
      "api-token": pulumi
        .output(config.cloudflareApiToken)
        .apply((token: string) => Buffer.from(token).toString("base64")),
    },
  };
}

function createCertManagerSecretOptions(
  provider: k8s.Provider,
  parent: pulumi.Resource,
  namespace: k8s.core.v1.Namespace,
) {
  return { provider, parent, dependsOn: [namespace] };
}

export function createCertManagerClusterIssuer(
  name: string,
  config: ICertManagerBootstrapConfig,
  provider: k8s.Provider,
  parent: pulumi.Resource,
): k8s.apiextensions.CustomResource {
  const issuerConfig = createClusterIssuerConfig(config);
  const resourceOptions = createClusterIssuerOptions(provider, parent);

  return new k8s.apiextensions.CustomResource(`${name}-cluster-issuer`, issuerConfig, resourceOptions);
}

function createClusterIssuerConfig(config: ICertManagerBootstrapConfig) {
  const { issuerName, serverUrl } = getIssuerConfiguration(config);

  return {
    apiVersion: "cert-manager.io/v1",
    kind: "ClusterIssuer",
    metadata: {
      name: issuerName,
    },
    spec: createClusterIssuerSpec(config, issuerName, serverUrl),
  };
}

function getIssuerConfiguration(config: ICertManagerBootstrapConfig) {
  const issuerName = config.staging ? "letsencrypt-staging" : "letsencrypt-prod";
  const serverUrl = config.staging
    ? "https://acme-staging-v02.api.letsencrypt.org/directory"
    : "https://acme-v02.api.letsencrypt.org/directory";

  return { issuerName, serverUrl };
}

function createClusterIssuerSpec(config: ICertManagerBootstrapConfig, issuerName: string, serverUrl: string) {
  return {
    acme: {
      server: serverUrl,
      email: config.email,
      privateKeySecretRef: { name: `${issuerName}-private-key` },
      solvers: [{ dns01: { cloudflare: { apiTokenSecretRef: { name: "cloudflare-api-token", key: "api-token" } } } }],
    },
  };
}

function createClusterIssuerOptions(provider: k8s.Provider, parent: pulumi.Resource) {
  return { provider, parent };
}
