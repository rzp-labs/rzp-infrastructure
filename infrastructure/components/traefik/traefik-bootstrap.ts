import * as k8s from "@pulumi/kubernetes";
import * as pulumi from "@pulumi/pulumi";

import {
  createTraefikChart,
  createTraefikDashboard,
  createTraefikNamespace,
} from "../../resources/kubernetes/traefik-resources";
import type { ITraefikBootstrapConfig } from "../../shared/types";

/**
 * Traefik Bootstrap Component
 *
 * Deploys Traefik ingress controller via Helm for platform bootstrap.
 * This enables ArgoCD to be accessible via ingress while allowing
 * ArgoCD to manage Traefik configuration in GitOps mode later.
 */
export class TraefikBootstrap extends pulumi.ComponentResource {
  public readonly namespace: k8s.core.v1.Namespace;
  public readonly chart: k8s.helm.v3.Chart;
  public readonly dashboard: k8s.networking.v1.Ingress | undefined;

  constructor(name: string, config: ITraefikBootstrapConfig, opts?: pulumi.ComponentResourceOptions) {
    super("rzp:traefik:TraefikBootstrap", name, {}, opts);

    // Create Kubernetes provider
    const k8sProvider = new k8s.Provider(`${name}-k8s-provider`, { kubeconfig: config.kubeconfig }, { parent: this });

    // Create Traefik resources
    this.namespace = createTraefikNamespace(name, k8sProvider, this);
    this.chart = createTraefikChart(name, config, this.namespace, k8sProvider, this);
    this.dashboard = createTraefikDashboard(name, config, this.namespace, k8sProvider, this);

    this.registerOutputs({
      namespace: this.namespace,
      chart: this.chart,
      dashboard: this.dashboard,
    });
  }
}
