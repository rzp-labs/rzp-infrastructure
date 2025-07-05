import * as k8s from "@pulumi/kubernetes";
import * as pulumi from "@pulumi/pulumi";

import { kubernetesResourceOptions } from "../../shared/resource-options";
import type { ICertManagerBootstrapConfig, ICertManagerClusterIssuerProps } from "../../shared/types";

/**
 * Cert-Manager Cluster Issuer Component
 *
 * Native Pulumi ComponentResource that creates the Let's Encrypt cluster issuer.
 * Replaces the createCertManagerClusterIssuer factory function with a proper component.
 */
export class CertManagerClusterIssuer extends pulumi.ComponentResource {
  public readonly clusterIssuer: k8s.apiextensions.CustomResource;

  constructor(name: string, props: ICertManagerClusterIssuerProps, opts?: pulumi.ComponentResourceOptions) {
    super("rzp:cert-manager:ClusterIssuer", name, {}, opts);

    this.clusterIssuer = this.createClusterIssuer(name, props);
    this.registerOutputs({ clusterIssuer: this.clusterIssuer });
  }

  private createClusterIssuer(name: string, props: ICertManagerClusterIssuerProps): k8s.apiextensions.CustomResource {
    const issuerName = `${name}-letsencrypt-issuer`;

    return new k8s.apiextensions.CustomResource(
      issuerName,
      {
        apiVersion: "cert-manager.io/v1",
        kind: "ClusterIssuer",
        metadata: { name: issuerName },
        spec: this.createIssuerSpec(issuerName, props.config),
      },
      { ...kubernetesResourceOptions, parent: this },
    );
  }

  private createIssuerSpec(issuerName: string, config: ICertManagerBootstrapConfig) {
    const serverUrl = config.staging
      ? "https://acme-staging-v02.api.letsencrypt.org/directory"
      : "https://acme-v02.api.letsencrypt.org/directory";

    return {
      acme: {
        server: serverUrl,
        email: config.email,
        privateKeySecretRef: { name: `${issuerName}-private-key` },
        solvers: [{ dns01: { cloudflare: { apiTokenSecretRef: { name: "cloudflare-api-token", key: "api-token" } } } }],
      },
    };
  }
}
