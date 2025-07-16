# Longhorn Configuration Guide

## Overview

This guide covers the enhanced Longhorn component configuration options, including the new RBAC management, CRD pre-creation, and prerequisite validation features that resolve common uninstaller issues.

## Configuration Options

### Basic Configuration

```typescript
import { LonghornComponent } from '../infrastructure/components/longhorn';

const longhorn = new LonghornComponent('longhorn', {
  namespace: 'longhorn-system',
  chartVersion: '1.5.3',
  environment: 'staging',
  domain: 'example.com',
  defaultStorageClass: true,
  replicaCount: 3,
  adminPassword: pulumi.secret('longhorn-admin-password'),
});
```

### Enhanced RBAC Configuration

The enhanced Longhorn component includes automatic RBAC management for the uninstaller job:

```typescript
const longhorn = new LonghornComponent('longhorn', {
  // ... basic configuration
  
  // RBAC Configuration (optional - enabled by default)
  enableUninstallerRbac: true,
  uninstallerTimeoutSeconds: 300,
  validatePrerequisites: true,
});
```

#### RBAC Configuration Options

| Option | Type | Default | Description |
|--------|------|---------|-------------|
| `enableUninstallerRbac` | `boolean` | `true` | Enables automatic creation of dedicated RBAC resources for the uninstaller |
| `uninstallerTimeoutSeconds` | `number` | `300` | Timeout in seconds for uninstaller job execution |
| `validatePrerequisites` | `boolean` | `true` | Enables prerequisite validation before deployment |

### Backup Configuration

```typescript
const longhorn = new LonghornComponent('longhorn', {
  // ... basic configuration
  
  // S3 Backup Configuration
  backupTarget: 's3://my-backup-bucket@us-west-2/',
  s3BackupConfig: {
    bucket: 'my-backup-bucket',
    region: 'us-west-2',
    accessKeyId: pulumi.secret('s3-access-key'),
    secretAccessKey: pulumi.secret('s3-secret-key'),
    endpoint: 'https://s3.us-west-2.amazonaws.com', // optional
  },
});
```

## RBAC Resources Created

When `enableUninstallerRbac` is enabled (default), the component automatically creates:

### 1. ServiceAccount
- **Name**: `longhorn-uninstaller`
- **Namespace**: Same as Longhorn namespace
- **Purpose**: Dedicated identity for uninstaller operations

### 2. ClusterRole
- **Name**: `longhorn-uninstaller`
- **Permissions**: Comprehensive access to Longhorn CRDs and cleanup operations
- **Resources**: 
  - All Longhorn CRDs (`*.longhorn.io`)
  - Jobs, Pods, Services
  - PersistentVolumes, PersistentVolumeClaims
  - StorageClasses, VolumeAttachments

### 3. ClusterRoleBinding
- **Name**: `longhorn-uninstaller`
- **Binds**: ServiceAccount to ClusterRole
- **Scope**: Cluster-wide permissions

## CRD Management

The enhanced component includes automatic CRD pre-creation to prevent timing conflicts:

### Features
- **Pre-creation Job**: Ensures required CRDs exist before Helm deployment
- **Settings Validation**: Creates `deleting-confirmation-flag` setting automatically
- **Conflict Resolution**: Handles existing CRD versions gracefully

### CRDs Managed
- `engines.longhorn.io`
- `replicas.longhorn.io`
- `settings.longhorn.io`
- `volumes.longhorn.io`
- `engineimages.longhorn.io`
- `nodes.longhorn.io`
- `instancemanagers.longhorn.io`

## Prerequisite Validation

The component automatically validates node prerequisites before deployment:

### Validated Prerequisites
- **open-iscsi**: Required for iSCSI volume mounting
- **Node readiness**: Ensures nodes are ready for storage operations
- **Kernel modules**: Validates required kernel modules are loaded

### Validation Process
1. Creates validation job in the Longhorn namespace
2. Runs checks on all cluster nodes
3. Reports missing prerequisites with remediation steps
4. Blocks deployment if critical prerequisites are missing

## Environment-Specific Configuration

### Staging Environment
```typescript
// infrastructure/config/staging.ts
export const longhornConfig = {
  namespace: 'longhorn-system',
  chartVersion: '1.5.3',
  environment: 'staging' as const,
  domain: 'staging.example.com',
  defaultStorageClass: true,
  replicaCount: 1, // Reduced for staging
  validatePrerequisites: true,
  uninstallerTimeoutSeconds: 600, // Extended for slower staging nodes
};
```

### Production Environment
```typescript
// infrastructure/config/production.ts
export const longhornConfig = {
  namespace: 'longhorn-system',
  chartVersion: '1.5.3',
  environment: 'production' as const,
  domain: 'example.com',
  defaultStorageClass: true,
  replicaCount: 3,
  validatePrerequisites: true,
  uninstallerTimeoutSeconds: 300,
  // Production backup configuration
  backupTarget: 's3://prod-longhorn-backups@us-west-2/',
  s3BackupConfig: {
    bucket: 'prod-longhorn-backups',
    region: 'us-west-2',
    accessKeyId: pulumi.secret('prod-s3-access-key'),
    secretAccessKey: pulumi.secret('prod-s3-secret-key'),
  },
};
```

## Integration with Other Components

### ArgoCD Integration
The Longhorn component integrates seamlessly with ArgoCD for GitOps workflows:

```typescript
// The component automatically creates ArgoCD applications when deployed in GitOps mode
const longhorn = new LonghornComponent('longhorn', {
  // ... configuration
  // ArgoCD integration is handled automatically
});
```

### MetalLB Integration
Longhorn works with MetalLB for load balancer services:

```typescript
// Ensure MetalLB is deployed before Longhorn for ingress functionality
const metallb = new MetalLBComponent('metallb', metallbConfig);
const longhorn = new LonghornComponent('longhorn', {
  // ... configuration
}, { dependsOn: [metallb] });
```

## Monitoring and Observability

### Health Checks
The component includes built-in health checks:
- **Deployment Status**: Monitors Helm chart deployment progress
- **Pod Readiness**: Validates all Longhorn pods are ready
- **Volume Health**: Checks storage volume availability

### Logging
Enhanced logging provides detailed information about:
- RBAC resource creation
- CRD pre-creation progress
- Prerequisite validation results
- Deployment status and errors

### Metrics
The component exposes metrics for monitoring:
- Deployment duration
- Uninstaller job success rate
- Prerequisite validation results
- Resource creation status

## Best Practices

### 1. Resource Sizing
- **Staging**: Use `replicaCount: 1` for cost optimization
- **Production**: Use `replicaCount: 3` for high availability
- **Large Clusters**: Consider increasing timeout values

### 2. Security
- Always use Pulumi secrets for sensitive configuration
- Enable RBAC validation in production environments
- Regularly rotate backup credentials

### 3. Backup Strategy
- Configure S3 backups for production environments
- Test backup and restore procedures regularly
- Use separate backup buckets for different environments

### 4. Upgrade Strategy
- Test upgrades in staging environment first
- Monitor uninstaller job logs during upgrades
- Validate storage functionality after upgrades

## Migration from Legacy Configuration

If migrating from a legacy Longhorn deployment:

1. **Backup existing data** before migration
2. **Update configuration** to use new interface
3. **Enable RBAC management** for improved reliability
4. **Test uninstaller functionality** in staging
5. **Monitor deployment** for any issues

### Example Migration
```typescript
// Legacy configuration
const longhorn = new LonghornComponent('longhorn', {
  namespace: 'longhorn-system',
  chartVersion: '1.4.0',
  // ... basic options only
});

// Enhanced configuration
const longhorn = new LonghornComponent('longhorn', {
  namespace: 'longhorn-system',
  chartVersion: '1.5.3',
  // ... basic options
  
  // New enhanced options
  enableUninstallerRbac: true,
  validatePrerequisites: true,
  uninstallerTimeoutSeconds: 300,
});
```
