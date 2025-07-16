# Staging Environment - Enhanced Longhorn Configuration

This document describes the enhanced Longhorn configuration for the staging environment, which includes new RBAC management, prerequisite validation, and deployment monitoring features.

## Enhanced Features

### 1. Uninstaller RBAC Management
- **enableUninstallerRbac**: `true` - Creates dedicated ServiceAccount, ClusterRole, and ClusterRoleBinding for uninstaller operations
- **uninstallerTimeoutSeconds**: `900` (15 minutes) - Appropriate timeout for staging environment operations

### 2. Prerequisite Validation
- **validatePrerequisites**: `true` - Validates system requirements before deployment
- Checks for open-iscsi installation on all nodes
- Validates required kernel modules and system packages

### 3. Deployment Monitoring
- **enableDeploymentMonitoring**: `true` - Enables comprehensive deployment status tracking
- **deploymentTimeoutSeconds**: `2400` (40 minutes) - Extended timeout for staging environment
- **maxRetries**: `5` - Increased retry count for staging testing
- **enableStatusTracking**: `true` - Enables persistent status tracking via ConfigMaps

### 4. Error Handling and Recovery
- Enhanced retry mechanisms with exponential backoff
- Comprehensive error detection and reporting
- Automatic cleanup on deployment failures
- Resource limits configured for stability

## Configuration Details

```typescript
export const longhornBootstrap = new Components.LonghornComponent(
  "longhorn",
  {
    namespace: "stg-longhorn",
    chartVersion: "1.7.2",
    environment: "stg",
    domain: `longhorn.stg.${domain}`,
    defaultStorageClass: true,
    replicaCount: 2,
    adminPassword: longhornPassword,
    // Enhanced uninstaller RBAC configuration
    enableUninstallerRbac: true,
    uninstallerTimeoutSeconds: 900, // 15 minutes for staging environment
    // Prerequisite validation for staging environment
    validatePrerequisites: true,
    // Enhanced deployment monitoring and error handling
    enableDeploymentMonitoring: true,
    deploymentTimeoutSeconds: 2400, // 40 minutes for staging (longer than production)
    maxRetries: 5, // More retries for staging environment
    enableStatusTracking: true,
  },
  {
    dependsOn: [certManagerBootstrap],
    provider: stagingK8sProvider,
  },
);
```

## New Exports

The staging environment now exports additional resources for monitoring and debugging:

- `longhornUrl`: The Longhorn UI URL for the staging environment
- `longhornUninstallerRbac`: RBAC resources for uninstaller operations
- `longhornPrerequisiteValidation`: Prerequisite validation job and ConfigMap
- `longhornDeploymentStatus`: Deployment status tracking ConfigMap
- `longhornHelmValues`: Complete Helm values configuration as JSON

## Testing

The enhanced configuration has been validated with:

1. **TypeScript Compilation**: All configuration files compile successfully
2. **Configuration Validation**: Custom validation script confirms all settings
3. **Integration Tests**: Comprehensive test suite for enhanced features

## Deployment Sequence

The enhanced Longhorn component follows this deployment sequence:

1. **Namespace Creation** with security labels
2. **RBAC Setup** - ServiceAccount, ClusterRole, ClusterRoleBinding
3. **Prerequisite Validation** - System requirements check
4. **CRD Management** - Pre-creation of required CRDs and settings
5. **Helm Chart Deployment** - Longhorn installation with enhanced configuration
6. **Post-deployment Validation** - Status tracking and monitoring setup

## Troubleshooting

### Common Issues

1. **Uninstaller Failures**: Check RBAC permissions and timeout settings
2. **Prerequisite Validation Failures**: Ensure open-iscsi is installed on all nodes
3. **Deployment Timeouts**: Review deployment monitoring logs and status ConfigMap
4. **CRD Conflicts**: Check CRD management job logs for conflict resolution

### Monitoring

- Check deployment status: `kubectl get configmap -n stg-longhorn`
- View monitoring job logs: `kubectl logs -n stg-longhorn job/longhorn-monitoring`
- Check prerequisite validation: `kubectl logs -n stg-longhorn job/longhorn-prerequisite-validation`
- Review RBAC resources: `kubectl get serviceaccount,clusterrole,clusterrolebinding | grep longhorn`

## Requirements Satisfied

This configuration addresses the following requirements:

- **Requirement 1.1**: Uninstaller job completes successfully without errors
- **Requirement 4.4**: All dependencies are ready before Helm chart deployment

The enhanced staging configuration provides a robust testing environment for the Longhorn uninstaller fix with comprehensive monitoring and error handling capabilities.
