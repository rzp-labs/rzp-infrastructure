import * as k8s from "@pulumi/kubernetes";
import * as pulumi from "@pulumi/pulumi";

import { createWebhookReadinessJob } from "../../helpers/k8s/webhook-readiness";

/**
 * cert-manager Component
 *
 * Opinionated cert-manager component for homelab TLS certificate management.
 * Provides automatic Let's Encrypt certificates via Cloudflare DNS challenges.
 */

export interface ICertManagerArgs {
  readonly namespace: string;
  readonly chartVersion: string;
  readonly environment: "dev" | "stg" | "prd";
  readonly cloudflareApiToken: pulumi.Input<string>;
  readonly email: string;
}

export class CertManagerComponent extends pulumi.ComponentResource {
  public readonly namespace: k8s.core.v1.Namespace;
  public readonly chart: k8s.helm.v3.Chart;
  public readonly cloudflareSecret: k8s.core.v1.Secret;
  public readonly clusterIssuer: k8s.apiextensions.CustomResource;
  public readonly helmValuesOutput: pulumi.Output<string>;

  constructor(name: string, args: ICertManagerArgs, opts?: pulumi.ComponentResourceOptions) {
    super("rzp-infra:cert-manager:Component", name, {}, opts);

    // Create namespace with cert-manager labels
    this.namespace = new k8s.core.v1.Namespace(
      `${name}-namespace`,
      {
        metadata: {
          name: args.namespace,
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

    // Build opinionated Helm values
    const helmValues = {
      // Always install CRDs
      installCRDs: true,
      // Global configuration
      global: {
        logLevel: 2,
        leaderElection: {
          namespace: args.namespace,
        },
      },
      // Startup API check configuration
      startupapicheck: {
        enabled: false, // Disable for faster deployment, or increase timeout
        timeout: "5m", // Increase timeout if enabled
      },
      // Controller resources - production ready
      resources: {
        requests: { cpu: "100m", memory: "128Mi" },
        limits: { cpu: "200m", memory: "256Mi" },
      },
      // Webhook resources
      webhook: {
        resources: {
          requests: { cpu: "50m", memory: "64Mi" },
          limits: { cpu: "100m", memory: "128Mi" },
        },
      },
      // CA Injector resources
      cainjector: {
        resources: {
          requests: { cpu: "50m", memory: "64Mi" },
          limits: { cpu: "100m", memory: "128Mi" },
        },
      },
    };

    // Expose helm values as output for ArgoCD applications
    this.helmValuesOutput = pulumi.output(JSON.stringify(helmValues));

    // Deploy cert-manager with opinionated homelab configuration
    this.chart = new k8s.helm.v3.Chart(
      `${name}-chart`,
      {
        chart: "cert-manager",
        fetchOpts: { repo: "https://charts.jetstack.io" },
        version: args.chartVersion,
        namespace: this.namespace.metadata.name,
        values: helmValues,
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
          "api-token": args.cloudflareApiToken,
        },
      },
      { parent: this, dependsOn: [this.chart] },
    );

    // Create the ClusterIssuer with a delay to allow webhook to be ready
    // Wait for cert-manager webhook deployment to be available before creating ClusterIssuer
    const webhookReadiness = createWebhookReadinessJob(
      {
        componentName: name,
        namespace: args.namespace,
        deploymentName: `${name}-chart-webhook`,
        timeoutSeconds: 300,
      },
      { parent: this, dependsOn: [this.chart] },
    );

    // Create Let's Encrypt cluster issuer with environment-specific server
    this.clusterIssuer = new k8s.apiextensions.CustomResource(
      `${name}-letsencrypt-issuer`,
      {
        apiVersion: "cert-manager.io/v1",
        kind: "ClusterIssuer",
        metadata: {
          name: `letsencrypt-${args.environment}`,
          labels: {
            "app.kubernetes.io/name": "cert-manager",
            "app.kubernetes.io/managed-by": "pulumi",
            "app.kubernetes.io/component": "cluster-issuer",
          },
        },
        spec: {
          acme: {
            server:
              args.environment === "prd"
                ? "https://acme-v02.api.letsencrypt.org/directory"
                : "https://acme-staging-v02.api.letsencrypt.org/directory",
            email: args.email,
            privateKeySecretRef: {
              name: `letsencrypt-${args.environment}-private-key`,
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
      {
        parent: this,
        dependsOn: [this.cloudflareSecret, webhookReadiness],
      },
    );

    // Register outputs
    this.registerOutputs({
      namespace: this.namespace,
      chart: this.chart,
      cloudflareSecret: this.cloudflareSecret,
      clusterIssuer: this.clusterIssuer,
      helmValuesOutput: this.helmValuesOutput,
    });
  }
}
