import * as k8s from "@pulumi/kubernetes";
import * as pulumi from "@pulumi/pulumi";

import { namespaceResourceOptions } from "./resource-options";
import { createNamespaceMetadata } from "./utils";

/**
 * Configuration for creating a generic namespace component
 */
export interface INamespaceConfig {
  readonly namespaceName: string;
  readonly appName: string;
  readonly extraLabels?: Record<string, string>;
}

/**
 * Generic Namespace Component
 *
 * Replaces the individual namespace components (ArgoCdNamespace, TraefikNamespace, etc.)
 * with a single configurable component. This eliminates duplication while maintaining
 * proper Pulumi ComponentResource patterns.
 *
 * Usage:
 *   const namespaceComponent = new NamespaceComponent("my-app", {
 *     namespaceName: "my-namespace",
 *     appName: "my-app"
 *   });
 */
export class NamespaceComponent extends pulumi.ComponentResource {
  public readonly namespace: k8s.core.v1.Namespace;

  constructor(name: string, config: INamespaceConfig, opts?: pulumi.ComponentResourceOptions) {
    super("rzp:shared:Namespace", name, {}, opts);

    this.namespace = this.createNamespace(name, config);
    this.registerOutputs({ namespace: this.namespace });
  }

  private createNamespace(name: string, config: INamespaceConfig): k8s.core.v1.Namespace {
    return new k8s.core.v1.Namespace(
      `${name}-namespace`,
      {
        metadata: createNamespaceMetadata(config.namespaceName, config.appName, config.extraLabels),
      },
      {
        ...namespaceResourceOptions,
        parent: this,
      },
    );
  }
}
