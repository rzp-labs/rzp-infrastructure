import type * as pulumi from "@pulumi/pulumi";

import { applyStandardTransformations, applyVmTransformations } from "./transformations";

/**
 * Standard resource options for Kubernetes resources.
 * Includes common transformations and timeouts.
 */
export const kubernetesResourceOptions: pulumi.ResourceOptions = {
  transformations: [applyStandardTransformations],
  customTimeouts: {
    create: "5m",
    update: "2m",
    delete: "1m",
  },
};

/**
 * Enhanced resource options for Helm charts with longer timeouts.
 */
export const helmChartResourceOptions: pulumi.ResourceOptions = {
  transformations: [applyStandardTransformations],
  customTimeouts: {
    create: "10m",
    update: "5m",
    delete: "3m",
  },
};

/**
 * Resource options for namespace creation.
 */
export const namespaceResourceOptions: pulumi.ResourceOptions = {
  transformations: [applyStandardTransformations],
  customTimeouts: {
    create: "2m",
    update: "1m",
    delete: "3m", // Longer delete timeout for namespace cleanup
  },
};

/**
 * Creates resource options with parent dependency.
 */
export function createChildResourceOptions(
  parent: pulumi.Resource,
  additionalOptions?: pulumi.ResourceOptions,
): pulumi.ResourceOptions {
  return {
    ...kubernetesResourceOptions,
    parent,
    ...additionalOptions,
  };
}

/**
 * Creates resource options for Helm charts with parent and dependencies.
 */
export function createHelmChartOptions(
  parent: pulumi.Resource,
  dependsOn?: pulumi.Resource[],
  additionalOptions?: pulumi.ComponentResourceOptions,
): pulumi.ComponentResourceOptions {
  return {
    ...helmChartResourceOptions,
    parent,
    dependsOn,
    ...additionalOptions,
  };
}

/**
 * Resource options for VM resources with VM-specific transformations.
 */
export const vmResourceOptions: pulumi.ResourceOptions = {
  transformations: [applyVmTransformations],
  customTimeouts: {
    create: "15m", // VMs can take longer to create
    update: "10m",
    delete: "5m",
  },
};

/**
 * Creates resource options for VM components with parent dependency.
 */
export function createVmResourceOptions(
  parent: pulumi.Resource,
  additionalOptions?: pulumi.ResourceOptions,
): pulumi.ResourceOptions {
  return {
    ...vmResourceOptions,
    parent,
    ...additionalOptions,
  };
}
