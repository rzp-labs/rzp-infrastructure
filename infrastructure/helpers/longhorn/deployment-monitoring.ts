/**
 * Longhorn Deployment Monitoring and Error Handling Utilities
 *
 * Provides comprehensive deployment status tracking, retry logic with exponential backoff,
 * error detection and reporting mechanisms, and timeout configuration for all deployment phases.
 * Implements requirements 2.1, 2.2, and 2.3 for enhanced error handling and monitoring.
 */

import * as k8s from "@pulumi/kubernetes";
import * as pulumi from "@pulumi/pulumi";

/**
 * Deployment phase enumeration for status tracking
 */
export enum DeploymentPhase {
  INITIALIZING = "initializing",
  RBAC_SETUP = "rbac-setup",
  CRD_SETUP = "crd-setup",
  PREREQUISITE_VALIDATION = "prerequisite-validation",
  HELM_DEPLOYMENT = "helm-deployment",
  POST_DEPLOYMENT_VALIDATION = "post-deployment-validation",
  COMPLETE = "complete",
  FAILED = "failed",
}

/**
 * Deployment status interface for tracking deployment progress
 */
export interface IDeploymentStatus {
  readonly phase: DeploymentPhase;
  readonly message: string;
  readonly timestamp: Date;
  readonly retryCount: number;
  readonly error?: Error;
  readonly componentName: string;
  readonly namespace: string;
}

/**
 * Configuration for deployment monitoring and error handling
 */
export interface IDeploymentMonitoringConfig {
  readonly componentName: string;
  readonly namespace: string;
  readonly timeoutSeconds?: number;
  readonly maxRetries?: number;
  readonly initialRetryDelayMs?: number;
  readonly maxRetryDelayMs?: number;
  readonly retryMultiplier?: number;
  readonly enableStatusTracking?: boolean;
  readonly enableMetrics?: boolean;
  readonly statusUpdateCallback?: (status: IDeploymentStatus) => void;
}

/**
 * Error types for categorizing deployment failures
 */
export enum DeploymentErrorType {
  TIMEOUT = "timeout",
  RBAC_PERMISSION = "rbac-permission",
  CRD_CONFLICT = "crd-conflict",
  PREREQUISITE_MISSING = "prerequisite-missing",
  HELM_FAILURE = "helm-failure",
  NETWORK_ERROR = "network-error",
  RESOURCE_CONFLICT = "resource-conflict",
  VALIDATION_FAILURE = "validation-failure",
  UNKNOWN = "unknown",
}

/**
 * Enhanced error class for deployment failures with categorization and remediation guidance
 */
export class DeploymentError extends Error {
  public readonly errorType: DeploymentErrorType;
  public readonly phase: DeploymentPhase;
  public readonly componentName: string;
  public readonly namespace: string;
  public readonly remediationSteps: string[];
  public readonly retryable: boolean;
  public readonly originalError?: Error;

  constructor(
    message: string,
    errorType: DeploymentErrorType,
    phase: DeploymentPhase,
    componentName: string,
    namespace: string,
    remediationSteps: string[] = [],
    retryable: boolean = true,
    originalError?: Error,
  ) {
    super(message);
    this.name = "DeploymentError";
    this.errorType = errorType;
    this.phase = phase;
    this.componentName = componentName;
    this.namespace = namespace;
    this.remediationSteps = remediationSteps;
    this.retryable = retryable;
    this.originalError = originalError;

    if (originalError) {
      this.stack = originalError.stack;
    }
  }

  /**
   * Returns a formatted error report with remediation guidance
   */
  public getErrorReport(): string {
    const report = [
      `Deployment Error Report`,
      `========================`,
      `Component: ${this.componentName}`,
      `Namespace: ${this.namespace}`,
      `Phase: ${this.phase}`,
      `Error Type: ${this.errorType}`,
      `Retryable: ${this.retryable}`,
      `Message: ${this.message}`,
      ``,
    ];

    if (this.remediationSteps.length > 0) {
      report.push(`Remediation Steps:`);
      this.remediationSteps.forEach((step, index) => {
        report.push(`${index + 1}. ${step}`);
      });
      report.push(``);
    }

    if (typeof this.stack === "string" && this.stack.length > 0) {
      report.push(`Stack Trace:`);
      report.push(this.stack);
    }

    return report.join("\n");
  }
}

/**
 * Deployment monitoring and error handling utility class
 */
export class DeploymentMonitor {
  private readonly config: Required<IDeploymentMonitoringConfig>;
  private readonly statusHistory: IDeploymentStatus[] = [];
  private currentStatus: IDeploymentStatus;

  constructor(config: IDeploymentMonitoringConfig) {
    this.config = {
      timeoutSeconds: 1800, // 30 minutes default
      maxRetries: 3,
      initialRetryDelayMs: 1000, // 1 second
      maxRetryDelayMs: 60000, // 1 minute
      retryMultiplier: 2,
      enableStatusTracking: true,
      enableMetrics: false,
      statusUpdateCallback: () => {}, // No-op default
      ...config,
    };

    this.currentStatus = {
      phase: DeploymentPhase.INITIALIZING,
      message: "Deployment monitoring initialized",
      timestamp: new Date(),
      retryCount: 0,
      componentName: this.config.componentName,
      namespace: this.config.namespace,
    };

    this.updateStatus(this.currentStatus);
  }

  /**
   * Updates the deployment status and triggers callbacks
   */
  public updateStatus(status: IDeploymentStatus): void {
    this.currentStatus = status;

    if (this.config.enableStatusTracking) {
      this.statusHistory.push(status);
    }

    // Log status update
    const logMessage = `[${status.componentName}/${status.namespace}] ${status.phase}: ${status.message}`;
    if (status.error) {
      // eslint-disable-next-line no-console
      console.error(logMessage, status.error);
    } else {
      // eslint-disable-next-line no-console
      console.log(logMessage);
    }

    // Trigger callback
    this.config.statusUpdateCallback(status);
  }

  /**
   * Executes an operation with retry logic and exponential backoff
   */
  public async executeWithRetry<T>(
    operation: () => Promise<T>,
    phase: DeploymentPhase,
    operationName: string,
  ): Promise<T> {
    let lastError: Error | undefined;
    let retryCount = 0;

    this.updateStatus({
      phase,
      message: `Starting ${operationName}`,
      timestamp: new Date(),
      retryCount: 0,
      componentName: this.config.componentName,
      namespace: this.config.namespace,
    });

    while (retryCount <= this.config.maxRetries) {
      try {
        const result = await this.executeWithTimeout(operation, this.config.timeoutSeconds * 1000);

        this.updateStatus({
          phase,
          message: `${operationName} completed successfully`,
          timestamp: new Date(),
          retryCount,
          componentName: this.config.componentName,
          namespace: this.config.namespace,
        });

        return result;
      } catch (error) {
        lastError = error instanceof Error ? error : new Error(String(error));
        retryCount++;

        const deploymentError = this.categorizeError(lastError, phase);

        this.updateStatus({
          phase,
          message: `${operationName} failed (attempt ${retryCount}/${this.config.maxRetries + 1}): ${deploymentError.message}`,
          timestamp: new Date(),
          retryCount,
          error: deploymentError,
          componentName: this.config.componentName,
          namespace: this.config.namespace,
        });

        // Don't retry if error is not retryable or we've exceeded max retries
        if (!deploymentError.retryable || retryCount > this.config.maxRetries) {
          throw deploymentError;
        }

        // Calculate delay with exponential backoff
        const delay = Math.min(
          this.config.initialRetryDelayMs * Math.pow(this.config.retryMultiplier, retryCount - 1),
          this.config.maxRetryDelayMs,
        );

        this.updateStatus({
          phase,
          message: `Retrying ${operationName} in ${delay}ms (attempt ${retryCount + 1}/${this.config.maxRetries + 1})`,
          timestamp: new Date(),
          retryCount,
          componentName: this.config.componentName,
          namespace: this.config.namespace,
        });

        await this.sleep(delay);
      }
    }

    // This should never be reached due to the throw above, but TypeScript requires it
    throw lastError ?? new Error("Unknown error occurred");
  }

  /**
   * Executes an operation with a timeout
   */
  private async executeWithTimeout<T>(operation: () => Promise<T>, timeoutMs: number): Promise<T> {
    return new Promise<T>((resolve, reject) => {
      const timeoutId = setTimeout(() => {
        reject(new Error(`Operation timed out after ${timeoutMs}ms`));
      }, timeoutMs);

      operation()
        .then((result) => {
          clearTimeout(timeoutId);
          resolve(result);
        })
        .catch((error) => {
          clearTimeout(timeoutId);
          reject(error);
        });
    });
  }

  /**
   * Categorizes errors and provides remediation guidance
   */
  private categorizeError(error: Error, phase: DeploymentPhase): DeploymentError {
    const message = error.message?.toLowerCase() ?? "";

    // RBAC permission errors
    if (
      message.length > 0 &&
      (message.includes("forbidden") || message.includes("unauthorized") || message.includes("rbac"))
    ) {
      return new DeploymentError(
        error.message,
        DeploymentErrorType.RBAC_PERMISSION,
        phase,
        this.config.componentName,
        this.config.namespace,
        [
          "Verify that the ServiceAccount has the required ClusterRole permissions",
          "Check that the ClusterRoleBinding is correctly configured",
          "Ensure the uninstaller RBAC resources were created successfully",
          "Review the ClusterRole permissions for Longhorn CRDs and Kubernetes resources",
        ],
        true,
        error,
      );
    }

    // CRD conflict errors
    if (message.includes("crd") || message.includes("customresourcedefinition") || message.includes("already exists")) {
      return new DeploymentError(
        error.message,
        DeploymentErrorType.CRD_CONFLICT,
        phase,
        this.config.componentName,
        this.config.namespace,
        [
          "Check for existing Longhorn CRDs with different versions",
          "Ensure CRD pre-creation job completed successfully",
          "Verify that deleting-confirmation-flag setting is properly configured",
          "Consider manually updating conflicting CRDs to the required version",
        ],
        true,
        error,
      );
    }

    // Prerequisite missing errors
    if (message.includes("iscsi") || message.includes("prerequisite") || message.includes("dependency")) {
      return new DeploymentError(
        error.message,
        DeploymentErrorType.PREREQUISITE_MISSING,
        phase,
        this.config.componentName,
        this.config.namespace,
        [
          "Install open-iscsi on all cluster nodes: apt-get install open-iscsi (Ubuntu/Debian)",
          "Enable and start the iscsid service: systemctl enable iscsid && systemctl start iscsid",
          "Verify iSCSI initiator name exists: cat /etc/iscsi/initiatorname.iscsi",
          "Run prerequisite validation job to identify missing dependencies",
        ],
        false, // Prerequisites usually require manual intervention
        error,
      );
    }

    // Helm deployment errors
    if (message.includes("helm") || message.includes("chart") || message.includes("release")) {
      return new DeploymentError(
        error.message,
        DeploymentErrorType.HELM_FAILURE,
        phase,
        this.config.componentName,
        this.config.namespace,
        [
          "Check Helm chart repository accessibility",
          "Verify Helm values configuration is correct",
          "Ensure all dependencies (RBAC, CRDs, prerequisites) are ready",
          "Review Helm release status and logs for detailed error information",
        ],
        true,
        error,
      );
    }

    // Network errors
    if (message.includes("network") || message.includes("connection") || message.includes("timeout")) {
      return new DeploymentError(
        error.message,
        DeploymentErrorType.NETWORK_ERROR,
        phase,
        this.config.componentName,
        this.config.namespace,
        [
          "Check network connectivity to Kubernetes API server",
          "Verify DNS resolution is working correctly",
          "Ensure firewall rules allow required traffic",
          "Check for network policies that might block communication",
        ],
        true,
        error,
      );
    }

    // Resource conflict errors
    if (message.includes("conflict") || message.includes("already exists") || message.includes("duplicate")) {
      return new DeploymentError(
        error.message,
        DeploymentErrorType.RESOURCE_CONFLICT,
        phase,
        this.config.componentName,
        this.config.namespace,
        [
          "Check for existing resources with the same name",
          "Verify namespace isolation is working correctly",
          "Consider using different resource names or namespaces",
          "Clean up any orphaned resources from previous deployments",
        ],
        true,
        error,
      );
    }

    // Validation failure errors
    if (message.includes("validation") || message.includes("invalid") || message.includes("malformed")) {
      return new DeploymentError(
        error.message,
        DeploymentErrorType.VALIDATION_FAILURE,
        phase,
        this.config.componentName,
        this.config.namespace,
        [
          "Review the configuration values for correctness",
          "Check that all required fields are provided",
          "Validate Kubernetes resource specifications",
          "Ensure compatibility with the target Kubernetes version",
        ],
        false, // Validation errors usually require configuration fixes
        error,
      );
    }

    // Default to unknown error type
    return new DeploymentError(
      error.message,
      DeploymentErrorType.UNKNOWN,
      phase,
      this.config.componentName,
      this.config.namespace,
      [
        "Review the error message and stack trace for clues",
        "Check Kubernetes cluster status and resource availability",
        "Verify all deployment dependencies are satisfied",
        "Consider increasing timeout values if the operation is slow",
      ],
      true,
      error,
    );
  }

  /**
   * Marks the deployment as failed with error details
   */
  public markAsFailed(error: Error, phase: DeploymentPhase): void {
    const deploymentError = this.categorizeError(error, phase);

    this.updateStatus({
      phase: DeploymentPhase.FAILED,
      message: `Deployment failed in ${phase}: ${deploymentError.message}`,
      timestamp: new Date(),
      retryCount: this.currentStatus.retryCount,
      error: deploymentError,
      componentName: this.config.componentName,
      namespace: this.config.namespace,
    });

    // Log detailed error report
    // eslint-disable-next-line no-console
    console.error(deploymentError.getErrorReport());
  }

  /**
   * Marks the deployment as complete
   */
  public markAsComplete(): void {
    this.updateStatus({
      phase: DeploymentPhase.COMPLETE,
      message: "Deployment completed successfully",
      timestamp: new Date(),
      retryCount: this.currentStatus.retryCount,
      componentName: this.config.componentName,
      namespace: this.config.namespace,
    });
  }

  /**
   * Gets the current deployment status
   */
  public getCurrentStatus(): IDeploymentStatus {
    return this.currentStatus;
  }

  /**
   * Gets the complete status history
   */
  public getStatusHistory(): IDeploymentStatus[] {
    return [...this.statusHistory];
  }

  /**
   * Gets deployment metrics and statistics
   */
  public getMetrics(): {
    totalDuration: number;
    phaseCount: Record<DeploymentPhase, number>;
    errorCount: number;
    retryCount: number;
  } {
    const startTime = this.statusHistory[0]?.timestamp ?? new Date();
    const endTime = this.currentStatus.timestamp;
    const totalDuration = endTime.getTime() - startTime.getTime();

    const phaseCount = Object.values(DeploymentPhase).reduce(
      (acc, phase) => {
        acc[phase] = this.statusHistory.filter((status) => status.phase === phase).length;
        return acc;
      },
      {} as Record<DeploymentPhase, number>,
    );

    const errorCount = this.statusHistory.filter((status) => Boolean(status.error)).length;
    const retryCount = Math.max(...this.statusHistory.map((status) => status.retryCount), 0);

    return {
      totalDuration,
      phaseCount,
      errorCount,
      retryCount,
    };
  }

  /**
   * Utility method to sleep for a specified duration
   */
  private async sleep(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }
}

/**
 * Creates a deployment monitoring ConfigMap for status persistence
 */
export function createDeploymentStatusConfigMap(
  componentName: string,
  namespace: string,
  monitor: DeploymentMonitor,
  opts?: pulumi.ComponentResourceOptions,
): k8s.core.v1.ConfigMap {
  const statusData = pulumi.output(monitor.getCurrentStatus()).apply((status) => ({
    phase: status.phase,
    message: status.message,
    timestamp: status.timestamp instanceof Date ? status.timestamp.toISOString() : new Date().toISOString(),
    retryCount: status.retryCount.toString(),
    componentName: status.componentName,
    namespace: status.namespace,
  }));

  return new k8s.core.v1.ConfigMap(
    `${componentName}-deployment-status`,
    {
      metadata: {
        name: `${componentName}-deployment-status`,
        namespace,
        labels: {
          "app.kubernetes.io/name": "longhorn",
          "app.kubernetes.io/managed-by": "pulumi",
          "app.kubernetes.io/component": "deployment-monitoring",
          "app.kubernetes.io/part-of": componentName,
        },
        annotations: {
          "pulumi.com/description": "Deployment status tracking for Longhorn component",
        },
      },
      data: statusData,
    },
    opts,
  );
}

/**
 * Creates a monitoring job that tracks deployment progress and reports status
 */
export function createDeploymentMonitoringJob(
  componentName: string,
  namespace: string,
  config: IDeploymentMonitoringConfig,
  opts?: pulumi.ComponentResourceOptions,
): k8s.batch.v1.Job {
  return new k8s.batch.v1.Job(
    `${componentName}-deployment-monitor`,
    {
      metadata: {
        name: `${componentName}-deployment-monitor`,
        namespace,
        labels: {
          "app.kubernetes.io/name": "longhorn",
          "app.kubernetes.io/managed-by": "pulumi",
          "app.kubernetes.io/component": "deployment-monitoring",
          "app.kubernetes.io/part-of": componentName,
        },
      },
      spec: {
        ttlSecondsAfterFinished: 3600, // Keep for 1 hour
        backoffLimit: 1, // Don't retry monitoring job
        template: {
          spec: {
            restartPolicy: "Never",
            containers: [
              {
                name: "deployment-monitor",
                image: "bitnami/kubectl:latest",
                command: ["/bin/bash"],
                args: [
                  "-c",
                  `
                  set -euo pipefail

                  echo "Starting deployment monitoring for ${componentName} in namespace ${namespace}"

                  # Monitor deployment progress
                  TIMEOUT=${config.timeoutSeconds ?? 1800}
                  START_TIME=$(date +%s)

                  while true; do
                    CURRENT_TIME=$(date +%s)
                    ELAPSED=$((CURRENT_TIME - START_TIME))

                    if [ $ELAPSED -gt $TIMEOUT ]; then
                      echo "Deployment monitoring timed out after ${config.timeoutSeconds ?? 1800} seconds"
                      exit 1
                    fi

                    # Check deployment status
                    if kubectl get configmap ${componentName}-deployment-status -n ${namespace} >/dev/null 2>&1; then
                      PHASE=$(kubectl get configmap ${componentName}-deployment-status -n ${namespace} -o jsonpath='{.data.phase}' 2>/dev/null || echo "unknown")
                      MESSAGE=$(kubectl get configmap ${componentName}-deployment-status -n ${namespace} -o jsonpath='{.data.message}' 2>/dev/null || echo "unknown")

                      echo "[$(date)] Phase: $PHASE, Message: $MESSAGE"

                      if [ "$PHASE" = "complete" ]; then
                        echo "Deployment completed successfully"
                        exit 0
                      elif [ "$PHASE" = "failed" ]; then
                        echo "Deployment failed"
                        exit 1
                      fi
                    fi

                    sleep 10
                  done
                  `,
                ],
                env: [
                  {
                    name: "COMPONENT_NAME",
                    value: componentName,
                  },
                  {
                    name: "NAMESPACE",
                    value: namespace,
                  },
                ],
              },
            ],
          },
        },
      },
    },
    opts,
  );
}

/**
 * Utility function to create a comprehensive deployment monitoring setup
 */
export function createComprehensiveMonitoring(
  componentName: string,
  namespace: string,
  config: Partial<IDeploymentMonitoringConfig> = {},
  opts?: pulumi.ComponentResourceOptions,
): {
  monitor: DeploymentMonitor;
  statusConfigMap: k8s.core.v1.ConfigMap;
  monitoringJob: k8s.batch.v1.Job;
} {
  const fullConfig: IDeploymentMonitoringConfig = {
    componentName,
    namespace,
    enableStatusTracking: true,
    enableMetrics: true,
    ...config,
  };

  const monitor = new DeploymentMonitor(fullConfig);
  const statusConfigMap = createDeploymentStatusConfigMap(componentName, namespace, monitor, opts);
  const monitoringJob = createDeploymentMonitoringJob(componentName, namespace, fullConfig, opts);

  return {
    monitor,
    statusConfigMap,
    monitoringJob,
  };
}
