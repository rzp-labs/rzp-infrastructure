import * as k8s from "@pulumi/kubernetes";
import * as pulumi from "@pulumi/pulumi";

import { TRAEFIK_DEFAULTS } from "../../shared/constants";
import { createNamespaceMetadata } from "../../shared/utils";
import { namespaceResourceOptions } from "../../shared/resource-options";

/**
 * Traefik Namespace Component
 *
 * Native Pulumi ComponentResource that creates the Traefik namespace.
 * Replaces the createTraefikNamespace factory function with a proper component.
 */
export class TraefikNamespace extends pulumi.ComponentResource {
  public readonly namespace: k8s.core.v1.Namespace;

  constructor(name: string, opts?: pulumi.ComponentResourceOptions) {
    super("rzp:traefik:Namespace", name, {}, opts);

    this.namespace = this.createNamespace(name);
    this.registerOutputs({ namespace: this.namespace });
  }

  private createNamespace(name: string): k8s.core.v1.Namespace {
    return new k8s.core.v1.Namespace(
      `${name}-namespace`,
      {
        metadata: createNamespaceMetadata(TRAEFIK_DEFAULTS.NAMESPACE, "traefik"),
      },
      {
        ...namespaceResourceOptions,
        parent: this,
      },
    );
  }
}
