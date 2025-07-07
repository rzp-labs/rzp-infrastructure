import * as k8s from "@pulumi/kubernetes";
import * as pulumi from "@pulumi/pulumi";

import type { IArgoCdBootstrapConfig } from "../../shared/types";
import { createInternalTraefikIngressConfig, withDefault } from "../../shared/utils";

/**
 * Simplified ArgoCD Bootstrap Component
 *
 * Deploys ArgoCD directly without abstraction layers.
 * Creates only the essential resources: namespace, chart, ingress, and self-app.
 */
export class ArgoCdSimple extends pulumi.ComponentResource {
  public readonly namespace: k8s.core.v1.Namespace;
  public readonly chart: k8s.helm.v3.Chart;
  public readonly ingress: k8s.networking.v1.Ingress;
  public readonly selfApp: k8s.apiextensions.CustomResource;

  constructor(name: string, config: IArgoCdBootstrapConfig, opts?: pulumi.ComponentResourceOptions) {
    super("rzp-infra:argocd:Simple", name, {}, opts);

    // Create namespace directly
    this.namespace = new k8s.core.v1.Namespace(
      `${name}-namespace`,
      {
        metadata: {
          name: "argocd",
          labels: {
            "app.kubernetes.io/name": "argocd",
            "app.kubernetes.io/managed-by": "pulumi",
          },
        },
      },
      { parent: this },
    );

    // Deploy ArgoCD chart directly
    this.chart = new k8s.helm.v3.Chart(
      `${name}-chart`,
      {
        chart: "argo-cd",
        fetchOpts: { repo: "https://argoproj.github.io/argo-helm" },
        version: "5.51.6",
        namespace: this.namespace.metadata.name,
        values: {
          installCRDs: true,
          global: {
            domain: withDefault(config.domain, "argocd.local"),
          },
          server: {
            service: { type: "ClusterIP" },
            ingress: { enabled: false },
            config: {
              repositories: {
                "rzp-infrastructure": {
                  url: "https://github.com/rzp-labs/rzp-infrastructure.git",
                  name: "rzp-infrastructure",
                  type: "git",
                },
              },
            },
            extraArgs: ["--insecure"],
          },
          configs: {
            secret: { createSecret: true },
            params: {
              "server.insecure": "true",
            },
          },
          dex: { enabled: false },
        },
      },
      { parent: this, dependsOn: [this.namespace] },
    );

    // Create ingress directly
    this.ingress = new k8s.networking.v1.Ingress(
      `${name}-ingress`,
      {
        metadata: {
          name: "argocd-server-ingress",
          namespace: this.namespace.metadata.name,
          annotations: {
            ...createInternalTraefikIngressConfig().annotations,
          },
        },
        spec: this.createIngressSpec(config),
      },
      { parent: this, dependsOn: [this.chart] },
    );

    // Create self-management app directly
    this.selfApp = new k8s.apiextensions.CustomResource(
      `${name}-self-app`,
      {
        apiVersion: "argoproj.io/v1alpha1",
        kind: "Application",
        metadata: {
          name: "argocd-bootstrap",
          namespace: this.namespace.metadata.name,
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
            namespace: this.namespace.metadata.name,
          },
          syncPolicy: {
            automated: { prune: true, selfHeal: true },
            syncOptions: ["CreateNamespace=true"],
          },
        },
      },
      { parent: this, dependsOn: [this.chart] },
    );

    this.registerOutputs({
      namespace: this.namespace,
      chart: this.chart,
      ingress: this.ingress,
      selfApp: this.selfApp,
    });
  }

  private createIngressSpec(config: IArgoCdBootstrapConfig) {
    const domain = withDefault(config.domain, "argocd.local");

    return {
      ...createInternalTraefikIngressConfig(),
      rules: [
        {
          host: domain,
          http: {
            paths: [
              {
                path: "/",
                pathType: "Prefix",
                backend: {
                  service: {
                    name: "stg-argocd-chart-server",
                    port: { number: 80 },
                  },
                },
              },
            ],
          },
        },
      ],
      tls: [{ hosts: [domain], secretName: "argocd-server-tls" }],
    };
  }
}
