/**
 * Main entry point for infrastructure deployment
 *
 * This file serves as the environment selector and main export point.
 * Currently configured for staging environment.
 */

// Export staging environment (default for now)
export * from "./environments/staging";

// Re-export shared utilities for external use
export { getVmRole, isTemplate } from "./shared/utils";
export type { VmRole, INodeInfo, IClusterOutput } from "./shared/types";
