import * as pulumi from "@pulumi/pulumi";
import * as argocd from "@three14/pulumi-argocd";

/**
 * MetalLB Application using ArgoCD Provider
 *
 * Creates a MetalLB ArgoCD Application using the Pulumi ArgoCD provider.
 * This assumes ArgoCD is already deployed and the provider is configured.
 * Provides type-safe MetalLB application configuration.
 */

export interface IMetalLBArgoCdConfig {
  readonly targetRevision: string;
  readonly namespace: string;
  readonly argoCdProvider: argocd.Provider;
}

export class MetalLBArgoCdApp extends pulumi.ComponentResource {
  public readonly application: argocd.Application;

  constructor(name: string, config: IMetalLBArgoCdConfig, opts?: pulumi.ComponentResourceOptions) {
    super("rzp-infra:metallb:ArgoCdApp", name, {}, opts);

    // Create MetalLB Application using ArgoCD provider
    this.application = new argocd.Application(
      `${name}-metallb-app`,
      {
        metadata: {
          name: "metallb",
          namespace: "argocd",
        },
        spec: {
          project: "default",
          sources: [
            {
              repoUrl: "https://metallb.github.io/metallb",
              chart: "metallb",
              targetRevision: config.targetRevision,
              helm: {
                values: JSON.stringify({
                  controller: { enabled: true },
                  speaker: { enabled: true },
                  webhook: { enabled: true },
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
