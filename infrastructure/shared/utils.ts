/**
 * Shared utility functions for the infrastructure project
 */

import type { VmRole } from "./types";

/**
 * Determines the role of a VM based on its VM ID
 * Returns null if the VM is not a managed K3s node
 */
export function getVmRole(vmId: number, masterVmidStart: number, workerVmidStart: number): VmRole | null {
  if (vmId >= masterVmidStart && vmId < masterVmidStart + 10) return "master";
  if (vmId >= workerVmidStart && vmId < workerVmidStart + 10) return "worker";
  return null; // Not a K3s VM we manage
}

/**
 * Checks if a VM ID is in the template range
 */
export function isTemplate(vmId: number): boolean {
  return vmId >= 9000 && vmId < 9100;
}

/**
 * Generates an IPv4 address for a node
 */
export function generateIpv4(prefix: string, hostBase: number, index: number): string {
  return `${prefix}${hostBase + index}`;
}

/**
 * Generates an IPv6 address for a node
 */
export function generateIpv6(prefix: string, hostBase: number, index: number): string {
  return `${prefix}${hostBase + index}`;
}

/**
 * Generates a consistent VM name based on role and index
 */
export function generateVmName(role: "master" | "worker", roleIndex: number, prefix = "stg-k3s"): string {
  if (role === "master") {
    return roleIndex === 0 ? `${prefix}-master` : `${prefix}-master-${roleIndex + 1}`;
  }
  return `${prefix}-worker-${roleIndex + 1}`;
}

/**
 * Calculates the overall network index for IP assignment
 */
export function calculateNetworkIndex(role: "master" | "worker", roleIndex: number, masterCount: number): number {
  return role === "master" ? roleIndex : masterCount + roleIndex;
}
