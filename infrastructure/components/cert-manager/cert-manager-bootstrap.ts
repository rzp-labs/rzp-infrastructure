import type * as k8s from "@pulumi/kubernetes";
import * as pulumi from "@pulumi/pulumi";

import type { ICertManagerBootstrapConfig } from "../../shared/types";

import { CertManagerChart } from "./cert-manager-chart";
import { CertManagerClusterIssuer } from "./cert-manager-cluster-issuer";
import { CertManagerNamespace } from "./cert-manager-namespace";
import { CertManagerSecret } from "./cert-manager-secret";

/**
 * cert-manager Bootstrap Component
 *
 * Deploys cert-manager for automatic TLS certificate provisioning
 * using Let's Encrypt with DNS challenges via Cloudflare.
 */
export class CertManagerBootstrap extends pulumi.ComponentResource {
  public readonly namespaceComponent: CertManagerNamespace;
  public readonly chartComponent: CertManagerChart;
  public readonly secretComponent: CertManagerSecret;
  public readonly clusterIssuerComponent: CertManagerClusterIssuer;
  public readonly namespace: k8s.core.v1.Namespace;
  public readonly chart: k8s.helm.v3.Chart;
  public readonly cloudflareSecret: k8s.core.v1.Secret;
  public readonly clusterIssuer: k8s.apiextensions.CustomResource;

  constructor(name: string, config: ICertManagerBootstrapConfig, opts?: pulumi.ComponentResourceOptions) {
    super("rzp:cert-manager:CertManagerBootstrap", name, {}, opts);

    // Create cert-manager namespace using ComponentResource
    this.namespaceComponent = new CertManagerNamespace(name, { parent: this });
    this.namespace = this.namespaceComponent.namespace;

    // Deploy cert-manager using ComponentResource
    this.chartComponent = new CertManagerChart(name, { namespace: this.namespace }, { parent: this });
    this.chart = this.chartComponent.chart;

    // Create Cloudflare secret using ComponentResource
    this.secretComponent = new CertManagerSecret(name, { config, namespace: this.namespace }, { parent: this });
    this.cloudflareSecret = this.secretComponent.secret;

    // Create cluster issuer using ComponentResource
    this.clusterIssuerComponent = new CertManagerClusterIssuer(name, { config }, { parent: this });
    this.clusterIssuer = this.clusterIssuerComponent.clusterIssuer;

    this.registerOutputs({
      namespace: this.namespace,
      chart: this.chart,
      cloudflareSecret: this.cloudflareSecret,
      clusterIssuer: this.clusterIssuer,
    });
  }
}
