import * as k8s from "@pulumi/kubernetes";
import * as pulumi from "@pulumi/pulumi";
import * as argocd from "@three14/pulumi-argocd";

import type { IngressType } from "../../shared/types";

/**
 * Cert-Manager Application using ArgoCD Provider
 *
 * Creates a Cert-Manager ArgoCD Application using the Pulumi ArgoCD provider.
 * This assumes ArgoCD is already deployed and the provider is configured.
 * Provides type-safe Cert-Manager application configuration.
 */

export interface ICertManagerArgoCdConfig {
  readonly targetRevision: string;
  readonly namespace: string;
  readonly argoCdProvider: argocd.Provider;
  readonly kubernetesProvider?: k8s.Provider; // NEW: Optional Kubernetes provider for proper dependencies
  readonly email: string;
  readonly environment: "dev" | "stg" | "prd"; // Keep for ClusterIssuer naming
  readonly cloudflareApiToken: pulumi.Input<string>;
  readonly ingress: IngressType; // NEW: Required ingress declaration
}

export class CertManagerArgoCdApp extends pulumi.ComponentResource {
  public readonly application: argocd.Application;
  public readonly cloudflareSecret: k8s.core.v1.Secret;
  public readonly clusterIssuer: k8s.apiextensions.CustomResource;

  constructor(name: string, config: ICertManagerArgoCdConfig, opts?: pulumi.ComponentResourceOptions) {
    super("rzp-infra:cert-manager:ArgoCdApp", name, {}, opts);

    // Create Cloudflare API token secret
    this.cloudflareSecret = this.createCloudflareSecret(name, config);

    // Create Cert-Manager Application using ArgoCD provider
    this.application = new argocd.Application(
      `${name}-cert-manager-app`,
      {
        metadata: {
          name: "cert-manager",
          namespace: "argocd",
        },
        spec: {
          project: "default",
          sources: [
            {
              repoUrl: "https://charts.jetstack.io",
              chart: "cert-manager",
              targetRevision: config.targetRevision,
              helm: {
                values: JSON.stringify({
                  installCRDs: true,
                  global: {
                    rbac: {
                      create: true,
                    },
                    leaderElection: {
                      namespace: config.namespace,
                    },
                  },
                }),
              },
            },
          ],
          destination: {
            server: "https://kubernetes.default.svc",
            namespace: config.namespace,
          },
          syncPolicy: {
            automated: {
              prune: true,
              selfHeal: true,
            },
            syncOptions: ["CreateNamespace=true"],
          },
        },
      },
      {
        parent: this,
        provider: config.argoCdProvider,
      },
    );

    // Create ClusterIssuer after chart deployment
    this.clusterIssuer = this.createClusterIssuer(name, config);

    this.registerOutputs({
      application: this.application,
      cloudflareSecret: this.cloudflareSecret,
      clusterIssuer: this.clusterIssuer,
    });
  }

  private createCloudflareSecret(name: string, config: ICertManagerArgoCdConfig): k8s.core.v1.Secret {
    return new k8s.core.v1.Secret(
      `${name}-cloudflare-secret`,
      {
        metadata: {
          name: "cloudflare-api-token",
          namespace: config.namespace,
        },
        type: "Opaque",
        data: {
          "api-token": pulumi
            .output(config.cloudflareApiToken)
            .apply((token: string) => Buffer.from(token).toString("base64")),
        },
      },
      {
        parent: this,
        provider: config.kubernetesProvider,
        // Let ArgoCD create the namespace, then create the secret
      },
    );
  }

  private createClusterIssuer(name: string, config: ICertManagerArgoCdConfig): k8s.apiextensions.CustomResource {
    const issuerName = `${name}-letsencrypt-issuer`;
    const serverUrl =
      config.environment === "prd"
        ? "https://acme-v02.api.letsencrypt.org/directory"
        : "https://acme-staging-v02.api.letsencrypt.org/directory";

    return new k8s.apiextensions.CustomResource(
      issuerName,
      {
        apiVersion: "cert-manager.io/v1",
        kind: "ClusterIssuer",
        metadata: { name: issuerName },
        spec: {
          acme: {
            server: serverUrl,
            email: config.email,
            privateKeySecretRef: { name: `${issuerName}-private-key` },
            solvers: [
              {
                dns01: {
                  cloudflare: {
                    apiTokenSecretRef: {
                      name: "cloudflare-api-token",
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
        provider: config.kubernetesProvider,
        dependsOn: [this.application],
      },
    );
  }
}
