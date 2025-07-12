/**
 * ArgoCD Application Factory
 *
 * Helper utilities for creating ArgoCD Applications with standardized configuration.
 * Provides clean separation between ArgoCD infrastructure and application management.
 */

import * as k8s from "@pulumi/kubernetes";
import type * as pulumi from "@pulumi/pulumi";

export interface IArgoCdApplicationSource {
  readonly repoURL: string;
  readonly chart?: string;
  readonly targetRevision: string;
  readonly path?: string;
  readonly helm?: {
    readonly values?: pulumi.Input<string>;
    readonly valuesObject?: Record<string, unknown>;
    readonly valueFiles?: string[];
  };
}

export interface IArgoCdApplicationDestination {
  readonly server: string;
  readonly namespace: string;
}

export interface IArgoCdApplicationConfig {
  readonly name: string;
  readonly sources: IArgoCdApplicationSource[];
  readonly destination: IArgoCdApplicationDestination;
  readonly project?: string;
  readonly enableAdoption?: boolean; // Enable Replace=true, Prune=false for resource adoption
}

/**
 * Creates an ArgoCD Application for GitOps management
 *
 * @param name - Resource name for the Application
 * @param config - Application configuration
 * @param argoCdNamespace - Namespace where ArgoCD is deployed
 * @param opts - Pulumi component resource options
 * @returns ArgoCD Application CustomResource
 */
export function createArgoCdApplication(
  name: string,
  config: IArgoCdApplicationConfig,
  argoCdNamespace: pulumi.Input<string>,
  opts?: pulumi.ComponentResourceOptions,
): k8s.apiextensions.CustomResource {
  return new k8s.apiextensions.CustomResource(
    name,
    {
      apiVersion: "argoproj.io/v1alpha1",
      kind: "Application",
      metadata: {
        name: config.name,
        namespace: argoCdNamespace,
        labels: {
          "app.kubernetes.io/name": config.name,
          "app.kubernetes.io/managed-by": "pulumi",
          "app.kubernetes.io/component": "argocd-application",
        },
      },
      spec: {
        project: config.project ?? "default",
        sources: config.sources,
        destination: config.destination,
        syncPolicy: {
          automated: {
            prune: config.enableAdoption === true ? false : true, // Disable prune during adoption
            selfHeal: true,
          },
          syncOptions: ["CreateNamespace=true", ...(config.enableAdoption === true ? ["Replace=true"] : [])],
        },
      },
    },
    opts,
  );
}
