import * as pulumi from "@pulumi/pulumi";
import * as argocd from "@three14/pulumi-argocd";

/**
 * Traefik Application using ArgoCD Provider
 *
 * Creates a Traefik ArgoCD Application using the Pulumi ArgoCD provider.
 * This assumes ArgoCD is already deployed and the provider is configured.
 * Provides type-safe Traefik application configuration.
 */

export interface ITraefikArgoCdConfig {
  readonly targetRevision: string;
  readonly namespace: string;
  readonly argoCdProvider: argocd.Provider;
}

export class TraefikArgoCdApp extends pulumi.ComponentResource {
  public readonly application: argocd.Application;

  constructor(name: string, config: ITraefikArgoCdConfig, opts?: pulumi.ComponentResourceOptions) {
    super("rzp-infra:traefik:ArgoCdApp", name, {}, opts);

    // Create Traefik Application using ArgoCD provider
    this.application = new argocd.Application(
      `${name}-traefik-app`,
      {
        metadata: {
          name: "traefik",
          namespace: "argocd",
        },
        spec: {
          project: "default",
          sources: [
            {
              repoUrl: "https://traefik.github.io/charts",
              chart: "traefik",
              targetRevision: config.targetRevision,
              helm: {
                values: JSON.stringify({
                  service: { type: "LoadBalancer" },
                  ports: {
                    web: { redirectTo: "websecure" },
                    websecure: { tls: { enabled: true } },
                  },
                  additionalArguments: ["--api.dashboard=true"],
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
