import * as k8s from "@pulumi/kubernetes";
import * as pulumi from "@pulumi/pulumi";

import { createArgoCdApplicationSpec } from "../../config/argocd-config";
import type { IArgoCdBootstrapConfig } from "../../shared/types";

export interface IArgoCdSelfAppArgs {
  readonly config: IArgoCdBootstrapConfig;
  readonly namespace: k8s.core.v1.Namespace;
}

/**
 * ArgoCD Self-Management Application Component
 *
 * Creates an ArgoCD Application that manages ArgoCD itself.
 * This enables ArgoCD to be managed through GitOps patterns.
 */
export class ArgoCdSelfApp extends pulumi.ComponentResource {
  public readonly application: k8s.apiextensions.CustomResource;

  constructor(name: string, args: IArgoCdSelfAppArgs, opts?: pulumi.ComponentResourceOptions) {
    super("rzp:argocd:SelfApp", name, {}, opts);

    this.application = new k8s.apiextensions.CustomResource(
      `${name}-self-app`,
      {
        apiVersion: "argoproj.io/v1alpha1",
        kind: "Application",
        metadata: this.createApplicationMetadata(args.namespace),
        spec: createArgoCdApplicationSpec(args.config, args.namespace.metadata.name),
      },
      { parent: this },
    );

    this.registerOutputs({
      application: this.application,
    });
  }

  private createApplicationMetadata(namespace: k8s.core.v1.Namespace) {
    return {
      name: "argocd-bootstrap",
      namespace: namespace.metadata.name,
    };
  }
}
