import * as pulumi from "@pulumi/pulumi";
import * as argocd from "@three14/pulumi-argocd";

import type { IngressType } from "../../shared/types";
import { createTraefikIngressConfig } from "../../shared/utils";

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
  readonly domain?: string;
  readonly email?: string;
  readonly environment: "dev" | "stg" | "prd"; // Keep for utility function
  readonly dashboard?: boolean;
  readonly ingress: IngressType; // NEW: Required ingress declaration
}

export class TraefikArgoCdApp extends pulumi.ComponentResource {
  public readonly application: argocd.Application;

  constructor(name: string, config: ITraefikArgoCdConfig, opts?: pulumi.ComponentResourceOptions) {
    super("rzp-infra:traefik:ArgoCdApp", name, {}, opts);

    // Only generate ingress config if ingress is not "none"
    const ingressConfig =
      config.ingress !== "none"
        ? createTraefikIngressConfig(config.environment, true, config.ingress === "internal")
        : null;

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
                  deployment: { replicas: 1 },
                  service: {
                    type: config.ingress === "external" ? "LoadBalancer" : "ClusterIP",
                    // Only add ingress annotations if ingress is not "none"
                    ...(ingressConfig && { annotations: ingressConfig.annotations }),
                  },
                  // Only configure ingress class if ingress is not "none"
                  ...(ingressConfig && {
                    ingressClass: {
                      enabled: true,
                      name: ingressConfig.ingressClassName,
                    },
                  }),
                  ports: {
                    web: {
                      port: 80,
                      expose: { default: false }, // Don't expose port 80 since ISP blocks it
                      protocol: "TCP",
                    },
                    websecure: {
                      port: 443,
                      expose: { default: true },
                      exposedPort: 8443,
                      protocol: "TCP",
                    },
                  },
                  ingressRoute: {
                    dashboard: {
                      enabled: config.dashboard ?? false,
                      annotations: { "kubernetes.io/ingress.class": "traefik" },
                    },
                  },
                  certificatesResolvers: {}, // cert-manager handles certificates
                  globalArguments: ["--global.checknewversion=false", "--global.sendanonymoususage=false"],
                  additionalArguments: [
                    "--log.level=INFO",
                    "--accesslog=true",
                    "--entrypoints.web.address=:80",
                    "--entrypoints.websecure.address=:443",
                  ],
                  providers: {
                    kubernetesIngress: {
                      enabled: true,
                      publishedService: {
                        enabled: true,
                        pathOverride: `${config.namespace}/traefik`,
                      },
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

    this.registerOutputs({
      application: this.application,
    });
  }
}
