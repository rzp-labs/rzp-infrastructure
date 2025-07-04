import * as k8s from "@pulumi/kubernetes";
import * as pulumi from "@pulumi/pulumi";

import type { IArgoCdBootstrapConfig } from "../../shared/types";

export interface IArgoCdAdminSecretArgs {
  readonly config: IArgoCdBootstrapConfig;
  readonly namespace: k8s.core.v1.Namespace;
}

/**
 * ArgoCD Admin Secret Component
 *
 * Creates the initial admin secret for ArgoCD authentication.
 * Resolves password from config, environment, or fallback.
 */
export class ArgoCdAdminSecret extends pulumi.ComponentResource {
  public readonly secret: k8s.core.v1.Secret;

  constructor(name: string, args: IArgoCdAdminSecretArgs, opts?: pulumi.ComponentResourceOptions) {
    super("rzp:argocd:AdminSecret", name, {}, opts);

    const adminPassword = this.resolveAdminPassword(args.config);

    this.secret = new k8s.core.v1.Secret(
      `${name}-admin-secret`,
      {
        metadata: this.createSecretMetadata(args.namespace),
        type: "Opaque",
        data: {
          password: pulumi.output(adminPassword).apply((pwd: string) => Buffer.from(pwd).toString("base64")),
        },
      },
      { parent: this },
    );

    this.registerOutputs({
      secret: this.secret,
    });
  }

  private resolveAdminPassword(config: IArgoCdBootstrapConfig): pulumi.Output<string> {
    const cfg = new pulumi.Config();
    return config.adminPassword ?? cfg.getSecret("argoCdAdminPassword") ?? pulumi.secret("argocd-admin-fallback");
  }

  private createSecretMetadata(namespace: k8s.core.v1.Namespace) {
    return {
      name: "argocd-initial-admin-secret",
      namespace: namespace.metadata.name,
      labels: {
        "app.kubernetes.io/name": "argocd-initial-admin-secret",
        "app.kubernetes.io/part-of": "argocd",
      },
    };
  }
}
