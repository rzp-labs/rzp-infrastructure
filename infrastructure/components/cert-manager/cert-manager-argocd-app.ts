import * as pulumi from "@pulumi/pulumi";
import * as argocd from "@three14/pulumi-argocd";

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
}

export class CertManagerArgoCdApp extends pulumi.ComponentResource {
  public readonly application: argocd.Application;

  constructor(name: string, config: ICertManagerArgoCdConfig, opts?: pulumi.ComponentResourceOptions) {
    super("rzp-infra:cert-manager:ArgoCdApp", name, {}, opts);

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
  }
}
