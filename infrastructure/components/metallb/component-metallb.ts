import * as k8s from "@pulumi/kubernetes";
import * as pulumi from "@pulumi/pulumi";

/**
 * MetalLB Component
 *
 * Opinionated MetalLB load balancer component for homelab Kubernetes clusters.
 * Provides Layer 2 load balancing with configurable IP pools and production-ready defaults.
 */

export interface IMetalLBArgs {
  readonly namespace: string;
  readonly chartVersion: string;
  readonly environment: "dev" | "stg" | "prd";
  readonly ipRange: string;
}

export class MetalLBComponent extends pulumi.ComponentResource {
  public readonly namespace: k8s.core.v1.Namespace;
  public readonly chart: k8s.helm.v3.Chart;
  public readonly ipPool: k8s.apiextensions.CustomResource;
  public readonly l2Advertisement: k8s.apiextensions.CustomResource;
  public readonly helmValuesOutput: pulumi.Output<string>;

  constructor(name: string, args: IMetalLBArgs, opts?: pulumi.ComponentResourceOptions) {
    super("rzp-infra:metallb:Component", name, {}, opts);

    // Create namespace with security labels for privileged MetalLB
    this.namespace = new k8s.core.v1.Namespace(
      `${name}-namespace`,
      {
        metadata: {
          name: args.namespace,
          labels: {
            "app.kubernetes.io/name": "metallb",
            "app.kubernetes.io/managed-by": "pulumi",
            "app.kubernetes.io/component": "load-balancer",
            "pod-security.kubernetes.io/enforce": "privileged",
            "pod-security.kubernetes.io/audit": "privileged",
            "pod-security.kubernetes.io/warn": "privileged",
          },
        },
      },
      { parent: this },
    );

    // Build opinionated Helm values
    const helmValues = {
      // Controller - single replica with security
      controller: {
        enabled: true,
        resources: {
          requests: { cpu: "100m", memory: "128Mi" },
          limits: { cpu: "200m", memory: "256Mi" },
        },
        securityContext: {
          runAsNonRoot: true,
          runAsUser: 65534,
          fsGroup: 65534,
          allowPrivilegeEscalation: false,
          readOnlyRootFilesystem: true,
          capabilities: { drop: ["ALL"] },
        },
      },
      // Speaker - with control plane tolerations
      speaker: {
        enabled: true,
        resources: {
          requests: { cpu: "100m", memory: "128Mi" },
          limits: { cpu: "200m", memory: "256Mi" },
        },
        securityContext: {
          allowPrivilegeEscalation: false,
          readOnlyRootFilesystem: true,
          capabilities: { drop: ["ALL"], add: ["NET_RAW"] },
        },
        tolerations: [
          {
            key: "node-role.kubernetes.io/control-plane",
            operator: "Exists",
            effect: "NoSchedule",
          },
          {
            key: "node-role.kubernetes.io/master",
            operator: "Exists",
            effect: "NoSchedule",
          },
        ],
      },
      // Webhook - minimal resources
      webhook: {
        enabled: true,
        resources: {
          requests: { cpu: "50m", memory: "64Mi" },
          limits: { cpu: "100m", memory: "128Mi" },
        },
        securityContext: {
          runAsNonRoot: true,
          runAsUser: 65534,
          fsGroup: 65534,
          allowPrivilegeEscalation: false,
          readOnlyRootFilesystem: true,
          capabilities: { drop: ["ALL"] },
        },
      },
    };

    // Expose helm values as output for ArgoCD applications
    this.helmValuesOutput = pulumi.output(JSON.stringify(helmValues));

    // Deploy MetalLB with opinionated homelab configuration
    this.chart = new k8s.helm.v3.Chart(
      `${name}-chart`,
      {
        chart: "metallb",
        fetchOpts: { repo: "https://metallb.github.io/metallb" },
        version: args.chartVersion,
        namespace: this.namespace.metadata.name,
        values: helmValues,
      },
      { parent: this, dependsOn: [this.namespace] },
    );

    // Wait for MetalLB webhook to be ready before creating IP pool
    const webhookReadiness = new k8s.batch.v1.Job(
      `${name}-webhook-readiness`,
      {
        metadata: {
          name: `${name}-webhook-readiness`,
          namespace: this.namespace.metadata.name,
          generateName: `${name}-webhook-readiness-`,
        },
        spec: {
          ttlSecondsAfterFinished: 300, // Clean up after 5 minutes
          template: {
            spec: {
              restartPolicy: "Never",
              containers: [
                {
                  name: "webhook-readiness",
                  image: "curlimages/curl:7.86.0",
                  command: [
                    "sh",
                    "-c",
                    "until curl -k https://metallb-webhook-service.metallb-system.svc:443/healthz; do echo 'Waiting for webhook...'; sleep 5; done; echo 'Webhook ready'",
                  ],
                },
              ],
            },
          },
        },
      },
      {
        parent: this,
        dependsOn: [this.chart],
        replaceOnChanges: ["*"], // Force recreation on any change
      },
    );

    // Create IP pool for homelab load balancing
    this.ipPool = new k8s.apiextensions.CustomResource(
      `${name}-ip-pool`,
      {
        apiVersion: "metallb.io/v1beta1",
        kind: "IPAddressPool",
        metadata: {
          name: `${args.environment}-ip-pool`,
          namespace: this.namespace.metadata.name,
          labels: {
            "app.kubernetes.io/name": "metallb",
            "app.kubernetes.io/managed-by": "pulumi",
            "app.kubernetes.io/component": "ip-pool",
          },
        },
        spec: {
          addresses: [args.ipRange],
        },
      },
      { parent: this, dependsOn: [webhookReadiness] },
    );

    // Create L2 advertisement for Layer 2 mode
    this.l2Advertisement = new k8s.apiextensions.CustomResource(
      `${name}-l2-advertisement`,
      {
        apiVersion: "metallb.io/v1beta1",
        kind: "L2Advertisement",
        metadata: {
          name: `${args.environment}-l2-advertisement`,
          namespace: this.namespace.metadata.name,
          labels: {
            "app.kubernetes.io/name": "metallb",
            "app.kubernetes.io/managed-by": "pulumi",
            "app.kubernetes.io/component": "l2-advertisement",
          },
        },
        spec: {
          ipAddressPools: [pulumi.interpolate`${this.ipPool.metadata.name}`],
        },
      },
      { parent: this, dependsOn: [this.ipPool] },
    );

    // Register outputs
    this.registerOutputs({
      namespace: this.namespace,
      chart: this.chart,
      ipPool: this.ipPool,
      l2Advertisement: this.l2Advertisement,
      helmValuesOutput: this.helmValuesOutput,
    });
  }
}
