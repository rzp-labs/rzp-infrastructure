import * as crypto from "crypto";
import * as fs from "fs";
import * as os from "os";
import * as path from "path";

import type * as pulumi from "@pulumi/pulumi";
import * as yaml from "js-yaml";

/**
 * Kubeconfig structure interface
 */
interface IKubeconfig {
  clusters: Array<{
    cluster: {
      "certificate-authority-data": string;
      server: string;
    };
  }>;
  users: Array<{
    user: {
      "client-certificate-data": string;
      "client-key-data": string;
    };
  }>;
}

/**
 * K3s Kubeconfig Certificate Extraction Utilities
 *
 * Provides functions to extract TLS certificates and keys from K3s kubeconfig
 * for use with external providers that require certificate-based authentication.
 * Uses content-based hashing for deterministic temporary file names.
 */

/**
 * Extract certificate authority data from kubeconfig and write to deterministic temporary file
 * @param kubeconfig The kubeconfig as a Pulumi Output<string>
 * @returns The path to the temporary CA certificate file
 */
export function extractCaCertFromKubeconfig(kubeconfig: pulumi.Output<string>): pulumi.Output<string> {
  return kubeconfig.apply((config) => {
    const parsed = yaml.load(config) as IKubeconfig;
    const caCertData = parsed.clusters[0].cluster["certificate-authority-data"];
    const certContent = Buffer.from(caCertData, "base64").toString("utf8");

    // Create deterministic file name based on content hash
    const hash = crypto.createHash("sha256").update(certContent).digest("hex").substring(0, 8);
    const tempFilePath = path.join(os.tmpdir(), `k3s-ca-cert-${hash}.pem`);

    // Write to file (will overwrite if content is the same)
    fs.writeFileSync(tempFilePath, certContent);
    return tempFilePath;
  });
}

/**
 * Extract client certificate data from kubeconfig and write to deterministic temporary file
 * @param kubeconfig The kubeconfig as a Pulumi Output<string>
 * @returns The path to the temporary client certificate file
 */
export function extractClientCertFromKubeconfig(kubeconfig: pulumi.Output<string>): pulumi.Output<string> {
  return kubeconfig.apply((config) => {
    const parsed = yaml.load(config) as IKubeconfig;
    const clientCertData = parsed.users[0].user["client-certificate-data"];
    const certContent = Buffer.from(clientCertData, "base64").toString("utf8");

    // Create deterministic file name based on content hash
    const hash = crypto.createHash("sha256").update(certContent).digest("hex").substring(0, 8);
    const tempFilePath = path.join(os.tmpdir(), `k3s-client-cert-${hash}.pem`);

    // Write to file (will overwrite if content is the same)
    fs.writeFileSync(tempFilePath, certContent);
    return tempFilePath;
  });
}

/**
 * Extract client key data from kubeconfig and write to deterministic temporary file
 * @param kubeconfig The kubeconfig as a Pulumi Output<string>
 * @returns The path to the temporary client key file
 */
export function extractClientKeyFromKubeconfig(kubeconfig: pulumi.Output<string>): pulumi.Output<string> {
  return kubeconfig.apply((config) => {
    const parsed = yaml.load(config) as IKubeconfig;
    const clientKeyData = parsed.users[0].user["client-key-data"];
    const keyContent = Buffer.from(clientKeyData, "base64").toString("utf8");

    // Create deterministic file name based on content hash
    const hash = crypto.createHash("sha256").update(keyContent).digest("hex").substring(0, 8);
    const tempFilePath = path.join(os.tmpdir(), `k3s-client-key-${hash}.pem`);

    // Write to file (will overwrite if content is the same)
    fs.writeFileSync(tempFilePath, keyContent);
    return tempFilePath;
  });
}
