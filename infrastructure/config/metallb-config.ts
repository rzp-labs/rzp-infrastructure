import { METALLB_DEFAULTS } from "../shared/constants";
import type { IMetalLBChartValues } from "../shared/types";

export function createMetalLBChartValues(ipRange: string): IMetalLBChartValues {
  return {
    controller: { enabled: true },
    speaker: { enabled: true },
    extraResources: [createIPAddressPool(ipRange), createL2Advertisement()],
  };
}

function createIPAddressPool(ipRange: string) {
  return {
    apiVersion: "metallb.io/v1beta1",
    kind: "IPAddressPool",
    metadata: {
      name: "default-pool",
      namespace: METALLB_DEFAULTS.NAMESPACE,
    },
    spec: {
      addresses: [ipRange],
    },
  };
}

function createL2Advertisement() {
  return {
    apiVersion: "metallb.io/v1beta1",
    kind: "L2Advertisement",
    metadata: {
      name: "default-l2-advertisement",
      namespace: METALLB_DEFAULTS.NAMESPACE,
    },
    spec: {
      ipAddressPools: ["default-pool"],
    },
  };
}
