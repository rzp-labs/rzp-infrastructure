import type * as k8s from "@pulumi/kubernetes";
import * as pulumi from "@pulumi/pulumi";

import {
  createCertManagerChart,
  createCertManagerClusterIssuer,
  createCertManagerNamespace,
  createCertManagerSecret,
} from "../../resources/kubernetes/cert-manager-resources";
import type { ICertManagerBootstrapConfig } from "../../shared/types";

/**
 * cert-manager Bootstrap Component
 *
 * Deploys cert-manager for automatic TLS certificate provisioning
 * using Let's Encrypt with DNS challenges via Cloudflare.
 */
export class CertManagerBootstrap extends pulumi.ComponentResource {
  public readonly namespace: k8s.core.v1.Namespace;
  public readonly chart: k8s.helm.v3.Chart;
  public readonly cloudflareSecret: k8s.core.v1.Secret;
  public readonly clusterIssuer: k8s.apiextensions.CustomResource;

  constructor(name: string, config: ICertManagerBootstrapConfig, opts?: pulumi.ComponentResourceOptions) {
    super("rzp:cert-manager:CertManagerBootstrap", name, {}, opts);

    // Create cert-manager resources
    this.namespace = createCertManagerNamespace(name, this);
    this.chart = createCertManagerChart(name, this.namespace, this);
    this.cloudflareSecret = createCertManagerSecret(name, config, this.namespace, this);
    this.clusterIssuer = createCertManagerClusterIssuer(name, config, this);

    this.registerOutputs({
      namespace: this.namespace,
      chart: this.chart,
      cloudflareSecret: this.cloudflareSecret,
      clusterIssuer: this.clusterIssuer,
    });
  }
}
