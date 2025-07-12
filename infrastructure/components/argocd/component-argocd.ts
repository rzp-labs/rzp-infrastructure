import * as k8s from "@pulumi/kubernetes";
import * as pulumi from "@pulumi/pulumi";

/**
 * ArgoCD Component
 *
 * Opinionated ArgoCD component for homelab GitOps deployment.
 * Provides secure ArgoCD setup with Traefik ingress and repository configuration.
 */

export interface IArgoCdArgs {
  readonly namespace: string;
  readonly chartVersion: string;
  readonly environment: "dev" | "stg" | "prd";
  readonly domain: string;
}

export class ArgoCdComponent extends pulumi.ComponentResource {
  public readonly namespace: k8s.core.v1.Namespace;
  public readonly chart: k8s.helm.v3.Chart;
  public readonly ingress: k8s.networking.v1.Ingress;

  constructor(name: string, args: IArgoCdArgs, opts?: pulumi.ComponentResourceOptions) {
    super("rzp-infra:argocd:Component", name, {}, opts);

    // Create namespace
    this.namespace = new k8s.core.v1.Namespace(
      `${args.namespace}`,
      {
        metadata: {
          name: args.namespace,
          labels: {
            "app.kubernetes.io/name": "argocd",
            "app.kubernetes.io/managed-by": "pulumi",
            "app.kubernetes.io/component": "gitops",
          },
        },
      },
      { parent: this },
    );

    // Deploy ArgoCD with opinionated homelab configuration
    this.chart = new k8s.helm.v3.Chart(
      name,
      {
        chart: "argo-cd",
        fetchOpts: { repo: "https://argoproj.github.io/argo-helm" },
        version: args.chartVersion,
        namespace: this.namespace.metadata.name,
        values: {
          // Always install CRDs
          installCRDs: true,
          // Global configuration
          global: {
            domain: args.domain,
          },
          // Server configuration - insecure mode for Traefik TLS termination
          server: {
            service: { type: "ClusterIP" },
            ingress: { enabled: false }, // We create our own
            extraArgs: ["--insecure"], // Required for gRPC behind proxy
            // Traefik handles TLS termination for web UI, but API needs internal TLS
            config: {
              // Pre-configure infrastructure repository as YAML string
              repositories: `- url: https://github.com/rzp-labs/rzp-infrastructure.git
  name: rzp-infrastructure
  type: git`,
            },
            // Production-ready resource limits
            resources: {
              requests: { cpu: "200m", memory: "256Mi" },
              limits: { cpu: "500m", memory: "512Mi" },
            },
          },
          // Controller configuration
          controller: {
            resources: {
              requests: { cpu: "200m", memory: "256Mi" },
              limits: { cpu: "500m", memory: "512Mi" },
            },
          },
          // Application Set Controller
          applicationSet: {
            resources: {
              requests: { cpu: "100m", memory: "128Mi" },
              limits: { cpu: "200m", memory: "256Mi" },
            },
          },
          // Redis configuration
          redis: {
            resources: {
              requests: { cpu: "100m", memory: "64Mi" },
              limits: { cpu: "200m", memory: "128Mi" },
            },
          },
          // Configuration
          configs: {
            secret: { createSecret: true },
            params: {
              "server.insecure": "true", // TLS terminated at Traefik
            },
          },
          // Disable Dex for simple setup
          dex: { enabled: false },
        },
      },
      { parent: this, dependsOn: [this.namespace], replaceOnChanges: ["*"] },
    );

    // Create Traefik ingress for ArgoCD
    this.ingress = new k8s.networking.v1.Ingress(
      `${name}-ingress`,
      {
        metadata: {
          name: "argocd-server-ingress",
          namespace: this.namespace.metadata.name,
          annotations: {
            "kubernetes.io/ingress.class": "traefik",
            "traefik.ingress.kubernetes.io/router.entrypoints": "websecure",
            "traefik.ingress.kubernetes.io/router.tls": "true",
            "cert-manager.io/cluster-issuer": `letsencrypt-${args.environment}`,
          },
        },
        spec: {
          rules: [
            {
              host: args.domain,
              http: {
                paths: [
                  {
                    path: "/",
                    pathType: "Prefix",
                    backend: {
                      service: {
                        name: `${name}-server`,
                        port: { number: 80 },
                      },
                    },
                  },
                ],
              },
            },
          ],
          tls: [
            {
              hosts: [args.domain],
              secretName: "argocd-server-tls",
            },
          ],
        },
      },
      { parent: this, dependsOn: [this.chart] },
    );

    // Register outputs
    this.registerOutputs({
      namespace: this.namespace,
      chart: this.chart,
      ingress: this.ingress,
    });
  }
}
