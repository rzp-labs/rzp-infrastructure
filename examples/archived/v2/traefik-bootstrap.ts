import * as k8s from "@pulumi/kubernetes";
import * as pulumi from "@pulumi/pulumi";

/**
 * Traefik Bootstrap Component
 *
 * Deploys Traefik ingress controller via Helm for platform bootstrap.
 * This enables ArgoCD to be accessible via ingress while allowing
 * ArgoCD to manage Traefik configuration in GitOps mode later.
 *
 * Clean implementation without config sprawl - follows current component patterns.
 */

export interface ITraefikBootstrapConfig {
  readonly domain: string;
  readonly email: string;
  readonly environment: "dev" | "stg" | "prd";
  readonly dashboard?: boolean;
}

export class TraefikBootstrap extends pulumi.ComponentResource {
  public readonly namespace: k8s.core.v1.Namespace;
  public readonly chart: k8s.helm.v3.Chart;

  constructor(name: string, config: ITraefikBootstrapConfig, opts?: pulumi.ComponentResourceOptions) {
    super("rzp-infra:traefik:Bootstrap", name, {}, opts);

    // Create namespace directly
    this.namespace = new k8s.core.v1.Namespace(
      `${name}-namespace`,
      {
        metadata: {
          name: "traefik",
          labels: {
            "app.kubernetes.io/name": "traefik",
            "app.kubernetes.io/managed-by": "pulumi",
            "app.kubernetes.io/component": "ingress-controller",
          },
        },
      },
      { parent: this },
    );

    // Deploy Traefik chart directly with inline values
    this.chart = new k8s.helm.v3.Chart(
      `${name}-chart`,
      {
        chart: "traefik",
        fetchOpts: { repo: "https://traefik.github.io/charts" },
        version: "36.3.0",
        namespace: this.namespace.metadata.name,
        values: {
          // Deployment configuration
          deployment: {
            enabled: true,
            replicas: 1,
          },
          // Service configuration
          service: {
            enabled: true,
            type: "LoadBalancer",
          },
          // Ports configuration - router forwards 443 → 8443
          ports: {
            web: {
              port: 8080,
              redirections: {
                entryPoint: {
                  to: "websecure",
                  scheme: "https",
                  permanent: true,
                },
              },
            },
            websecure: {
              port: 8443, // Match router port forward
              tls: {
                enabled: true,
              },
            },
          },
          // Ingress class configuration
          ingressClass: {
            enabled: true,
            isDefaultClass: true,
          },
          // Global redirect to HTTPS
          globalArguments: [
            "--global.sendanonymoususage=false",
            "--entrypoints.web.http.redirections.entrypoint.to=websecure",
            "--entrypoints.web.http.redirections.entrypoint.scheme=https",
          ],
          // Resource limits
          resources: {
            requests: {
              cpu: "100m",
              memory: "128Mi",
            },
            limits: {
              cpu: "300m",
              memory: "256Mi",
            },
          },
        },
      },
      { parent: this, dependsOn: [this.namespace] },
    );

    this.registerOutputs({
      namespace: this.namespace,
      chart: this.chart,
    });
  }
}
