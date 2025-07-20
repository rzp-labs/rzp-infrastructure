import * as k8s from "@pulumi/kubernetes";
import * as pulumi from "@pulumi/pulumi";

import type { Environment } from "../../shared/types";

/**
 * Infisical Component
 *
 * Opinionated Infisical secrets management component for homelab Kubernetes clusters.
 * Provides secure storage, access control, and audit capabilities for application secrets.
 * Integrates with existing infrastructure components including cert-manager, Traefik, and Longhorn.
 */

export interface IInfisicalArgs {
  readonly namespace: string;
  readonly environment: Environment;
  readonly domain: string;
  readonly postgresqlChartVersion?: string;
  readonly redisChartVersion?: string;
  readonly databaseConfig: {
    readonly storageSize?: string; // Optional - will be set based on environment
    readonly storageClass?: string;
    readonly username: string;
    readonly password: pulumi.Input<string>;
    readonly database: string;
  };
  readonly redisConfig?: {
    readonly storageSize?: string;
    readonly storageClass?: string;
    readonly password?: pulumi.Input<string>;
  };
  readonly infisicalConfig: {
    readonly authSecret: pulumi.Input<string>;
    readonly encryptionKey: pulumi.Input<string>;
    readonly adminEmail: string;
    readonly adminPassword: pulumi.Input<string>;
    readonly siteUrl: string;
  };
}

export class InfisicalComponent extends pulumi.ComponentResource {
  public readonly namespace: k8s.core.v1.Namespace;
  public readonly postgresqlChart: k8s.helm.v3.Chart;
  public readonly redisChart?: k8s.helm.v3.Chart;
  public readonly applicationSecret: k8s.core.v1.Secret;
  public readonly infisicalDeployment: k8s.apps.v1.Deployment;
  public readonly infisicalService: k8s.core.v1.Service;
  public readonly ingress: k8s.networking.v1.Ingress;
  public readonly serviceAccount: k8s.core.v1.ServiceAccount;
  public readonly role: k8s.rbac.v1.Role;
  public readonly roleBinding: k8s.rbac.v1.RoleBinding;
  public readonly helmValuesOutput: pulumi.Output<string>;

  constructor(name: string, args: IInfisicalArgs, opts?: pulumi.ComponentResourceOptions) {
    super("rzp-infra:infisical:Component", name, {}, opts);

    // Create storage class for staging environment with Delete reclaim policy
    const storageClass =
      args.environment === "stg"
        ? new k8s.storage.v1.StorageClass(
            `${name}-staging-storage`,
            {
              metadata: {
                name: `longhorn-${args.environment}`,
                labels: {
                  "app.kubernetes.io/name": "infisical",
                  "app.kubernetes.io/managed-by": "pulumi",
                  "app.kubernetes.io/component": "storage",
                },
              },
              provisioner: "driver.longhorn.io",
              reclaimPolicy: "Delete", // Auto-cleanup volumes in staging
              volumeBindingMode: "Immediate",
              parameters: {
                numberOfReplicas: "1", // Single replica for staging to save space
                staleReplicaTimeout: "30",
                fromBackup: "",
                fsType: "ext4",
              },
            },
            { parent: this },
          )
        : undefined;

    // Create namespace with Infisical labels
    this.namespace = new k8s.core.v1.Namespace(
      `${args.namespace}`,
      {
        metadata: {
          name: args.namespace,
          labels: {
            "app.kubernetes.io/name": "infisical",
            "app.kubernetes.io/managed-by": "pulumi",
            "app.kubernetes.io/component": "secrets-management",
          },
        },
      },
      { parent: this },
    );

    // Determine storage size based on environment
    const getStorageSize = (configSize?: string): string => {
      if (configSize !== undefined && configSize !== "") return configSize;

      switch (args.environment) {
        case "stg":
          return "512Mi"; // Ultra-small size for staging due to severe disk pressure
        case "prd":
          return "10Gi";
        case "dev":
          return "1Gi";
        default:
          return "2Gi";
      }
    };

    // Note: Reclaim policy is handled in the storage class creation

    // Deploy PostgreSQL using bitnami chart
    const postgresqlValues = {
      auth: {
        username: args.databaseConfig.username,
        password: args.databaseConfig.password,
        database: args.databaseConfig.database,
      },
      primary: {
        persistence: {
          enabled: args.environment !== "stg", // Disable persistence for staging due to disk constraints
          size: getStorageSize(args.databaseConfig.storageSize),
          storageClass:
            args.databaseConfig.storageClass ??
            (args.environment === "stg" ? `longhorn-${args.environment}` : "longhorn"),
          // Add reclaim policy for proper volume lifecycle management
          annotations: {
            "volume.kubernetes.io/storage-provisioner": "driver.longhorn.io",
          },
        },
        resources: {
          requests: {
            cpu: "100m",
            memory: "512Mi", // Increased from 256Mi
          },
          limits: {
            cpu: "500m",
            memory: "1Gi", // Increased from 512Mi to give more headroom
          },
        },
        // PostgreSQL configuration optimized for low-resource staging environments
        // Use default PostgreSQL configuration to avoid startup issues
        // Increase startup timeout for resource-constrained environments
        // Use default probe settings to avoid startup issues
      },
      metrics: {
        enabled: false, // Keep it simple for homelab
      },
    };

    this.postgresqlChart = new k8s.helm.v3.Chart(
      `${name}-postgresql`,
      {
        chart: "postgresql",
        fetchOpts: { repo: "https://charts.bitnami.com/bitnami" },
        version: args.postgresqlChartVersion ?? "15.5.32",
        namespace: this.namespace.metadata.name,
        values: postgresqlValues,
      },
      { parent: this, dependsOn: [this.namespace, ...(storageClass ? [storageClass] : [])] },
    );

    // Create explicit dependency on PostgreSQL StatefulSet readiness
    // Note: Removed StatefulSet import dependency to avoid circular references
    // The init container will handle waiting for PostgreSQL readiness at runtime

    // Deploy Redis using bitnami chart (if configured)
    if (args.redisConfig) {
      const getRedisStorageSize = (configSize?: string): string => {
        if (configSize !== undefined && configSize !== "") return configSize;

        switch (args.environment) {
          case "stg":
            return "512Mi"; // Very small for staging
          case "prd":
            return "2Gi";
          case "dev":
            return "256Mi";
          default:
            return "512Mi";
        }
      };

      const redisValues = {
        auth: {
          enabled: true,
          password: args.redisConfig.password ?? pulumi.secret("redis-default-password"),
        },
        master: {
          persistence: {
            enabled: args.redisConfig.storageSize !== undefined,
            size: getRedisStorageSize(args.redisConfig.storageSize),
            storageClass:
              args.redisConfig.storageClass ??
              (args.environment === "stg" ? `longhorn-${args.environment}` : "longhorn"),
          },
          resources: {
            requests: {
              cpu: "50m",
              memory: "64Mi",
            },
            limits: {
              cpu: "200m",
              memory: "256Mi",
            },
          },
          // Redis configuration optimized for low-memory environments
          configuration: `
# Memory optimization for staging
maxmemory 200mb
maxmemory-policy allkeys-lru
save ""
# Disable background saves to reduce memory pressure
`,
          livenessProbe: {
            enabled: true,
            initialDelaySeconds: 30,
            periodSeconds: 30,
            timeoutSeconds: 5,
            failureThreshold: 3,
          },
          readinessProbe: {
            enabled: true,
            initialDelaySeconds: 15,
            periodSeconds: 10,
            timeoutSeconds: 3,
            failureThreshold: 3,
          },
        },
        replica: {
          replicaCount: 0, // Single instance for homelab
        },
        metrics: {
          enabled: false, // Keep it simple for homelab
        },
      };

      this.redisChart = new k8s.helm.v3.Chart(
        `${name}-redis`,
        {
          chart: "redis",
          fetchOpts: { repo: "https://charts.bitnami.com/bitnami" },
          version: args.redisChartVersion ?? "19.6.4",
          namespace: this.namespace.metadata.name,
          values: redisValues,
        },
        { parent: this, dependsOn: [this.namespace, ...(storageClass ? [storageClass] : [])] },
      );

      // Note: Removed Redis StatefulSet import dependency to avoid circular references
      // The init container will handle waiting for Redis readiness at runtime
    }

    // Create dedicated service account for Infisical with minimal permissions
    this.serviceAccount = new k8s.core.v1.ServiceAccount(
      `${name}-service-account`,
      {
        metadata: {
          name: "infisical",
          namespace: this.namespace.metadata.name,
          labels: {
            "app.kubernetes.io/name": "infisical",
            "app.kubernetes.io/managed-by": "pulumi",
            "app.kubernetes.io/component": "service-account",
          },
        },
        automountServiceAccountToken: true,
      },
      { parent: this, dependsOn: [this.namespace] },
    );

    // Create minimal role for Infisical - only what it needs for secrets management
    this.role = new k8s.rbac.v1.Role(
      `${name}-role`,
      {
        metadata: {
          name: "infisical",
          namespace: this.namespace.metadata.name,
          labels: {
            "app.kubernetes.io/name": "infisical",
            "app.kubernetes.io/managed-by": "pulumi",
            "app.kubernetes.io/component": "rbac",
          },
        },
        rules: [
          {
            apiGroups: [""],
            resources: ["secrets"],
            verbs: ["get", "list", "watch", "create", "update", "patch", "delete"],
          },
          {
            apiGroups: [""],
            resources: ["configmaps"],
            verbs: ["get", "list", "watch"],
          },
          {
            apiGroups: [""],
            resources: ["serviceaccounts"],
            verbs: ["get", "list", "watch"],
          },
        ],
      },
      { parent: this, dependsOn: [this.namespace] },
    );

    // Create role binding to associate service account with role
    this.roleBinding = new k8s.rbac.v1.RoleBinding(
      `${name}-role-binding`,
      {
        metadata: {
          name: "infisical",
          namespace: this.namespace.metadata.name,
          labels: {
            "app.kubernetes.io/name": "infisical",
            "app.kubernetes.io/managed-by": "pulumi",
            "app.kubernetes.io/component": "rbac",
          },
        },
        subjects: [
          {
            kind: "ServiceAccount",
            name: this.serviceAccount.metadata.name,
            namespace: this.namespace.metadata.name,
          },
        ],
        roleRef: {
          kind: "Role",
          name: this.role.metadata.name,
          apiGroup: "rbac.authorization.k8s.io",
        },
      },
      { parent: this, dependsOn: [this.serviceAccount, this.role] },
    );

    // Create application secrets for Infisical
    this.applicationSecret = new k8s.core.v1.Secret(
      `${name}-app-secret`,
      {
        metadata: {
          name: "infisical-app-secret",
          namespace: this.namespace.metadata.name,
          labels: {
            "app.kubernetes.io/name": "infisical",
            "app.kubernetes.io/managed-by": "pulumi",
            "app.kubernetes.io/component": "application-secret",
          },
        },
        type: "Opaque",
        stringData: {
          AUTH_SECRET: args.infisicalConfig.authSecret,
          ENCRYPTION_KEY: args.infisicalConfig.encryptionKey,
          ADMIN_EMAIL: args.infisicalConfig.adminEmail,
          ADMIN_PASSWORD: args.infisicalConfig.adminPassword,
          SITE_URL: args.infisicalConfig.siteUrl,
        },
      },
      { parent: this, dependsOn: [this.namespace] },
    );

    // Build database connection string
    const dbConnectionString = pulumi.interpolate`postgresql://${args.databaseConfig.username}:${args.databaseConfig.password}@${name}-postgresql:5432/${args.databaseConfig.database}`;

    // Build Redis connection string (if configured)
    const redisConnectionString = args.redisConfig
      ? pulumi.interpolate`redis://:${args.redisConfig.password ?? "redis-default-password"}@${name}-redis-master:6379`
      : undefined;

    // Deploy Infisical application
    this.infisicalDeployment = new k8s.apps.v1.Deployment(
      `${name}-infisical`,
      {
        metadata: {
          name: "infisical",
          namespace: this.namespace.metadata.name,
          labels: {
            "app.kubernetes.io/name": "infisical",
            "app.kubernetes.io/managed-by": "pulumi",
            "app.kubernetes.io/component": "application",
          },
        },
        spec: {
          replicas: 1,
          selector: {
            matchLabels: {
              app: "infisical",
            },
          },
          template: {
            metadata: {
              labels: {
                app: "infisical",
              },
            },
            spec: {
              serviceAccountName: this.serviceAccount.metadata.name,
              initContainers: [
                {
                  name: "wait-for-db",
                  image: "postgres:15-alpine",
                  command: ["sh", "-c"],
                  args: [
                    `until pg_isready -h ${name}-postgresql -p 5432 -U ${args.databaseConfig.username}; do
                       echo "Waiting for PostgreSQL to be ready..."
                       sleep 5
                     done
                     echo "PostgreSQL is ready!"`,
                  ],
                  resources: {
                    requests: {
                      cpu: "10m",
                      memory: "32Mi",
                    },
                    limits: {
                      cpu: "100m",
                      memory: "128Mi",
                    },
                  },
                },
              ],
              containers: [
                {
                  name: "infisical",
                  image: "infisical/infisical:latest-postgres",
                  ports: [{ containerPort: 8080 }],
                  env: [
                    {
                      name: "DB_CONNECTION_URI",
                      value: dbConnectionString,
                    },
                    ...(redisConnectionString
                      ? [
                          {
                            name: "REDIS_URL",
                            value: redisConnectionString,
                          },
                        ]
                      : []),
                    {
                      name: "AUTH_SECRET",
                      valueFrom: {
                        secretKeyRef: {
                          name: this.applicationSecret.metadata.name,
                          key: "AUTH_SECRET",
                        },
                      },
                    },
                    {
                      name: "ENCRYPTION_KEY",
                      valueFrom: {
                        secretKeyRef: {
                          name: this.applicationSecret.metadata.name,
                          key: "ENCRYPTION_KEY",
                        },
                      },
                    },
                    {
                      name: "SITE_URL",
                      valueFrom: {
                        secretKeyRef: {
                          name: this.applicationSecret.metadata.name,
                          key: "SITE_URL",
                        },
                      },
                    },
                  ],
                  resources: {
                    requests: {
                      cpu: "100m",
                      memory: "512Mi",
                    },
                    limits: {
                      cpu: "500m",
                      memory: "1Gi",
                    },
                  },
                  readinessProbe: {
                    httpGet: {
                      path: "/api/status",
                      port: 8080,
                    },
                    initialDelaySeconds: 30,
                    periodSeconds: 10,
                  },
                  livenessProbe: {
                    httpGet: {
                      path: "/api/status",
                      port: 8080,
                    },
                    initialDelaySeconds: 60,
                    periodSeconds: 30,
                  },
                },
              ],
            },
          },
        },
      },
      {
        parent: this,
        dependsOn: [
          this.postgresqlChart,
          this.applicationSecret,
          this.serviceAccount,
          this.roleBinding,
          ...(this.redisChart ? [this.redisChart] : []),
        ],
      },
    );

    // Create service for Infisical
    this.infisicalService = new k8s.core.v1.Service(
      `${name}-service`,
      {
        metadata: {
          name: "infisical",
          namespace: this.namespace.metadata.name,
          labels: {
            "app.kubernetes.io/name": "infisical",
            "app.kubernetes.io/managed-by": "pulumi",
            "app.kubernetes.io/component": "service",
          },
        },
        spec: {
          selector: {
            app: "infisical",
          },
          ports: [
            {
              port: 8080,
              targetPort: 8080,
              name: "http",
            },
          ],
          type: "ClusterIP",
        },
      },
      { parent: this, dependsOn: [this.infisicalDeployment] },
    );

    // Create Traefik ingress for Infisical
    this.ingress = new k8s.networking.v1.Ingress(
      `${name}-ingress`,
      {
        metadata: {
          name: "infisical-ingress",
          namespace: this.namespace.metadata.name,
          annotations: {
            "kubernetes.io/ingress.class": "traefik",
            "traefik.ingress.kubernetes.io/router.entrypoints": "websecure",
            "traefik.ingress.kubernetes.io/router.tls": "true",
            "cert-manager.io/cluster-issuer": `letsencrypt-${args.environment}`,
          },
        },
        spec: {
          rules: [
            {
              host: args.domain,
              http: {
                paths: [
                  {
                    path: "/",
                    pathType: "Prefix",
                    backend: {
                      service: {
                        name: "infisical",
                        port: { number: 8080 },
                      },
                    },
                  },
                ],
              },
            },
          ],
          tls: [
            {
              hosts: [args.domain],
              secretName: "infisical-tls",
            },
          ],
        },
      },
      { parent: this, dependsOn: [this.infisicalService] },
    );

    // Expose helm values as output for ArgoCD applications
    const helmValues = {
      postgresql: postgresqlValues,
      ...(args.redisConfig && this.redisChart && { redis: "redis-chart-configured" }),
      infisical: {
        domain: args.domain,
        environment: args.environment,
      },
    };

    this.helmValuesOutput = pulumi.output(JSON.stringify(helmValues));

    // Register outputs
    this.registerOutputs({
      namespace: this.namespace,
      postgresqlChart: this.postgresqlChart,
      redisChart: this.redisChart,
      applicationSecret: this.applicationSecret,
      infisicalDeployment: this.infisicalDeployment,
      infisicalService: this.infisicalService,
      ingress: this.ingress,
      serviceAccount: this.serviceAccount,
      role: this.role,
      roleBinding: this.roleBinding,
      helmValuesOutput: this.helmValuesOutput,
    });
  }
}
