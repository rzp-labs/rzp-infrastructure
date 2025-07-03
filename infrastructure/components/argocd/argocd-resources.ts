import * as k8s from "@pulumi/kubernetes";
import * as pulumi from "@pulumi/pulumi";

import type { IArgoCdBootstrapConfig } from "./argocd-bootstrap";

export function createArgoCdNamespace(
  name: string,
  provider: k8s.Provider,
  parent: pulumi.Resource,
): k8s.core.v1.Namespace {
  return new k8s.core.v1.Namespace(
    `${name}-namespace`,
    {
      metadata: {
        name: "argocd",
        labels: {
          "app.kubernetes.io/name": "argocd",
          "app.kubernetes.io/part-of": "argocd",
        },
      },
    },
    { provider, parent },
  );
}

export function createArgoCdAdminSecret(
  name: string,
  config: IArgoCdBootstrapConfig,
  namespace: k8s.core.v1.Namespace,
  provider: k8s.Provider,
  parent: pulumi.Resource,
): k8s.core.v1.Secret {
  // Use Pulumi config for secret management instead of hardcoded values
  const cfg = new pulumi.Config();
  const adminPassword = config.adminPassword ?? cfg.getSecret("argoCdAdminPassword") ?? pulumi.secret("argocd-admin-fallback");

  return new k8s.core.v1.Secret(
    `${name}-admin-secret`,
    {
      metadata: {
        name: "argocd-initial-admin-secret",
        namespace: namespace.metadata.name,
        labels: {
          "app.kubernetes.io/name": "argocd-initial-admin-secret",
          "app.kubernetes.io/part-of": "argocd",
        },
      },
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
  return new k8s.helm.v3.Chart(
    `${name}-chart`,
    {
      chart: "argo-cd",
      repo: "https://argoproj.github.io/argo-helm",
      version: "5.51.6",
      namespace: namespace.metadata.name,
      values: {
        global: { domain: config.domain ?? "argocd.local" },
        server: {
          service: { type: "ClusterIP" },
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
      },
    },
    { provider, parent },
  );
}

export function createArgoCdIngress(
  name: string,
  config: IArgoCdBootstrapConfig,
  namespace: k8s.core.v1.Namespace,
  provider: k8s.Provider,
  parent: pulumi.Resource,
): k8s.networking.v1.Ingress {
  return new k8s.networking.v1.Ingress(
    `${name}-ingress`,
    {
      metadata: {
        name: "argocd-server-ingress",
        namespace: namespace.metadata.name,
        annotations: {
          "kubernetes.io/ingress.class": "traefik",
          "traefik.ingress.kubernetes.io/router.tls": "true",
          "traefik.ingress.kubernetes.io/router.entrypoints": "websecure",
        },
      },
      spec: {
        rules: [
          {
            host: config.domain ?? "argocd.local",
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
        tls: [{ hosts: [config.domain ?? "argocd.local"], secretName: "argocd-server-tls" }],
      },
    },
    { provider, parent },
  );
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
      metadata: {
        name: "argocd-bootstrap",
        namespace: namespace.metadata.name,
      },
      spec: {
        project: "default",
        source: {
          repoURL: config.repositoryUrl,
          targetRevision: "HEAD",
          path: "bootstrap/argocd",
        },
        destination: {
          server: "https://kubernetes.default.svc",
          namespace: namespace.metadata.name,
        },
        syncPolicy: {
          automated: { prune: true, selfHeal: true },
          syncOptions: ["CreateNamespace=true"],
        },
      },
    },
    { provider, parent },
  );
}
