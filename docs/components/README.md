# Components Documentation

This directory contains documentation for infrastructure components used in the rzp-infra project.

## Available Components

### Longhorn Distributed Storage

Longhorn provides distributed block storage for Kubernetes clusters with built-in backup and disaster recovery capabilities.

#### Documentation

- **[Configuration Guide](./longhorn-configuration.md)** - Comprehensive guide for configuring Longhorn with enhanced RBAC, CRD management, and prerequisite validation
- **[Deployment Guide](./longhorn-deployment-guide.md)** - Step-by-step deployment instructions with prerequisite validation and best practices
- **[Troubleshooting Guide](./longhorn-troubleshooting.md)** - Solutions for common Longhorn deployment and uninstaller issues

#### Key Features

- **Enhanced RBAC Management**: Automatic creation of dedicated ServiceAccount, ClusterRole, and ClusterRoleBinding for uninstaller operations
- **CRD Pre-creation**: Ensures required CRDs and settings exist before Helm deployment to prevent timing conflicts
- **Prerequisite Validation**: Automatic validation of node prerequisites (open-iscsi, kernel modules) before deployment
- **Improved Error Handling**: Comprehensive error detection, reporting, and recovery mechanisms
- **Configurable Timeouts**: Customizable timeout values for different deployment phases

#### Quick Start

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
  
  // Enhanced features (enabled by default)
  enableUninstallerRbac: true,
  validatePrerequisites: true,
  uninstallerTimeoutSeconds: 300,
});
```

#### Common Use Cases

1. **Primary Storage**: Use as the default storage class for persistent volumes
2. **Backup Storage**: Configure S3 backups for disaster recovery
3. **High Availability**: Deploy with multiple replicas for data redundancy
4. **Development**: Single replica deployment for staging environments

#### Integration

Longhorn integrates seamlessly with other infrastructure components:

- **MetalLB**: For load balancer services and ingress
- **ArgoCD**: For GitOps-based deployment and management
- **Cert-Manager**: For TLS certificate management
- **Traefik**: For ingress and routing

## Contributing

When adding new component documentation:

1. Create a dedicated directory for the component (if needed)
2. Include configuration, deployment, and troubleshooting guides
3. Update this README with component information
4. Follow the established documentation patterns

## Documentation Standards

- Use clear, actionable headings
- Include code examples with proper syntax highlighting
- Provide troubleshooting sections with common issues
- Include prerequisite and dependency information
- Use consistent formatting and structure
