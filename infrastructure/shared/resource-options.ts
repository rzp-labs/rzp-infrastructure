import type * as pulumi from "@pulumi/pulumi";

import { RESOURCE_TIMEOUTS } from "./constants";
import { applyStandardTransformations, applyVmTransformations } from "./transformations";

/**
 * Standard resource options for Kubernetes resources.
 * Includes common transformations and timeouts.
 */
export const kubernetesResourceOptions: pulumi.ResourceOptions = {
  transformations: [applyStandardTransformations],
  customTimeouts: RESOURCE_TIMEOUTS.KUBERNETES,
};

/**
 * Creates resource options for Kubernetes resources with parent dependency.
 */
export function createKubernetesResourceOptions(
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
 * Enhanced resource options for Helm charts with longer timeouts.
 */
export const helmChartResourceOptions: pulumi.ResourceOptions = {
  transformations: [applyStandardTransformations],
  customTimeouts: RESOURCE_TIMEOUTS.HELM_CHART,
};

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
  customTimeouts: RESOURCE_TIMEOUTS.VM,
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

/**
 * Resource options for namespace creation.
 */
export const namespaceResourceOptions: pulumi.ResourceOptions = {
  transformations: [applyStandardTransformations],
  customTimeouts: RESOURCE_TIMEOUTS.NAMESPACE,
};
