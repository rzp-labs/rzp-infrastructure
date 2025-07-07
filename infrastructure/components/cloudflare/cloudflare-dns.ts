import * as cloudflare from "@pulumi/cloudflare";
import * as pulumi from "@pulumi/pulumi";

import type { ICloudflareDNSConfig } from "../../shared/types";

/**
 * Cloudflare DNS Component
 *
 * Manages DNS records for the staging environment using Cloudflare.
 * Creates records for services like Traefik dashboard and ArgoCD.
 */
export class CloudflareDNS extends pulumi.ComponentResource {
  public readonly records: cloudflare.Record[] = [];

  constructor(name: string, config: ICloudflareDNSConfig, opts?: pulumi.ComponentResourceOptions) {
    super("rzp-infra:cloudflare:CloudflareDNS", name, {}, opts);

    // Create DNS records for staging services
    this.records = this.createDNSRecords(config);

    this.registerOutputs({
      records: this.records,
    });
  }

  private createDNSRecords(config: ICloudflareDNSConfig): cloudflare.Record[] {
    const records: cloudflare.Record[] = [];

    // Get the load balancer IP from MetalLB range (first IP)
    const loadBalancerIP = config.loadBalancerIP ?? "10.10.0.200";

    // Create DNS records for each service
    config.services.forEach((service) => {
      const record = new cloudflare.Record(
        `${service.name}-dns-record`,
        {
          zoneId: config.zoneId,
          name: `${config.environment}.${service.name}`,
          content: loadBalancerIP,
          type: "A",
          ttl: 300,
          comment: `Staging ${service.name} service managed by Pulumi`,
        },
        { parent: this },
      );
      records.push(record);
    });

    return records;
  }
}
