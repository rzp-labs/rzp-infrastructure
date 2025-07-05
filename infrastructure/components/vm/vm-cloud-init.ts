/**
 * VM cloud-init configuration utilities
 */

import { DNS_DEFAULTS } from "../../shared/constants";
import type { IK3sNodeConfig, IProxmoxConfig, IVmCloudInitArgs } from "../../shared/types";

export function getVmCloudInitConfig(args: IVmCloudInitArgs) {
  return {
    type: "nocloud",
    datastoreId: args.config.vmStore,
    interface: "ide2",
    dns: getDnsConfig(),
    ipConfigs: [getIpConfig(args.nodeConfig, args.config)],
    // Use separate metadata and user data files like Terraform
    metaDataFileId: args.metadataFile.id,
    userDataFileId: args.userDataFile.id,
  };
}

function getDnsConfig() {
  return {
    servers: [...DNS_DEFAULTS.SERVERS], // Convert readonly array to mutable array
    domain: DNS_DEFAULTS.DOMAIN,
  };
}

function getIpConfig(nodeConfig: IK3sNodeConfig, config: IProxmoxConfig) {
  return {
    ipv4: {
      address: `${nodeConfig.ip4}/24`,
      gateway: config.bridge === "vmbr0" ? "10.10.0.1" : undefined,
    },
    ipv6: {
      address: `${nodeConfig.ip6}/64`,
      gateway: config.bridge === "vmbr0" ? "fd00:10:10::1" : undefined,
    },
  };
}
