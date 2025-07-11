import * as k8s from "@pulumi/kubernetes";
import * as pulumi from "@pulumi/pulumi";

/**
 * cert-manager Bootstrap Component
 *
 * Deploys cert-manager for automatic TLS certificate provisioning
 * using Let's Encrypt with DNS challenges via Cloudflare.
 *
 * Clean implementation without config sprawl - follows current component patterns.
 */

export interface ICertManagerBootstrapConfig {
  readonly cloudflareApiToken: pulumi.Input<string>;
  readonly email: string;
  readonly environment: "dev" | "stg" | "prd";
}

export class CertManagerBootstrap extends pulumi.ComponentResource {
  public readonly namespace: k8s.core.v1.Namespace;
  public readonly chart: k8s.helm.v3.Chart;
  public readonly cloudflareSecret: k8s.core.v1.Secret;
  public readonly clusterIssuer: k8s.apiextensions.CustomResource;

  constructor(name: string, config: ICertManagerBootstrapConfig, opts?: pulumi.ComponentResourceOptions) {
    super("rzp-infra:cert-manager:Bootstrap", name, {}, opts);

    // Create namespace directly
    this.namespace = new k8s.core.v1.Namespace(
      `${name}-namespace`,
      {
        metadata: {
          name: "cert-manager",
          labels: {
            "app.kubernetes.io/name": "cert-manager",
            "app.kubernetes.io/managed-by": "pulumi",
            "app.kubernetes.io/component": "certificate-management",
            "cert-manager.io/disable-validation": "true",
          },
        },
      },
      { parent: this },
    );

    // Deploy cert-manager chart directly with inline values
    this.chart = new k8s.helm.v3.Chart(
      `${name}-chart`,
      {
        chart: "cert-manager",
        fetchOpts: { repo: "https://charts.jetstack.io" },
        version: "v1.16.1",
        namespace: this.namespace.metadata.name,
        values: {
          // Install CRDs
          installCRDs: true,
          // Global configuration
          global: {
            logLevel: 2,
            leaderElection: {
              namespace: "cert-manager",
            },
          },
          // Resource limits for main controller
          resources: {
            requests: {
              cpu: "100m",
              memory: "128Mi",
            },
            limits: {
              cpu: "200m",
              memory: "256Mi",
            },
          },
          // Webhook resource limits
          webhook: {
            resources: {
              requests: {
                cpu: "50m",
                memory: "64Mi",
              },
              limits: {
                cpu: "100m",
                memory: "128Mi",
              },
            },
          },
          // CA Injector resource limits
          cainjector: {
            resources: {
              requests: {
                cpu: "50m",
                memory: "64Mi",
              },
              limits: {
                cpu: "100m",
                memory: "128Mi",
              },
            },
          },
        },
      },
      { parent: this, dependsOn: [this.namespace] },
    );

    // Create Cloudflare API token secret
    this.cloudflareSecret = new k8s.core.v1.Secret(
      `${name}-cloudflare-secret`,
      {
        metadata: {
          name: "cloudflare-api-token-secret",
          namespace: this.namespace.metadata.name,
          labels: {
            "app.kubernetes.io/name": "cert-manager",
            "app.kubernetes.io/managed-by": "pulumi",
            "app.kubernetes.io/component": "cloudflare-secret",
          },
        },
        type: "Opaque",
        stringData: {
          "api-token": config.cloudflareApiToken,
        },
      },
      { parent: this, dependsOn: [this.chart] },
    );

    // Create Let's Encrypt cluster issuer
    this.clusterIssuer = new k8s.apiextensions.CustomResource(
      `${name}-letsencrypt-issuer`,
      {
        apiVersion: "cert-manager.io/v1",
        kind: "ClusterIssuer",
        metadata: {
          name: `letsencrypt-${config.environment}`,
          labels: {
            "app.kubernetes.io/name": "cert-manager",
            "app.kubernetes.io/managed-by": "pulumi",
            "app.kubernetes.io/component": "cluster-issuer",
          },
        },
        spec: {
          acme: {
            server:
              config.environment === "prd"
                ? "https://acme-v02.api.letsencrypt.org/directory"
                : "https://acme-staging-v02.api.letsencrypt.org/directory",
            email: config.email,
            privateKeySecretRef: {
              name: `letsencrypt-${config.environment}-private-key`,
            },
            solvers: [
              {
                dns01: {
                  cloudflare: {
                    apiTokenSecretRef: {
                      name: this.cloudflareSecret.metadata.name,
                      key: "api-token",
                    },
                  },
                },
              },
            ],
          },
        },
      },
      { parent: this, dependsOn: [this.cloudflareSecret] },
    );

    this.registerOutputs({
      namespace: this.namespace,
      chart: this.chart,
      cloudflareSecret: this.cloudflareSecret,
      clusterIssuer: this.clusterIssuer,
    });
  }
}
