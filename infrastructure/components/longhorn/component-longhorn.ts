import * as k8s from "@pulumi/kubernetes";
import type { Output } from "@pulumi/pulumi";
import * as pulumi from "@pulumi/pulumi";
import * as bcrypt from "bcryptjs";

import { createDeletingConfirmationFlagJob } from "../../helpers/longhorn/crd-management";
import {
  DeploymentMonitor,
  DeploymentPhase,
  type IDeploymentMonitoringConfig,
  createDeploymentMonitoringJob,
  createDeploymentStatusConfigMap,
} from "../../helpers/longhorn/deployment-monitoring";
import { type IDiskProvisioningResources, createDiskProvisioningJob } from "../../helpers/longhorn/disk-provisioning";
import {
  type IPrerequisiteValidationResources,
  createPrerequisiteValidation,
} from "../../helpers/longhorn/prerequisite-validation";
import { type IUninstallerRbacResources, createUninstallerRbac } from "../../helpers/longhorn/uninstaller-rbac";
import { type IVolumeCleanupResources, createVolumeCleanup } from "../../helpers/longhorn/volume-cleanup";
import type { Environment } from "../../shared/types";

/**
 * Longhorn Component
 *
 * Opinionated Longhorn distributed storage component for homelab Kubernetes clusters.
 * Provides persistent volume management with backup and high availability capabilities.
 */

export interface ILonghornArgs {
  readonly namespace: string;
  readonly chartVersion: string;
  readonly environment: Environment;
  readonly domain: string;
  readonly defaultStorageClass: boolean;
  readonly replicaCount: number;
  readonly adminPassword: pulumi.Input<string>;
  readonly backupTarget?: string;
  readonly s3BackupConfig?: {
    bucket: string;
    region: string;
    accessKeyId: pulumi.Input<string>;
    secretAccessKey: pulumi.Input<string>;
    endpoint?: string;
  };
  // New options for uninstaller management
  readonly enableUninstallerRbac?: boolean;
  readonly uninstallerTimeoutSeconds?: number;
  readonly validatePrerequisites?: boolean;
  // Enhanced error handling and monitoring options
  readonly enableDeploymentMonitoring?: boolean;
  readonly deploymentTimeoutSeconds?: number;
  readonly maxRetries?: number;
  readonly enableStatusTracking?: boolean;
  // Disk provisioning automation options
  readonly enableDiskProvisioning?: boolean;
  readonly diskPath?: string;
  readonly storageReservedGb?: number;
  readonly diskProvisioningTimeoutSeconds?: number;
  readonly diskProvisioningRetryAttempts?: number;
  // Volume cleanup automation options
  readonly enableVolumeCleanup?: boolean;
  readonly volumeCleanupIntervalMinutes?: number;
  readonly maxVolumeAgeHours?: number;
}

export class LonghornComponent extends pulumi.ComponentResource {
  public readonly namespace: k8s.core.v1.Namespace;
  public readonly chart: k8s.helm.v3.Chart;
  public readonly backupSecret?: k8s.core.v1.Secret;
  public readonly ingress: k8s.networking.v1.Ingress;
  public readonly authMiddleware: k8s.apiextensions.CustomResource;
  public readonly wsHeadersMiddleware: k8s.apiextensions.CustomResource;
  public readonly authSecret: k8s.core.v1.Secret;
  public readonly helmValuesOutput: Output<string>;
  public readonly uninstallerRbac?: IUninstallerRbacResources;
  public readonly deletingConfirmationFlag: k8s.apiextensions.CustomResource;
  public readonly prerequisiteValidation?: IPrerequisiteValidationResources;
  public readonly deploymentMonitor?: DeploymentMonitor;
  public readonly statusConfigMap?: k8s.core.v1.ConfigMap;
  public readonly monitoringJob?: k8s.batch.v1.Job;
  public readonly diskProvisioning?: IDiskProvisioningResources;
  public readonly volumeCleanup?: IVolumeCleanupResources;

  constructor(name: string, args: ILonghornArgs, opts?: pulumi.ComponentResourceOptions) {
    super("rzp-infra:longhorn:Component", name, {}, opts);

    // Initialize deployment monitoring if enabled (default: true)
    if (args.enableDeploymentMonitoring !== false) {
      const monitoringConfig: IDeploymentMonitoringConfig = {
        componentName: name,
        namespace: args.namespace,
        timeoutSeconds: args.deploymentTimeoutSeconds ?? 1800, // 30 minutes default
        maxRetries: args.maxRetries ?? 3,
        enableStatusTracking: args.enableStatusTracking !== false,
        enableMetrics: true,
        statusUpdateCallback: (status) => {
          // Log deployment status updates
          // eslint-disable-next-line no-console
          console.log(`[${name}] Deployment Status: ${status.phase} - ${status.message}`);
        },
      };

      this.deploymentMonitor = new DeploymentMonitor(monitoringConfig);

      // Update status to initializing phase
      this.deploymentMonitor.updateStatus({
        phase: DeploymentPhase.INITIALIZING,
        message: "Starting Longhorn component deployment",
        timestamp: new Date(),
        retryCount: 0,
        componentName: name,
        namespace: args.namespace,
      });
    }

    // Create namespace with Longhorn security labels
    this.namespace = new k8s.core.v1.Namespace(
      `${args.namespace}`,
      {
        metadata: {
          name: args.namespace,
          labels: {
            "app.kubernetes.io/name": "longhorn",
            "app.kubernetes.io/managed-by": "pulumi",
            "app.kubernetes.io/component": "distributed-storage",
            "pod-security.kubernetes.io/enforce": "privileged",
            "pod-security.kubernetes.io/audit": "privileged",
            "pod-security.kubernetes.io/warn": "privileged",
          },
        },
      },
      { parent: this },
    );

    // Update deployment status to RBAC setup phase
    if (this.deploymentMonitor) {
      this.deploymentMonitor.updateStatus({
        phase: DeploymentPhase.RBAC_SETUP,
        message: "Setting up RBAC resources for uninstaller operations",
        timestamp: new Date(),
        retryCount: 0,
        componentName: name,
        namespace: args.namespace,
      });
    }

    // Create uninstaller RBAC resources if enabled (default: true)
    if (args.enableUninstallerRbac !== false) {
      this.uninstallerRbac = createUninstallerRbac(
        {
          componentName: name,
          namespace: args.namespace,
          timeoutSeconds: args.uninstallerTimeoutSeconds,
        },
        { parent: this, dependsOn: [this.namespace] },
      );
    }

    // Create S3 backup secret if S3 config provided
    if (args.s3BackupConfig) {
      this.backupSecret = new k8s.core.v1.Secret(
        `${name}-s3-secret`,
        {
          metadata: {
            name: "longhorn-s3-secret",
            namespace: this.namespace.metadata.name,
            labels: {
              "app.kubernetes.io/name": "longhorn",
              "app.kubernetes.io/managed-by": "pulumi",
              "app.kubernetes.io/component": "backup-secret",
            },
          },
          type: "Opaque",
          stringData: {
            AWS_ACCESS_KEY_ID: args.s3BackupConfig.accessKeyId,
            AWS_SECRET_ACCESS_KEY: args.s3BackupConfig.secretAccessKey,
            AWS_ENDPOINTS: args.s3BackupConfig.endpoint ?? "",
          },
        },
        { parent: this, dependsOn: [this.namespace] },
      );
    }

    // Build opinionated Helm values with enhanced uninstaller RBAC configuration
    const helmValues = {
      // Always install CRDs
      installCRDs: true,
      // Global configuration
      global: {
        cattle: {
          systemDefaultRegistry: "", // Use default registry
        },
      },
      // Service configuration - use ClusterIP like cert-manager
      service: {
        ui: {
          type: "ClusterIP",
        },
        manager: {
          type: "ClusterIP",
        },
      },
      // Enhanced ServiceAccount configuration for uninstaller operations
      serviceAccount: {
        // Use the dedicated uninstaller ServiceAccount if RBAC is enabled
        ...(this.uninstallerRbac && {
          name: this.uninstallerRbac.serviceAccount.metadata.name,
        }),
      },
      // Enhanced uninstaller configuration with proper RBAC and timeout settings
      ...(this.uninstallerRbac && {
        uninstall: {
          // Force uninstall to handle stuck resources
          force: true,
          // Use dedicated ServiceAccount for proper permissions
          serviceAccount: this.uninstallerRbac.serviceAccount.metadata.name,
          // Timeout configuration for uninstaller operations
          timeoutSeconds: args.uninstallerTimeoutSeconds ?? 600, // 10 minutes default
          // Retry configuration for transient failures
          backoffLimit: args.maxRetries ?? 3,
          // Job cleanup policy
          ttlSecondsAfterFinished: 300, // Clean up job after 5 minutes
          // Resource limits for uninstaller job
          resources: {
            requests: {
              cpu: "100m",
              memory: "128Mi",
            },
            limits: {
              cpu: "500m",
              memory: "512Mi",
            },
          },
        },
      }),
      // Longhorn manager configuration with uninstaller RBAC support
      longhornManager: {
        // Use dedicated ServiceAccount for manager operations including uninstall
        ...(this.uninstallerRbac && {
          serviceAccount: this.uninstallerRbac.serviceAccount.metadata.name,
        }),
        // Timeout configuration for manager operations
        terminationGracePeriodSeconds: args.uninstallerTimeoutSeconds ?? 600,
      },
      // Longhorn driver configuration with uninstaller support
      longhornDriver: {
        // Use dedicated ServiceAccount for driver operations
        ...(this.uninstallerRbac && {
          serviceAccount: this.uninstallerRbac.serviceAccount.metadata.name,
        }),
      },
      // Longhorn UI configuration
      longhornUI: {
        // Use dedicated ServiceAccount for UI operations
        ...(this.uninstallerRbac && {
          serviceAccount: this.uninstallerRbac.serviceAccount.metadata.name,
        }),
      },
      // Pre-upgrade and pre-delete hooks configuration
      preUpgradeChecker: {
        // Enable pre-upgrade checks for safer upgrades
        enabled: true,
        // Use dedicated ServiceAccount for pre-upgrade operations
        ...(this.uninstallerRbac && {
          serviceAccount: this.uninstallerRbac.serviceAccount.metadata.name,
        }),
        // Job configuration with timeout and retry settings
        jobEnabled: true,
        upgradeVersionCheck: true,
        resources: {
          requests: {
            cpu: "100m",
            memory: "128Mi",
          },
          limits: {
            cpu: "500m",
            memory: "512Mi",
          },
        },
      },
      // Storage configuration
      persistence: {
        defaultClass: args.defaultStorageClass,
        defaultClassReplicaCount: args.replicaCount,
        defaultDataLocality: "best-effort",
        reclaimPolicy: "Retain",
      },
      // CSI configuration for production resiliency
      csi: {
        attacherReplicaCount: 2,
        provisionerReplicaCount: 2,
        resizerReplicaCount: 2,
        snapshotterReplicaCount: 2,
      },
      // Production-ready default settings with uninstaller configuration
      defaultSettings: {
        backupTarget: args.backupTarget ?? "",
        backupTargetCredentialSecret: args.s3BackupConfig ? (this.backupSecret?.metadata.name ?? "") : "",
        defaultReplicaCount: args.replicaCount,
        replicaSoftAntiAffinity: true,
        replicaAutoBalance: "least-effort",
        storageOverProvisioningPercentage: 200,
        storageMinimalAvailablePercentage: 25,
        upgradeChecker: true, // Enable for production monitoring
        autoSalvage: true, // Enable automatic volume recovery
        deletingConfirmationFlag: true, // Allow uninstall jobs to proceed for upgrades
        createDefaultDiskLabeledNodes: true,
        defaultDataLocality: "best-effort",
        // Uninstaller-specific settings
        concurrentAutomaticEngineUpgradePerNodeLimit: 1, // Limit concurrent upgrades for stability
        guaranteedEngineManagerCPU: 0.25, // Ensure sufficient CPU for engine operations
        guaranteedReplicaManagerCPU: 0.25, // Ensure sufficient CPU for replica operations
        // Timeout settings for various operations
        engineReplicaTimeout: args.uninstallerTimeoutSeconds ?? 600,
        longGRPCTimeOut: Math.min(args.uninstallerTimeoutSeconds ?? 600, 1800), // Max 30 minutes
        // Retry settings
        failedBackupTTL: 1440, // 24 hours in minutes
        restoreVolumeRecurringJobBufferCount: args.maxRetries ?? 3,
      },
    };

    // Expose helm values as output for ArgoCD applications
    this.helmValuesOutput = pulumi.output(JSON.stringify(helmValues));

    // Update deployment status to prerequisite validation phase
    if (this.deploymentMonitor) {
      this.deploymentMonitor.updateStatus({
        phase: DeploymentPhase.PREREQUISITE_VALIDATION,
        message: "Validating system prerequisites (open-iscsi, kernel modules)",
        timestamp: new Date(),
        retryCount: 0,
        componentName: name,
        namespace: args.namespace,
      });
    }

    // Create prerequisite validation if enabled (default: true)
    if (args.validatePrerequisites !== false) {
      this.prerequisiteValidation = createPrerequisiteValidation(
        {
          componentName: name,
          namespace: args.namespace,
          validateOpenIscsi: true,
          requiredPackages: ["open-iscsi"],
          timeoutSeconds: 600, // 10 minutes for prerequisite validation
        },
        { parent: this, dependsOn: [this.namespace] },
      );
    }

    // Update deployment status to CRD setup phase
    if (this.deploymentMonitor) {
      this.deploymentMonitor.updateStatus({
        phase: DeploymentPhase.CRD_SETUP,
        message: "Setting up CRDs and deleting-confirmation-flag setting",
        timestamp: new Date(),
        retryCount: 0,
        componentName: name,
        namespace: args.namespace,
      });
    }

    // Deploy Longhorn with opinionated homelab configuration
    // Include RBAC and prerequisite validation in dependencies (confirmation flag created after chart)
    const chartDependencies: pulumi.Resource[] = [this.namespace];

    // Add prerequisite validation dependency if it exists
    if (this.prerequisiteValidation) {
      chartDependencies.push(this.prerequisiteValidation.validationJob);
    }

    // Add RBAC dependencies if they exist
    if (this.uninstallerRbac) {
      chartDependencies.push(
        this.uninstallerRbac.serviceAccount,
        this.uninstallerRbac.clusterRole,
        this.uninstallerRbac.clusterRoleBinding,
      );
    }

    // Update deployment status to Helm deployment phase
    if (this.deploymentMonitor) {
      this.deploymentMonitor.updateStatus({
        phase: DeploymentPhase.HELM_DEPLOYMENT,
        message: "Deploying Longhorn Helm chart with enhanced RBAC and CRD management",
        timestamp: new Date(),
        retryCount: 0,
        componentName: name,
        namespace: args.namespace,
      });
    }

    this.chart = new k8s.helm.v3.Chart(
      name,
      {
        chart: "longhorn",
        fetchOpts: { repo: "https://charts.longhorn.io" },
        version: args.chartVersion,
        namespace: this.namespace.metadata.name,
        values: helmValues,
      },
      { parent: this, dependsOn: chartDependencies },
    );

    // Create the deleting-confirmation-flag setting after chart installation
    this.deletingConfirmationFlag = createDeletingConfirmationFlagJob(name, args.namespace, {
      parent: this,
      dependsOn: [this.chart], // Depends on chart to ensure Longhorn CRDs exist
    });

    // Create authentication middleware for Longhorn UI
    // Create authentication middleware for Longhorn UI
    this.authMiddleware = new k8s.apiextensions.CustomResource(
      `${name}-auth-middleware`,
      {
        apiVersion: "traefik.io/v1alpha1",
        kind: "Middleware",
        metadata: {
          name: "longhorn-auth", // Simplified name
          namespace: this.namespace.metadata.name,
        },
        spec: {
          basicAuth: {
            secret: "longhorn-basic-auth",
          },
        },
      },
      { parent: this, dependsOn: [this.chart] },
    );

    // Create WebSocket headers middleware for Traefik compatibility
    this.wsHeadersMiddleware = new k8s.apiextensions.CustomResource(
      `${name}-ws-headers-middleware`,
      {
        apiVersion: "traefik.io/v1alpha1",
        kind: "Middleware",
        metadata: {
          name: "longhorn-ws-headers", // Static name
          namespace: this.namespace.metadata.name,
        },
        spec: {
          headers: {
            customRequestHeaders: {
              "X-Forwarded-Proto": "https",
            },
          },
        },
      },
      { parent: this, dependsOn: [this.chart] },
    );

    // Create the user string for the htpasswd secret
    const htpasswdUser = pulumi
      .secret(args.adminPassword)
      .apply((password) => `admin:${bcrypt.hashSync(password, 10)}`);

    // Create basic auth secret for Longhorn UI, ensuring correct base64 encoding
    this.authSecret = new k8s.core.v1.Secret(
      `${name}-auth-secret`,
      {
        metadata: {
          name: "longhorn-basic-auth",
          namespace: this.namespace.metadata.name,
        },
        type: "Opaque",
        data: {
          // Manually base64 encode the user string to ensure correct format
          users: htpasswdUser.apply((user) => Buffer.from(user).toString("base64")),
        },
      },
      { parent: this, dependsOn: [this.namespace] },
    );

    // Create Certificate for Longhorn UI to ensure TLS secret exists before Ingress
    const certificate = new k8s.apiextensions.CustomResource(
      `${name}-certificate`,
      {
        apiVersion: "cert-manager.io/v1",
        kind: "Certificate",
        metadata: {
          name: "longhorn-frontend-tls",
          namespace: this.namespace.metadata.name,
        },
        spec: {
          secretName: "longhorn-frontend-tls",
          duration: "2160h", // 90d
          renewBefore: "360h", // 15d
          issuerRef: {
            name: `letsencrypt-${args.environment}`,
            kind: "ClusterIssuer",
          },
          dnsNames: [args.domain],
        },
      },
      { parent: this, dependsOn: [this.namespace] },
    );

    // Create Ingress for Longhorn UI with authentication middleware
    this.ingress = new k8s.networking.v1.Ingress(
      `${name}-ingress`,
      {
        metadata: {
          name: "longhorn-ingress",
          namespace: this.namespace.metadata.name,
          annotations: {
            "kubernetes.io/ingress.class": "traefik",
            "traefik.ingress.kubernetes.io/router.entrypoints": "websecure",
            "traefik.ingress.kubernetes.io/router.tls": "true",
            "cert-manager.io/cluster-issuer": `letsencrypt-${args.environment}`,
            // Reference middleware names with namespace prefix for cross-namespace access
            "traefik.ingress.kubernetes.io/router.middlewares": pulumi.interpolate`${this.namespace.metadata.name}-longhorn-ws-headers@kubernetescrd,${this.namespace.metadata.name}-longhorn-auth@kubernetescrd`,
          },
        },
        spec: {
          ingressClassName: "traefik",
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
                        name: "longhorn-frontend",
                        port: { number: 80 },
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
              secretName: "longhorn-frontend-tls",
            },
          ],
        },
      },
      {
        parent: this,
        dependsOn: [
          this.chart,
          this.authMiddleware,
          this.authSecret,
          this.wsHeadersMiddleware,
          certificate, // Add explicit dependency on the Certificate
        ],
      },
    );

    // Create disk provisioning automation if enabled (default: true)
    if (args.enableDiskProvisioning !== false) {
      this.diskProvisioning = createDiskProvisioningJob(
        `${name}-disk-provisioning`,
        {
          namespace: args.namespace,
          environment: args.environment,
          diskPath: args.diskPath ?? "/var/lib/longhorn",
          storageReservedGb: args.storageReservedGb ?? 6,
          timeoutSeconds: args.diskProvisioningTimeoutSeconds ?? 600,
          retryAttempts: args.diskProvisioningRetryAttempts ?? 3,
        },
        opts?.provider,
        [this.namespace, this.chart], // Add dependency on namespace and chart
      );
    }

    // Create volume cleanup automation for staging environments
    if (args.enableVolumeCleanup !== false && args.environment === "stg") {
      this.volumeCleanup = createVolumeCleanup(
        `${name}-volume-cleanup`,
        {
          namespace: args.namespace,
          environment: args.environment,
          enableAutoCleanup: true, // Enable automatic cleanup for staging
          cleanupIntervalMinutes: args.volumeCleanupIntervalMinutes ?? 30,
          maxVolumeAgeHours: args.maxVolumeAgeHours ?? 2, // Clean up volumes older than 2 hours
        },
        { parent: this, dependsOn: [this.chart] },
      );
    }

    if (this.deploymentMonitor) {
      // Create status ConfigMap for persistent status tracking
      this.statusConfigMap = createDeploymentStatusConfigMap(name, args.namespace, this.deploymentMonitor, {
        parent: this,
        dependsOn: [this.chart],
      });

      // Create monitoring job for deployment progress tracking
      this.monitoringJob = createDeploymentMonitoringJob(
        name,
        args.namespace,
        {
          componentName: name,
          namespace: args.namespace,
          timeoutSeconds: args.deploymentTimeoutSeconds ?? 1800,
          maxRetries: args.maxRetries ?? 3,
          enableStatusTracking: args.enableStatusTracking !== false,
          enableMetrics: true,
        },
        { parent: this, dependsOn: [this.statusConfigMap] },
      );

      // Mark deployment as complete
      this.deploymentMonitor.markAsComplete();
    }

    // Register outputs
    this.registerOutputs({
      namespace: this.namespace,
      chart: this.chart,
      backupSecret: this.backupSecret,
      ingress: this.ingress,
      authMiddleware: this.authMiddleware,
      wsHeadersMiddleware: this.wsHeadersMiddleware,
      authSecret: this.authSecret,
      helmValuesOutput: this.helmValuesOutput,
      uninstallerRbac: this.uninstallerRbac,
      deletingConfirmationFlag: this.deletingConfirmationFlag,
      prerequisiteValidation: this.prerequisiteValidation,
      deploymentMonitor: this.deploymentMonitor,
      statusConfigMap: this.statusConfigMap,
      monitoringJob: this.monitoringJob,
      diskProvisioning: this.diskProvisioning,
      volumeCleanup: this.volumeCleanup,
    });
  }
}
