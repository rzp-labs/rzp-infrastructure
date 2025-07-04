import * as k8s from "@pulumi/kubernetes";
import * as pulumi from "@pulumi/pulumi";

import { METALLB_DEFAULTS } from "../../shared/constants";
import type { IMetalLBBootstrapConfig } from "../../shared/types";

/**
 * MetalLB Bootstrap Component
 *
 * Deploys MetalLB load balancer controller with IP pool configuration.
 * Uses Helm chart with post-install hooks for proper timing and idempotency.
 */
export class MetalLBBootstrap extends pulumi.ComponentResource {
  public readonly namespace: k8s.core.v1.Namespace;
  public readonly chart: k8s.helm.v3.Chart;
  public readonly ipAddressPool: k8s.apiextensions.CustomResource;
  public readonly l2Advertisement: k8s.apiextensions.CustomResource;

  constructor(name: string, config: IMetalLBBootstrapConfig, opts?: pulumi.ComponentResourceOptions) {
    super("rzp:metallb:MetalLBBootstrap", name, {}, opts);

    // Create MetalLB namespace
    this.namespace = this.createMetalLBNamespace(name);

    // Deploy MetalLB Helm chart
    this.chart = this.createMetalLBChart(name);

    // Create IPAddressPool and L2Advertisement as separate resources
    // Wait for chart.ready to ensure all MetalLB components (including webhooks) are ready
    this.ipAddressPool = this.createIPAddressPool(name, config);
    this.l2Advertisement = this.createL2Advertisement(name);

    this.registerOutputs({
      namespace: this.namespace,
      chart: this.chart,
      ipAddressPool: this.ipAddressPool,
      l2Advertisement: this.l2Advertisement,
    });
  }

  private createMetalLBNamespace(name: string): k8s.core.v1.Namespace {
    return new k8s.core.v1.Namespace(
      `${name}-namespace`,
      {
        metadata: {
          name: METALLB_DEFAULTS.NAMESPACE,
          labels: {
            "app.kubernetes.io/name": "metallb",
            "app.kubernetes.io/managed-by": "pulumi",
            "pod-security.kubernetes.io/enforce": "privileged",
            "pod-security.kubernetes.io/audit": "privileged",
            "pod-security.kubernetes.io/warn": "privileged",
          },
        },
      },
      { parent: this },
    );
  }

  private createMetalLBChart(name: string): k8s.helm.v3.Chart {
    const chartConfig = this.createChartConfig();
    const chartOptions = this.createChartOptions();

    return new k8s.helm.v3.Chart(`${name}-chart`, chartConfig, chartOptions);
  }

  private createChartConfig() {
    return {
      chart: METALLB_DEFAULTS.CHART_NAME,
      fetchOpts: { repo: METALLB_DEFAULTS.CHART_REPO },
      version: METALLB_DEFAULTS.CHART_VERSION,
      namespace: this.namespace.metadata.name,
      // Remove extraResources - create as separate K8s resources instead
      values: {
        controller: { enabled: true },
        speaker: { enabled: true },
      },
    };
  }

  private createChartOptions() {
    return {
      parent: this,
      dependsOn: [this.namespace],
    };
  }

  // Removed createWebhookHealthCheck - using chart.ready dependency instead
  // This aligns with production best practices for MetalLB orchestration

  private createIPAddressPool(name: string, config: IMetalLBBootstrapConfig): k8s.apiextensions.CustomResource {
    const resourceConfig = this.buildIPAddressPoolConfig(config);
    // Use chart.ready to wait for all chart resources including webhooks
    const options = { parent: this, dependsOn: [this.chart] };

    return new k8s.apiextensions.CustomResource(`${name}-ip-pool`, resourceConfig, options);
  }

  private buildIPAddressPoolConfig(config: IMetalLBBootstrapConfig) {
    return {
      apiVersion: "metallb.io/v1beta1",
      kind: "IPAddressPool",
      metadata: {
        name: "default-pool",
        namespace: this.namespace.metadata.name,
        annotations: {
          "pulumi.com/waitFor": "jsonpath={.metadata.name}",
          "pulumi.com/timeoutSeconds": "120",
        },
      },
      spec: { addresses: [config.ipRange] },
    };
  }

  private createL2Advertisement(name: string): k8s.apiextensions.CustomResource {
    return new k8s.apiextensions.CustomResource(
      `${name}-l2-advertisement`,
      {
        apiVersion: "metallb.io/v1beta1",
        kind: "L2Advertisement",
        metadata: {
          name: "default-l2-advertisement",
          namespace: this.namespace.metadata.name,
        },
        spec: {
          ipAddressPools: ["default-pool"],
        },
      },
      {
        parent: this,
        dependsOn: [this.ipAddressPool],
      },
    );
  }
}
