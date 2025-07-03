import * as k8s from "@pulumi/kubernetes";
import type * as pulumi from "@pulumi/pulumi";

import { TRAEFIK_DEFAULTS } from "../../shared/constants";
import type { ITraefikBootstrapConfig } from "../../shared/types";
import { isTruthy, withDefault } from "../../shared/utils";

export function createTraefikDashboardIngress(
  name: string,
  config: ITraefikBootstrapConfig,
  namespace: k8s.core.v1.Namespace,
  parent: pulumi.Resource,
): k8s.networking.v1.Ingress | undefined {
  if (!shouldCreateDashboard(config)) {
    return undefined;
  }

  return new k8s.networking.v1.Ingress(
    `${name}-dashboard`,
    {
      metadata: createIngressMetadata(config, namespace),
      spec: createIngressSpec(config),
    },
    { parent },
  );
}

function shouldCreateDashboard(config: ITraefikBootstrapConfig): boolean {
  const hasDomain = isTruthy(config.domain);
  const isDashboardEnabled = withDefault(config.dashboard, false);
  return hasDomain && isDashboardEnabled;
}

function createIngressMetadata(config: ITraefikBootstrapConfig, namespace: k8s.core.v1.Namespace) {
  return {
    name: "traefik-dashboard",
    namespace: namespace.metadata.name,
    annotations: createIngressAnnotations(config),
  };
}

function createIngressAnnotations(config: ITraefikBootstrapConfig) {
  const baseAnnotations = {
    "kubernetes.io/ingress.class": "traefik",
    "traefik.ingress.kubernetes.io/router.tls": "true",
    "traefik.ingress.kubernetes.io/router.entrypoints": "websecure",
  };

  if (isTruthy(config.email)) {
    const isStaging = withDefault(config.staging, false);
    const issuer = isStaging ? "letsencrypt-staging" : "letsencrypt-prod";
    return { ...baseAnnotations, "cert-manager.io/cluster-issuer": issuer };
  }

  return baseAnnotations;
}

function createIngressSpec(config: ITraefikBootstrapConfig) {
  const host = `stg.traefik.${config.domain ?? ""}`;
  return {
    rules: [
      {
        host,
        http: {
          paths: [
            {
              path: "/",
              pathType: "Prefix",
              backend: { service: { name: "traefik", port: { number: TRAEFIK_DEFAULTS.DASHBOARD_PORT } } },
            },
          ],
        },
      },
    ],
    tls: [{ hosts: [host], secretName: "traefik-dashboard-tls" }],
  };
}
