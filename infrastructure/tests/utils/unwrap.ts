import * as pulumi from "@pulumi/pulumi";

/**
 * Helper to resolve Pulumi `Output` / `Input` values during unit tests so we
 * can assert on their underlying data without disabling TypeScript linting.
 */
export async function unwrap<T = any>(value: pulumi.Input<T> | pulumi.Output<T> | T): Promise<T> {
  // Pulumi encodes `Output` objects as having the special
  // `__pulumiOutput` symbol – but the public guard is easier.
  if (pulumi.Output.isInstance(value)) {
    return new Promise<T>((resolve) => {
      pulumi.output(value).apply((v: T) => {
        resolve(v);
        return v;
      });
    });
  }
  return value as T;
}
