import type * as pulumi from "@pulumi/pulumi";

function addStandardLabelsAndAnnotations(args: pulumi.ResourceTransformationArgs): pulumi.ResourceTransformationArgs {
  const metadata = args.props.metadata as Record<string, unknown> | undefined;
  const labels = metadata?.labels as Record<string, string> | undefined;
  const annotations = metadata?.annotations as Record<string, string> | undefined;

  return {
    ...args,
    props: {
      ...args.props,
      metadata: {
        ...metadata,
        labels: { ...labels, "managed-by": "pulumi", environment: "staging", "infrastructure.rzp.one/managed": "true" },
        annotations: { ...annotations, "pulumi.com/autoNaming": "true" },
      },
    },
  };
}

/**
 * VM transformation that applies common VM tags and settings.
 */
export const applyVmTransformations: pulumi.ResourceTransformation = (args) => {
  // Only apply to Proxmox VM resources
  if (!args.type.includes("proxmoxve:vm/virtualMachine:VirtualMachine")) {
    return args;
  }

  const vmProps = args.props as Record<string, unknown>;
  const existingTags = vmProps.tags as string[] | undefined;

  return {
    ...args,
    props: {
      ...vmProps,
      tags: [...(existingTags ?? []), "managed-by-pulumi", "infrastructure-rzp-one"],
      // Ensure consistent VM state defaults
      template: vmProps.template ?? false,
      onBoot: vmProps.onBoot ?? true,
    },
  };
};

/**
 * Standard transformation that applies common labels and annotations.
 */
export const applyStandardTransformations: pulumi.ResourceTransformation = (args) => {
  if (!args.type.includes("kubernetes:")) return args;

  return addStandardLabelsAndAnnotations(args);
};
