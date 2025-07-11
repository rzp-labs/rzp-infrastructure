import * as k8s from "@pulumi/kubernetes";
import * as pulumi from "@pulumi/pulumi";

import type { ArgoCdBootstrap } from "./argocd-bootstrap";

export interface IArgoCdSelfAppConfig {
  readonly argocd: ArgoCdBootstrap;
  readonly repositoryUrl: string;
  readonly targetRevision?: string;
  readonly path?: string;
  readonly kubernetesProvider?: k8s.Provider;
}

/**
 * ArgoCD Self-Management Application Component
 *
 * Creates an ArgoCD Application that allows ArgoCD to manage itself through GitOps.
 * This component depends on ArgoCD being fully deployed with CRDs available.
 */
export class ArgoCdSelfApp extends pulumi.ComponentResource {
  public readonly application: k8s.apiextensions.CustomResource;

  constructor(name: string, config: IArgoCdSelfAppConfig, opts?: pulumi.ComponentResourceOptions) {
    super("rzp-infra:argocd:SelfApp", name, {}, opts);

    // Create self-management application
    this.application = new k8s.apiextensions.CustomResource(
      `${name}-app`,
      {
        apiVersion: "argoproj.io/v1alpha1",
        kind: "Application",
        metadata: {
          name: "argocd-self-management",
          namespace: config.argocd.namespace.metadata.name,
        },
        spec: {
          project: "default",
          source: {
            repoURL: config.repositoryUrl,
            targetRevision: config.targetRevision ?? "HEAD",
            path: config.path ?? "bootstrap/argocd",
          },
          destination: {
            server: "https://kubernetes.default.svc",
            namespace: config.argocd.namespace.metadata.name,
          },
          syncPolicy: {
            automated: { prune: true, selfHeal: true },
            syncOptions: ["CreateNamespace=true"],
          },
        },
      },
      {
        parent: this,
        provider: config.kubernetesProvider,
        dependsOn: [config.argocd.chart], // Wait for ArgoCD to be fully ready
      },
    );

    this.registerOutputs({
      application: this.application,
    });
  }
}
