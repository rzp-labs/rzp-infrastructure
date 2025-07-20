/**
 * A component to create a ConfigMap that acts as a dependency trigger.
 * Changes to the triggers will cause the ConfigMap to be replaced, which
 * can be used to trigger rollouts in other components.
 */

import * as k8s from "@pulumi/kubernetes";
import * as pulumi from "@pulumi/pulumi";

export interface IDependencyTriggerArgs {
  readonly namespace: pulumi.Input<string>;
  readonly triggers: pulumi.Input<{ [key: string]: pulumi.Input<string> }>;
}

export class DependencyTrigger extends pulumi.ComponentResource {
  public readonly configMap: k8s.core.v1.ConfigMap;

  constructor(name: string, args: IDependencyTriggerArgs, opts?: pulumi.ComponentResourceOptions) {
    super("rzp-infra:traefik:DependencyTrigger", name, {}, opts);

    this.configMap = new k8s.core.v1.ConfigMap(
      `${name}-cm`,
      {
        metadata: {
          name: name,
          namespace: args.namespace,
        },
        data: args.triggers,
      },
      { parent: this, deleteBeforeReplace: true },
    );

    this.registerOutputs({
      configMap: this.configMap,
    });
  }
}
