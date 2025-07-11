import type * as pulumi from "@pulumi/pulumi";

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
