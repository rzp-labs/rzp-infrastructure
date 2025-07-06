/**
 * Shared utility functions for the infrastructure project
 */

import type { IVmHealthCheckConfig } from "../helpers/health/vm-health-check";

import type { IK3sNodeConfig } from "./types";

// Re-export health check utilities from dedicated modules
export { createVmHealthCheck, type IVmHealthCheckConfig } from "../helpers/health/vm-health-check";
export { createK3sHealthCheck, type IK3sHealthCheckConfig } from "../helpers/health/k3s-health-check";

// For backward compatibility, alias the interfaces
export type IHealthCheckConfig = IVmHealthCheckConfig;

/**
 * Determines the role of a VM based on its VM ID
 * Returns null if the VM is not a managed K3s node
 */
export function getVmRole(
  vmId: number,
  masterVmidStart: number,
  workerVmidStart: number,
): IK3sNodeConfig["role"] | null {
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
 * Calculates the network index for master nodes
 * Masters use sequential indexing: 0 → .20, 1 → .21, etc.
 */
function getMasterNetworkIndex(roleIndex: number, masterVmidStart: number): number {
  const masterVmId = masterVmidStart + roleIndex;
  return masterVmId - 100; // Network index = VMID - 100
}

/**
 * Calculates the network index for worker nodes
 * Workers use VM ID's last two digits: VM 130 → .30, VM 131 → .31, etc.
 */
function getWorkerNetworkIndex(roleIndex: number, workerVmidStart: number): number {
  const workerVmId = workerVmidStart + roleIndex;
  return workerVmId % 100;
}

/**
 * Calculates the network index for IP assignment based on VM role
 */
export function calculateNetworkIndex(config: {
  role: "master" | "worker";
  roleIndex: number;
  masterCount: number;
  vmIdStart?: number;
}): number {
  if (config.role === "master") {
    return getMasterNetworkIndex(config.roleIndex, config.vmIdStart ?? 120);
  }

  return getWorkerNetworkIndex(config.roleIndex, config.vmIdStart ?? 130);
}

/**
 * Simple string utilities
 */

/**
 * Capitalizes the first letter of a string
 */
export function capitalize(str: string): string {
  return str.charAt(0).toUpperCase() + str.slice(1);
}

/**
 * Boolean utilities
 */

/**
 * Safely checks if a value is truthy, handling null/undefined
 */
export function isTruthy(value: unknown): boolean {
  return Boolean(value);
}

/**
 * Provides a default value for optional boolean properties
 */
export function withDefault<T>(value: T | undefined, defaultValue: T): T {
  return value ?? defaultValue;
}

/**
 * Kubernetes utilities
 */

/**
 * Creates standard Kubernetes app labels for a component
 */
export function createKubernetesLabels(appName: string, component?: string): Record<string, string> {
  const labels: Record<string, string> = {
    "app.kubernetes.io/name": appName,
    "app.kubernetes.io/part-of": appName,
  };

  if (component !== undefined) {
    labels["app.kubernetes.io/component"] = component;
  }

  return labels;
}

/**
 * Creates namespace metadata with standard labels
 */
export function createNamespaceMetadata(namespaceName: string, appName: string, extraLabels?: Record<string, string>) {
  return {
    name: namespaceName,
    labels: {
      ...createKubernetesLabels(appName, "namespace"),
      ...extraLabels,
    },
  };
}

/**
 * Ingress utilities
 */

/**
 * Standard Traefik ingress configuration for the staging environment
 */
export function createTraefikIngressConfig(enableTls = true) {
  return {
    ingressClassName: "stg-traefik-chart",
    annotations: createTraefikIngressAnnotations(enableTls),
  };
}

/**
 * Standard Traefik ingress annotations
 */
export function createTraefikIngressAnnotations(enableTls = true) {
  const baseAnnotations = {
    "traefik.ingress.kubernetes.io/router.entrypoints": enableTls ? "websecure" : "web",
  };

  if (enableTls) {
    return {
      ...baseAnnotations,
      "traefik.ingress.kubernetes.io/router.tls": "true",
      "cert-manager.io/cluster-issuer": "stg-cert-manager-letsencrypt-issuer",
    };
  }

  return baseAnnotations;
}

/**
 * Create TLS configuration for ingress
 */
export function createIngressTlsConfig(host: string, secretName: string) {
  return [{ hosts: [host], secretName }];
}
