import * as k8s from "@pulumi/kubernetes";
import * as pulumi from "@pulumi/pulumi";

import type { IArgoCdBootstrapConfig } from "../../shared/types";
import { createTraefikIngressConfig, withDefault } from "../../shared/utils";

/**
 * ArgoCD Bootstrap Component
 *
 * Deploys ArgoCD directly without abstraction layers.
 * Creates only the essential resources: namespace, chart, and ingress.
 */
export class ArgoCdBootstrap extends pulumi.ComponentResource {
  public readonly namespace: k8s.core.v1.Namespace;
  public readonly chart: k8s.helm.v3.Chart;
  public readonly ingress?: k8s.networking.v1.Ingress;
  public readonly serverServiceName: string;

  constructor(name: string, config: IArgoCdBootstrapConfig, opts?: pulumi.ComponentResourceOptions) {
    super("rzp-infra:argocd:Bootstrap", name, {}, opts);

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

    // Create ingress only if requested (requires ingress controller)
    if (config.createIngress !== false) {
      this.ingress = new k8s.networking.v1.Ingress(
        `${name}-ingress`,
        {
          metadata: {
            name: "argocd-server-ingress",
            namespace: this.namespace.metadata.name,
            annotations: {
              ...createTraefikIngressConfig("stg", true, false).annotations,
            },
          },
          spec: this.createIngressSpec(config),
        },
        { parent: this, dependsOn: [this.chart] },
      );
    }

    // Set server service name based on chart release name
    this.serverServiceName = `${name}-chart-server`;

    this.registerOutputs({
      namespace: this.namespace,
      chart: this.chart,
      ingress: this.ingress,
      serverServiceName: this.serverServiceName,
    });
  }

  private createIngressSpec(config: IArgoCdBootstrapConfig) {
    const domain = withDefault(config.domain, "argocd.local");

    return {
      ...createTraefikIngressConfig("stg", true, false),
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
                    name: this.serverServiceName,
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
