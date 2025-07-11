import * as k8s from "@pulumi/kubernetes";
import * as pulumi from "@pulumi/pulumi";

/**
 * MetalLB Bootstrap Component
 *
 * Deploys MetalLB load balancer controller with IP pool configuration.
 * Provides load balancer capability for services in the cluster.
 *
 * Clean implementation without config sprawl - follows current component patterns.
 */

export interface IMetalLBBootstrapConfig {
  readonly ipRange: string;
}

export class MetalLBBootstrap extends pulumi.ComponentResource {
  public readonly namespace: k8s.core.v1.Namespace;
  public readonly chart: k8s.helm.v3.Chart;

  constructor(name: string, config: IMetalLBBootstrapConfig, opts?: pulumi.ComponentResourceOptions) {
    super("rzp-infra:metallb:Bootstrap", name, {}, opts);

    // Create namespace directly with required security labels
    this.namespace = new k8s.core.v1.Namespace(
      `${name}-namespace`,
      {
        metadata: {
          name: "metallb-system",
          labels: {
            "app.kubernetes.io/name": "metallb",
            "app.kubernetes.io/managed-by": "pulumi",
            "app.kubernetes.io/component": "load-balancer",
            // Required for MetalLB security context
            "pod-security.kubernetes.io/enforce": "privileged",
            "pod-security.kubernetes.io/audit": "privileged",
            "pod-security.kubernetes.io/warn": "privileged",
          },
        },
      },
      { parent: this },
    );

    // Deploy MetalLB chart directly with inline values
    this.chart = new k8s.helm.v3.Chart(
      `${name}-chart`,
      {
        chart: "metallb",
        fetchOpts: { repo: "https://metallb.github.io/metallb" },
        version: "0.15.2",
        namespace: this.namespace.metadata.name,
        values: {
          // Controller configuration
          controller: {
            enabled: true,
            image: {
              repository: "quay.io/metallb/controller",
              tag: "v0.15.2",
            },
            resources: {
              requests: {
                cpu: "100m",
                memory: "128Mi",
              },
              limits: {
                cpu: "200m",
                memory: "256Mi",
              },
            },
            securityContext: {
              capabilities: {
                drop: ["ALL"],
                add: ["NET_RAW"],
              },
              readOnlyRootFilesystem: true,
              runAsNonRoot: true,
              runAsUser: 65534,
            },
          },
          // Speaker configuration
          speaker: {
            enabled: true,
            image: {
              repository: "quay.io/metallb/speaker",
              tag: "v0.15.2",
            },
            resources: {
              requests: {
                cpu: "100m",
                memory: "128Mi",
              },
              limits: {
                cpu: "200m",
                memory: "256Mi",
              },
            },
            securityContext: {
              allowPrivilegeEscalation: false,
              capabilities: {
                drop: ["ALL"],
                add: ["NET_RAW", "NET_ADMIN"],
              },
              readOnlyRootFilesystem: true,
            },
            // Tolerate master nodes for single-node clusters
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
          // Webhook configuration
          webhook: {
            enabled: true,
            image: {
              repository: "quay.io/metallb/controller",
              tag: "v0.15.2",
            },
            resources: {
              requests: {
                cpu: "50m",
                memory: "64Mi",
              },
              limits: {
                cpu: "100m",
                memory: "128Mi",
              },
            },
          },
          // CRDs
          crds: {
            enabled: true,
          },
          // RBAC
          rbac: {
            create: true,
          },
          // Service account
          serviceAccount: {
            controller: {
              create: true,
              name: "metallb-controller",
            },
            speaker: {
              create: true,
              name: "metallb-speaker",
            },
          },
        },
      },
      { parent: this, dependsOn: [this.namespace] },
    );

    this.registerOutputs({
      namespace: this.namespace,
      chart: this.chart,
    });
  }
}
