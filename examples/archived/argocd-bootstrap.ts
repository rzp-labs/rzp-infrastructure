import type * as k8s from "@pulumi/kubernetes";
import * as pulumi from "@pulumi/pulumi";

import { createArgoCdChartValues } from "../../config/argocd-config";
import { ChartComponent } from "../../shared/base-chart-component";
import { NamespaceComponent } from "../../shared/base-namespace-component";
import { ARGOCD_DEFAULTS } from "../../shared/constants";
import type { IArgoCdBootstrapConfig } from "../../shared/types";

import { ArgoCdIngress } from "./argocd-ingress";
import { ArgoCdSelfApp } from "./argocd-self-app";

/**
 * ArgoCD Bootstrap Component
 *
 * Deploys ArgoCD to K3s cluster to enable GitOps workflow.
 * This is the foundation component that enables all other services
 * to be deployed via GitOps patterns.
 *
 * REFACTORED: Now uses generic NamespaceComponent and ChartComponent
 * for the core Helm deployment, while keeping ArgoCD-specific components
 * (admin secret, ingress, self-app) as separate ComponentResources.
 */
export class ArgoCdBootstrap extends pulumi.ComponentResource {
  public readonly namespaceComponent: NamespaceComponent;
  public readonly chartComponent: ChartComponent;
  public readonly ingressComponent: ArgoCdIngress;
  public readonly selfAppComponent: ArgoCdSelfApp;
  public readonly namespace: k8s.core.v1.Namespace;
  public readonly chart: k8s.helm.v3.Chart;
  public readonly argoCdApp: k8s.apiextensions.CustomResource;
  public readonly ingress: k8s.networking.v1.Ingress;

  constructor(name: string, config: IArgoCdBootstrapConfig, opts?: pulumi.ComponentResourceOptions) {
    super("rzp-infra:argocd:ArgoCdBootstrap", name, {}, opts);

    this.namespaceComponent = this.createNamespace(name);
    this.namespace = this.namespaceComponent.namespace;
    this.chartComponent = this.createChart(name, config);
    this.chart = this.chartComponent.chart;

    this.ingressComponent = this.createIngress(name, config);
    this.ingress = this.ingressComponent.ingress;

    this.selfAppComponent = this.createSelfApp(name, config);
    this.argoCdApp = this.selfAppComponent.application;

    this.registerAllOutputs();
  }

  private createNamespace(name: string): NamespaceComponent {
    return new NamespaceComponent(
      name,
      { namespaceName: ARGOCD_DEFAULTS.NAMESPACE, appName: "argocd" },
      { parent: this },
    );
  }

  private createChart(name: string, config: IArgoCdBootstrapConfig): ChartComponent {
    return new ChartComponent(
      name,
      {
        chartName: ARGOCD_DEFAULTS.CHART_NAME,
        chartRepo: ARGOCD_DEFAULTS.CHART_REPO,
        chartVersion: ARGOCD_DEFAULTS.CHART_VERSION,
        namespace: this.namespace,
        values: createArgoCdChartValues(config),
      },
      { parent: this },
    );
  }

  private createIngress(name: string, config: IArgoCdBootstrapConfig): ArgoCdIngress {
    return new ArgoCdIngress(name, { config, namespace: this.namespace }, { parent: this });
  }

  private createSelfApp(name: string, config: IArgoCdBootstrapConfig): ArgoCdSelfApp {
    return new ArgoCdSelfApp(name, { config, namespace: this.namespace }, { parent: this, dependsOn: [this.chart] });
  }

  private registerAllOutputs(): void {
    this.registerOutputs({
      namespace: this.namespace,
      chart: this.chart,
      ingress: this.ingress,
      argoCdApp: this.argoCdApp,
    });
  }
}
