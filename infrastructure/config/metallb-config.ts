import type { IMetalLBChartValues } from "../shared/types";

export function createMetalLBChartValues(ipRange: string): IMetalLBChartValues {
  // Validate IP range format early to catch config errors
  if (!ipRange?.includes("-")) {
    throw new Error(`Invalid MetalLB IP range: ${ipRange}. Expected format: "10.10.0.200-10.10.0.201"`);
  }

  // Note: extraResources cannot create CRDs due to timing limitations since MetalLB 0.13.0
  // IP range '${ipRange}' will be configured by separate MetalLBPools component
  return {
    controller: { enabled: true },
    speaker: { enabled: true },
    webhook: { enabled: true },
    extraResources: [], // IP pools created by MetalLBPools component using range: ${ipRange}
  };
}
