import * as k8s from "@pulumi/kubernetes";
import * as pulumi from "@pulumi/pulumi";

import { createArgoCdIngressSpec } from "../../config/argocd-config";
import { ARGOCD_DEFAULTS } from "../../shared/constants";
import type { IArgoCdBootstrapConfig } from "../../shared/types";
import { createTraefikIngressConfig } from "../../shared/utils";
import { withDefault } from "../../shared/utils";

export interface IArgoCdIngressArgs {
  readonly config: IArgoCdBootstrapConfig;
  readonly namespace: k8s.core.v1.Namespace;
}

/**
 * ArgoCD Ingress Component
 *
 * Creates an ingress for ArgoCD server to enable external access.
 * Configures TLS termination and routing rules.
 */
export class ArgoCdIngress extends pulumi.ComponentResource {
  public readonly ingress: k8s.networking.v1.Ingress;

  constructor(name: string, args: IArgoCdIngressArgs, opts?: pulumi.ComponentResourceOptions) {
    super("rzp:argocd:Ingress", name, {}, opts);

    const domain = withDefault(args.config.domain, ARGOCD_DEFAULTS.DEFAULT_DOMAIN);

    this.ingress = new k8s.networking.v1.Ingress(
      `${name}-ingress`,
      {
        metadata: this.createIngressMetadata(args.namespace),
        spec: createArgoCdIngressSpec(domain),
      },
      { parent: this },
    );

    this.registerOutputs({
      ingress: this.ingress,
    });
  }

  private createIngressMetadata(namespace: k8s.core.v1.Namespace) {
    return {
      name: "argocd-server-ingress",
      namespace: namespace.metadata.name,
      annotations: createTraefikIngressConfig(true).annotations,
    };
  }
}
