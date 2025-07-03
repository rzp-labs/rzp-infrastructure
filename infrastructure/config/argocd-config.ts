import type * as pulumi from "@pulumi/pulumi";

import { ARGOCD_DEFAULTS } from "../shared/constants";
import type { IArgoCdBootstrapConfig, IArgoCdChartValues } from "../shared/types";
import { withDefault } from "../shared/utils";

export function createArgoCdChartValues(config: IArgoCdBootstrapConfig): IArgoCdChartValues {
  return {
    global: { domain: withDefault(config.domain, ARGOCD_DEFAULTS.DEFAULT_DOMAIN) },
    server: {
      service: { type: ARGOCD_DEFAULTS.SERVICE_TYPE },
      ingress: { enabled: false },
      config: {
        repositories: {
          "rzp-infra": {
            url: config.repositoryUrl,
            name: "rzp-infra",
            type: "git",
          },
        },
      },
    },
    configs: { secret: { createSecret: false } },
  };
}

export function createArgoCdIngressAnnotations() {
  return {
    "kubernetes.io/ingress.class": "traefik",
    "traefik.ingress.kubernetes.io/router.tls": "true",
    "traefik.ingress.kubernetes.io/router.entrypoints": "websecure",
  };
}

export function createArgoCdIngressSpec(domain: string) {
  return {
    rules: [
      {
        host: domain,
        http: {
          paths: [
            {
              path: "/",
              pathType: "Prefix",
              backend: { service: { name: "argocd-server", port: { number: 80 } } },
            },
          ],
        },
      },
    ],
    tls: [{ hosts: [domain], secretName: "argocd-server-tls" }],
  };
}

export function createArgoCdApplicationSpec(config: IArgoCdBootstrapConfig, namespace: string | pulumi.Output<string>) {
  return {
    project: "default",
    source: {
      repoURL: config.repositoryUrl,
      targetRevision: "HEAD",
      path: "bootstrap/argocd",
    },
    destination: {
      server: "https://kubernetes.default.svc",
      namespace,
    },
    syncPolicy: {
      automated: { prune: true, selfHeal: true },
      syncOptions: ["CreateNamespace=true"],
    },
  };
}
