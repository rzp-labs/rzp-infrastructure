import * as k8s from "@pulumi/kubernetes";
import * as pulumi from "@pulumi/pulumi";

/**
 * Traefik Component
 *
 * Flexible Traefik ingress controller component that can be deployed
 * directly via Pulumi or managed through ArgoCD applications.
 * Deployment files extend this component with specific configurations.
 */

export interface ITraefikArgs {
  readonly namespace: string;
  readonly chartVersion: string;
  readonly environment: "dev" | "stg" | "prd";
  readonly httpsPort?: number; // Optional HTTPS port, defaults to 8443
}

export class TraefikComponent extends pulumi.ComponentResource {
  public readonly namespace: k8s.core.v1.Namespace;
  public readonly chart: k8s.helm.v3.Chart;
  public readonly helmValuesOutput: pulumi.Output<string>;

  constructor(name: string, args: ITraefikArgs, opts?: pulumi.ComponentResourceOptions) {
    super("rzp-infra:traefik:Component", name, {}, opts);

    // Create namespace
    this.namespace = new k8s.core.v1.Namespace(
      `${args.namespace}`,
      {
        metadata: {
          name: args.namespace,
          labels: {
            "app.kubernetes.io/name": "traefik",
            "app.kubernetes.io/managed-by": "pulumi",
            "app.kubernetes.io/component": "ingress-controller",
          },
        },
      },
      { parent: this },
    );

    // Build opinionated Helm values
    const httpsPort = args.httpsPort ?? 8443; // Default to 8443 for production
    const helmValues = {
      // Install CRDs for Middleware, IngressRoute, etc.
      installCRDs: true,
      // Force update annotation to ensure CRDs are installed
      annotations: {
        "pulumi.com/forceUpdate": new Date().toISOString(),
      },
      // Deployment - single replica for homelab
      deployment: {
        enabled: true,
        replicas: 1,
      },
      // Service - LoadBalancer for external access
      service: {
        enabled: true,
        type: "LoadBalancer",
      },
      // Ports - homelab standard with router forwarding
      ports: {
        web: {
          port: 8000, // Use chart default to avoid conflicts
          expose: {
            default: false, // HTTP disabled for security
          },
          redirections: {
            entryPoint: {
              to: "websecure",
              scheme: "https",
              permanent: true,
            },
          },
        },
        websecure: {
          port: httpsPort, // Configurable HTTPS port
          expose: {
            default: true,
          },
          exposedPort: httpsPort, // Service should expose same port
          tls: {
            enabled: true,
          },
        },
      },
      // Ingress class - default for cluster
      ingressClass: {
        enabled: true,
        isDefaultClass: true,
      },
      // Security and redirect configuration
      globalArguments: [
        "--global.sendanonymoususage=false",
        "--entrypoints.web.http.redirections.entrypoint.to=websecure",
        "--entrypoints.web.http.redirections.entrypoint.scheme=https",
      ],
      // Production-ready resource limits
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
    };

    // Expose helm values as output for ArgoCD applications
    this.helmValuesOutput = pulumi.output(JSON.stringify(helmValues));

    // Deploy Traefik with opinionated homelab configuration
    this.chart = new k8s.helm.v3.Chart(
      name,
      {
        chart: "traefik",
        fetchOpts: { repo: "https://traefik.github.io/charts" },
        version: args.chartVersion,
        namespace: this.namespace.metadata.name,
        values: helmValues,
      },
      { parent: this, dependsOn: [this.namespace], replaceOnChanges: ["*"] },
    );

    // Register outputs
    this.registerOutputs({
      namespace: this.namespace,
      chart: this.chart,
      helmValuesOutput: this.helmValuesOutput,
    });
  }
}
