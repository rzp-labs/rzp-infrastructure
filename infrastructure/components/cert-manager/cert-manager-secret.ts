import * as k8s from "@pulumi/kubernetes";
import * as pulumi from "@pulumi/pulumi";

import { createKubernetesResourceOptions } from "../../shared/resource-options";
import type { ICertManagerSecretProps } from "../../shared/types";

/**
 * Cert-Manager Cloudflare Secret Component
 *
 * Native Pulumi ComponentResource that creates the Cloudflare API token secret.
 * Replaces the createCertManagerSecret factory function with a proper component.
 */
export class CertManagerSecret extends pulumi.ComponentResource {
  public readonly secret: k8s.core.v1.Secret;
  public readonly namespace: k8s.core.v1.Namespace;

  constructor(name: string, props: ICertManagerSecretProps, opts?: pulumi.ComponentResourceOptions) {
    super("rzp-infra:cert-manager:Secret", name, {}, opts);

    this.namespace = props.namespace;
    this.secret = this.createSecret(name, props);
    this.registerOutputs({ secret: this.secret, namespace: this.namespace });
  }

  private createSecret(name: string, props: ICertManagerSecretProps): k8s.core.v1.Secret {
    return new k8s.core.v1.Secret(
      `${name}-cloudflare-secret`,
      {
        metadata: {
          name: "cloudflare-api-token",
          namespace: props.namespace.metadata.name,
        },
        type: "Opaque",
        data: {
          "api-token": pulumi
            .output(props.config.cloudflareApiToken)
            .apply((token: string) => Buffer.from(token).toString("base64")),
        },
      },
      createKubernetesResourceOptions(this, { dependsOn: [props.namespace] }),
    );
  }
}
