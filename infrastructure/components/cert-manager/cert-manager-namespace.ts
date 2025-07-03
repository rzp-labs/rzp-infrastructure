import * as k8s from "@pulumi/kubernetes";
import * as pulumi from "@pulumi/pulumi";

import { CERT_MANAGER_DEFAULTS } from "../../shared/constants";
import { createNamespaceMetadata } from "../../shared/utils";
import { namespaceResourceOptions } from "../../shared/resource-options";

/**
 * Cert-Manager Namespace Component
 *
 * Native Pulumi ComponentResource that creates the cert-manager namespace.
 * Replaces the createCertManagerNamespace factory function with a proper component.
 */
export class CertManagerNamespace extends pulumi.ComponentResource {
  public readonly namespace: k8s.core.v1.Namespace;

  constructor(name: string, opts?: pulumi.ComponentResourceOptions) {
    super("rzp:cert-manager:Namespace", name, {}, opts);

    this.namespace = this.createNamespace(name);
    this.registerOutputs({ namespace: this.namespace });
  }

  private createNamespace(name: string): k8s.core.v1.Namespace {
    return new k8s.core.v1.Namespace(
      `${name}-namespace`,
      {
        metadata: createNamespaceMetadata(
          CERT_MANAGER_DEFAULTS.NAMESPACE,
          "cert-manager",
          { "cert-manager.io/disable-validation": "true" },
        ),
      },
      {
        ...namespaceResourceOptions,
        parent: this,
      },
    );
  }
}
