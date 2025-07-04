import type * as k8s from "@pulumi/kubernetes";
import * as pulumi from "@pulumi/pulumi";

import type { IArgoCdBootstrapConfig } from "../../shared/types";

import { ArgoCdAdminSecret } from "./argocd-admin-secret";
import { ArgoCdChart } from "./argocd-chart";
import { ArgoCdIngress } from "./argocd-ingress";
import { ArgoCdNamespace } from "./argocd-namespace";
import { ArgoCdSelfApp } from "./argocd-self-app";

/**
 * ArgoCD Bootstrap Component
 *
 * Deploys ArgoCD to K3s cluster to enable GitOps workflow.
 * This is the foundation component that enables all other services
 * to be deployed via GitOps patterns.
 */
export class ArgoCdBootstrap extends pulumi.ComponentResource {
  public readonly namespaceComponent: ArgoCdNamespace;
  public readonly adminSecretComponent: ArgoCdAdminSecret;
  public readonly chartComponent: ArgoCdChart;
  public readonly ingressComponent: ArgoCdIngress;
  public readonly selfAppComponent: ArgoCdSelfApp;
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

    // Create admin secret using ComponentResource
    this.adminSecretComponent = new ArgoCdAdminSecret(name, { config, namespace: this.namespace }, { parent: this });
    this.adminSecret = this.adminSecretComponent.secret;

    // Deploy ArgoCD using ComponentResource
    this.chartComponent = new ArgoCdChart(name, { config, namespace: this.namespace }, { parent: this });
    this.chart = this.chartComponent.chart;

    // Create ingress using ComponentResource
    this.ingressComponent = new ArgoCdIngress(name, { config, namespace: this.namespace }, { parent: this });
    this.ingress = this.ingressComponent.ingress;

    // Create self-management application using ComponentResource
    this.selfAppComponent = new ArgoCdSelfApp(name, { config, namespace: this.namespace }, { parent: this });
    this.argoCdApp = this.selfAppComponent.application;

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
