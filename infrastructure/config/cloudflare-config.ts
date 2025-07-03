import * as pulumi from "@pulumi/pulumi";

import type { ICloudflareConfig } from "../shared/types";

export function getCloudflareConfig(): ICloudflareConfig {
  const cfg = new pulumi.Config("cloudflare");

  const apiToken = cfg.requireSecret("apiToken");
  const zoneId = cfg.require("zoneId");
  const domain = cfg.get("domain") ?? "rzp.one";

  return {
    apiToken,
    zoneId,
    domain,
  };
}
