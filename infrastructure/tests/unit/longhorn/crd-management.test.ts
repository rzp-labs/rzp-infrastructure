/**
 * Unit tests for Longhorn CRD Management utilities
 */

import * as k8s from "@pulumi/kubernetes";
import * as pulumi from "@pulumi/pulumi";

import { createDeletingConfirmationFlagJob } from "../../../helpers/longhorn/crd-management";

// Mock Pulumi for testing
void pulumi.runtime.setMocks({
  newResource: (args: pulumi.runtime.MockResourceArgs): { id: string; state: Record<string, unknown> } => {
    const inputs = args.inputs as Record<string, unknown>;
    const metadata = (inputs.metadata as Record<string, unknown>) ?? {};

    return {
      id: `${args.name}-id`,
      state: {
        ...inputs,
        metadata: {
          ...metadata,
          name: metadata.name ?? args.name,
        },
      },
    };
  },
  call: (args: pulumi.runtime.MockCallArgs): pulumi.runtime.MockCallResult => {
    return { outputs: args.inputs as Record<string, unknown> };
  },
});

describe("Longhorn CRD Management", () => {
  describe("createDeletingConfirmationFlagJob", () => {
    it("should create a CustomResource for the setting", () => {
      const setting = createDeletingConfirmationFlagJob("test-longhorn", "longhorn-system");

      // Verify the returned object is a CustomResource
      expect(setting).toBeInstanceOf(k8s.apiextensions.CustomResource);
    });

    it("should have the correct API version and kind", (done) => {
      const setting = createDeletingConfirmationFlagJob("test-longhorn", "longhorn-system");

      pulumi.all([setting.apiVersion, setting.kind]).apply(([apiVersion, kind]) => {
        expect(apiVersion).toBe("longhorn.io/v1beta2");
        expect(kind).toBe("Setting");
        done();
      });
    });

    it("should have the correct name and value", (done) => {
      const setting = createDeletingConfirmationFlagJob("test-longhorn", "longhorn-system");

      pulumi.all([setting.metadata, (setting as any).value]).apply(([metadata, value]) => {
        expect(metadata.name).toBe("deleting-confirmation-flag");
        expect(value).toBe("true");
        done();
      });
    });

    it("should be created in the correct namespace", (done) => {
      const namespace = "my-longhorn-ns";
      const setting = createDeletingConfirmationFlagJob("test-longhorn", namespace);

      setting.metadata.apply((metadata) => {
        expect(metadata.namespace).toBe(namespace);
        done();
      });
    });
  });
});
