import type * as k8s from "@pulumi/kubernetes";
import * as pulumi from "@pulumi/pulumi";

import { createCertManagerChartValues } from "../../config/cert-manager-config";
import { ChartComponent } from "../../shared/base-chart-component";
import { NamespaceComponent } from "../../shared/base-namespace-component";
import { CERT_MANAGER_DEFAULTS } from "../../shared/constants";
import type { ICertManagerBootstrapConfig } from "../../shared/types";

import { CertManagerClusterIssuer } from "./cert-manager-cluster-issuer";
import { CertManagerSecret } from "./cert-manager-secret";

/**
 * cert-manager Bootstrap Component
 *
 * Deploys cert-manager for automatic TLS certificate provisioning
 * using Let's Encrypt with DNS challenges via Cloudflare.
 *
 * REFACTORED: Now uses generic NamespaceComponent and ChartComponent
 * for the core Helm deployment, while keeping cert-manager-specific components
 * (secret, cluster issuer) as separate ComponentResources.
 */
export class CertManagerBootstrap extends pulumi.ComponentResource {
  public readonly namespaceComponent: NamespaceComponent;
  public readonly chartComponent: ChartComponent;
  public readonly secretComponent: CertManagerSecret;
  public readonly clusterIssuerComponent: CertManagerClusterIssuer;
  public readonly namespace: k8s.core.v1.Namespace;
  public readonly chart: k8s.helm.v3.Chart;
  public readonly cloudflareSecret: k8s.core.v1.Secret;
  public readonly clusterIssuer: k8s.apiextensions.CustomResource;

  constructor(name: string, config: ICertManagerBootstrapConfig, opts?: pulumi.ComponentResourceOptions) {
    super("rzp:cert-manager:CertManagerBootstrap", name, {}, opts);

    this.namespaceComponent = this.createNamespace(name);
    this.namespace = this.namespaceComponent.namespace;

    this.chartComponent = this.createChart(name);
    this.chart = this.chartComponent.chart;

    this.secretComponent = this.createSecret(name, config);
    this.cloudflareSecret = this.secretComponent.secret;

    this.clusterIssuerComponent = this.createClusterIssuer(name, config);
    this.clusterIssuer = this.clusterIssuerComponent.clusterIssuer;

    this.registerAllOutputs();
  }

  private createNamespace(name: string): NamespaceComponent {
    return new NamespaceComponent(
      name,
      { namespaceName: CERT_MANAGER_DEFAULTS.NAMESPACE, appName: "cert-manager" },
      { parent: this },
    );
  }

  private createChart(name: string): ChartComponent {
    return new ChartComponent(
      name,
      {
        chartName: CERT_MANAGER_DEFAULTS.CHART_NAME,
        chartRepo: CERT_MANAGER_DEFAULTS.CHART_REPO,
        chartVersion: CERT_MANAGER_DEFAULTS.CHART_VERSION,
        namespace: this.namespace,
        values: createCertManagerChartValues(),
      },
      { parent: this },
    );
  }

  private createSecret(name: string, config: ICertManagerBootstrapConfig): CertManagerSecret {
    return new CertManagerSecret(name, { config, namespace: this.namespace }, { parent: this });
  }

  private createClusterIssuer(name: string, config: ICertManagerBootstrapConfig): CertManagerClusterIssuer {
    return new CertManagerClusterIssuer(name, { config }, { parent: this, dependsOn: [this.chart] });
  }

  private registerAllOutputs(): void {
    this.registerOutputs({
      namespace: this.namespace,
      chart: this.chart,
      cloudflareSecret: this.cloudflareSecret,
      clusterIssuer: this.clusterIssuer,
    });
  }
}
