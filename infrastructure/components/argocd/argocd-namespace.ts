import * as k8s from "@pulumi/kubernetes";
import * as pulumi from "@pulumi/pulumi";

import { ARGOCD_DEFAULTS } from "../../shared/constants";
import { createNamespaceMetadata } from "../../shared/utils";
import { namespaceResourceOptions } from "../../shared/resource-options";

/**
 * ArgoCD Namespace Component
 *
 * Native Pulumi ComponentResource that creates the ArgoCD namespace.
 * Replaces the createArgoCdNamespace factory function with a proper component.
 */
export class ArgoCdNamespace extends pulumi.ComponentResource {
  public readonly namespace: k8s.core.v1.Namespace;

  constructor(name: string, opts?: pulumi.ComponentResourceOptions) {
    super("rzp:argocd:Namespace", name, {}, opts);

    this.namespace = this.createNamespace(name);
    this.registerOutputs({ namespace: this.namespace });
  }

  private createNamespace(name: string): k8s.core.v1.Namespace {
    return new k8s.core.v1.Namespace(
      `${name}-namespace`,
      {
        metadata: createNamespaceMetadata(ARGOCD_DEFAULTS.NAMESPACE, "argocd"),
      },
      {
        ...namespaceResourceOptions,
        parent: this,
      },
    );
  }
}
