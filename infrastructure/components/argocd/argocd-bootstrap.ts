import type * as k8s from "@pulumi/kubernetes";
import * as pulumi from "@pulumi/pulumi";

import {
  createArgoCdAdminSecret,
  createArgoCdIngress,
  createArgoCdSelfApp,
} from "../../resources/kubernetes/argocd-resources";
import type { IArgoCdBootstrapConfig } from "../../shared/types";

import { ArgoCdChart } from "./argocd-chart";
import { ArgoCdNamespace } from "./argocd-namespace";

/**
 * ArgoCD Bootstrap Component
 *
 * Deploys ArgoCD to K3s cluster to enable GitOps workflow.
 * This is the foundation component that enables all other services
 * to be deployed via GitOps patterns.
 */
export class ArgoCdBootstrap extends pulumi.ComponentResource {
  public readonly namespaceComponent: ArgoCdNamespace;
  public readonly chartComponent: ArgoCdChart;
  public readonly namespace: k8s.core.v1.Namespace;
  public readonly chart: k8s.helm.v3.Chart;
  public readonly argoCdApp: k8s.apiextensions.CustomResource;
  public readonly ingress: k8s.networking.v1.Ingress;
  public readonly adminSecret: k8s.core.v1.Secret;

  constructor(name: string, config: IArgoCdBootstrapConfig, opts?: pulumi.ComponentResourceOptions) {
    super("rzp:argocd:Bootstrap", name, {}, opts);

    // Create ArgoCD namespace using ComponentResource
    this.namespaceComponent = new ArgoCdNamespace(name, { parent: this });
    this.namespace = this.namespaceComponent.namespace;

    // Create admin secret using factory (to be refactored later)
    this.adminSecret = createArgoCdAdminSecret(name, config, this.namespace, this);

    // Deploy ArgoCD using ComponentResource
    this.chartComponent = new ArgoCdChart(name, { config, namespace: this.namespace }, { parent: this });
    this.chart = this.chartComponent.chart;

    // Create networking and self-management using factories (to be refactored later)
    this.ingress = createArgoCdIngress(name, config, this.namespace, this);
    this.argoCdApp = createArgoCdSelfApp(name, config, this.namespace, this);

    // Register outputs - Pulumi handles dependency ordering automatically
    this.registerOutputs({
      namespace: this.namespace,
      chart: this.chart,
      adminSecret: this.adminSecret,
      ingress: this.ingress,
      argoCdApp: this.argoCdApp,
    });
  }
}
