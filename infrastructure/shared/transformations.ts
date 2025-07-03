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

function addHelmTimeouts(args: pulumi.ResourceTransformationArgs): pulumi.ResourceTransformationArgs {
  return {
    ...args,
    opts: { ...args.opts, customTimeouts: { create: "10m", update: "5m", delete: "3m", ...args.opts?.customTimeouts } },
  };
}

/**
 * Standard transformation that applies common labels, annotations, and timeouts.
 */
export const applyStandardTransformations: pulumi.ResourceTransformation = (args) => {
  if (!args.type.includes("kubernetes:")) return args;

  const transformedArgs = addStandardLabelsAndAnnotations(args);
  return args.type.includes("kubernetes:helm") ? addHelmTimeouts(transformedArgs) : transformedArgs;
};
