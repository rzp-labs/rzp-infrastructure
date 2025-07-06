import * as k8s from "@pulumi/kubernetes";
import * as pulumi from "@pulumi/pulumi";

import { TRAEFIK_DEFAULTS } from "../../shared/constants";
import type { ITraefikBootstrapConfig } from "../../shared/types";
import { isTruthy, withDefault } from "../../shared/utils";

export interface ITraefikDashboardArgs {
  readonly config: ITraefikBootstrapConfig;
  readonly namespace: k8s.core.v1.Namespace;
  readonly serviceName: string;
  readonly chart: k8s.helm.v3.Chart;
}

/**
 * Traefik Dashboard Component
 *
 * Creates an ingress for the Traefik dashboard if configured.
 * Handles SSL certificates and routing configuration.
 */
export class TraefikDashboard extends pulumi.ComponentResource {
  public readonly ingress: k8s.networking.v1.Ingress | undefined;

  constructor(name: string, args: ITraefikDashboardArgs, opts?: pulumi.ComponentResourceOptions) {
    super("rzp:traefik:TraefikDashboard", name, {}, opts);

    // Only create ingress if dashboard is enabled and domain is configured
    if (this.shouldCreateDashboard(args.config)) {
      this.ingress = this.createDashboardIngress(name, args);
    }

    this.registerOutputs({
      ingress: this.ingress,
    });
  }

  private shouldCreateDashboard(config: ITraefikBootstrapConfig): boolean {
    const hasDomain = isTruthy(config.domain);
    const isDashboardEnabled = withDefault(config.dashboard, false);
    return hasDomain && isDashboardEnabled;
  }

  private createDashboardIngress(name: string, args: ITraefikDashboardArgs): k8s.networking.v1.Ingress {
    const ingressConfig = {
      metadata: this.createIngressMetadata(args.config, args.namespace),
      spec: {
        ingressClassName: "stg-traefik-chart",
        ...this.createIngressSpec(args),
      },
    };

    const resourceOptions = {
      parent: this,
      dependsOn: [args.chart],
      customTimeouts: { create: "10m", update: "5m", delete: "5m" },
    };

    return new k8s.networking.v1.Ingress(`${name}-dashboard`, ingressConfig, resourceOptions);
  }

  private createIngressMetadata(config: ITraefikBootstrapConfig, namespace: k8s.core.v1.Namespace) {
    return {
      name: "traefik-dashboard",
      namespace: namespace.metadata.name,
      annotations: this.createIngressAnnotations(config),
    };
  }

  private createIngressAnnotations(config: ITraefikBootstrapConfig) {
    const baseAnnotations = {
      "traefik.ingress.kubernetes.io/router.tls": "true",
      "traefik.ingress.kubernetes.io/router.entrypoints": "websecure",
    };

    if (isTruthy(config.email)) {
      const issuer = config.environment === "prd" ? "letsencrypt-prod" : "letsencrypt-staging";
      return { ...baseAnnotations, "cert-manager.io/cluster-issuer": issuer };
    }

    return baseAnnotations;
  }

  private createIngressSpec(args: ITraefikDashboardArgs) {
    const host = `stg.traefik.${args.config.domain ?? ""}`;
    return {
      rules: [
        {
          host,
          http: {
            paths: [
              {
                path: "/",
                pathType: "Prefix",
                backend: { service: { name: args.serviceName, port: { number: TRAEFIK_DEFAULTS.DASHBOARD_PORT } } },
              },
            ],
          },
        },
      ],
      tls: [{ hosts: [host], secretName: "traefik-dashboard-tls" }],
    };
  }
}
