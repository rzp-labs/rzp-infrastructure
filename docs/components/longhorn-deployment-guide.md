# Longhorn Deployment Guide

## Overview

This guide provides step-by-step instructions for deploying Longhorn distributed storage using the enhanced component with automatic RBAC management, CRD pre-creation, and prerequisite validation.

## Prerequisites

### 1. System Requirements

#### Minimum Requirements
- **Kubernetes**: v1.21 or later
- **Nodes**: At least 3 nodes for production (1 for staging)
- **CPU**: 2 cores per node minimum
- **Memory**: 4GB RAM per node minimum
- **Storage**: 50GB available storage per node

#### Recommended Requirements
- **Kubernetes**: v1.25 or later
- **Nodes**: 3-5 nodes for production
- **CPU**: 4 cores per node
- **Memory**: 8GB RAM per node
- **Storage**: 100GB+ SSD storage per node

### 2. Node Prerequisites

#### Required Packages
All nodes must have the following packages installed:

**Ubuntu/Debian:**
```bash
sudo apt-get update
sudo apt-get install -y open-iscsi nfs-common
```

**RHEL/CentOS/Rocky Linux:**
```bash
sudo yum install -y iscsi-initiator-utils nfs-utils
```

#### Required Services
```bash
# Enable and start iscsid service
sudo systemctl enable iscsid
sudo systemctl start iscsid

# Verify service status
sudo systemctl status iscsid
```

#### Kernel Modules
Required kernel modules (usually loaded automatically):
- `iscsi_tcp`
- `nfs`
- `nfsd`

Verify modules are available:
```bash
# Check if modules can be loaded
sudo modprobe iscsi_tcp
sudo modprobe nfs
lsmod | grep -E "(iscsi|nfs)"
```

### 3. Kubernetes Cluster Prerequisites

#### Storage Classes
Ensure your cluster has a default storage class or plan to make Longhorn the default:
```bash
# Check existing storage classes
kubectl get storageclass

# Check which is default
kubectl get storageclass -o jsonpath='{.items[?(@.metadata.annotations.storageclass\.kubernetes\.io/is-default-class=="true")].metadata.name}'
```

#### RBAC Permissions
Ensure your deployment user has cluster-admin permissions:
```bash
# Verify permissions
kubectl auth can-i create clusterroles
kubectl auth can-i create clusterrolebindings
kubectl auth can-i create customresourcedefinitions
```

## Pre-deployment Validation

### 1. Automated Prerequisite Check

The enhanced Longhorn component includes automatic prerequisite validation. However, you can run manual checks:

```bash
# Create a validation script
cat > validate-longhorn-prerequisites.sh << 'EOF'
#!/bin/bash

echo "=== Longhorn Prerequisites Validation ==="

# Check Kubernetes version
echo "Checking Kubernetes version..."
kubectl version --short

# Check nodes
echo -e "\nChecking nodes..."
kubectl get nodes -o wide

# Check for open-iscsi on each node
echo -e "\nChecking open-iscsi installation..."
for node in $(kubectl get nodes -o jsonpath='{.items[*].metadata.name}'); do
    echo "Checking node: $node"
    kubectl debug node/$node -it --image=busybox -- chroot /host which iscsiadm 2>/dev/null && echo "  ✓ open-iscsi found" || echo "  ✗ open-iscsi missing"
done

# Check storage classes
echo -e "\nChecking storage classes..."
kubectl get storageclass

# Check available resources
echo -e "\nChecking node resources..."
kubectl top nodes 2>/dev/null || echo "Metrics server not available"

echo -e "\n=== Validation Complete ==="
EOF

chmod +x validate-longhorn-prerequisites.sh
./validate-longhorn-prerequisites.sh
```

### 2. Manual Node Validation

For each node, verify the following:

```bash
# SSH to each node and run:
# Check open-iscsi
which iscsiadm
systemctl status iscsid

# Check available storage
df -h
lsblk

# Check kernel modules
lsmod | grep iscsi
```

## Deployment Steps

### 1. Environment Configuration

First, set up your environment-specific configuration:

#### Staging Environment
```typescript
// infrastructure/config/staging.ts
export const longhornConfig = {
  namespace: 'longhorn-system',
  chartVersion: '1.5.3',
  environment: 'staging' as const,
  domain: 'staging.example.com',
  defaultStorageClass: true,
  replicaCount: 1,
  adminPassword: pulumi.secret('longhorn-admin-password'),
  
  // Enhanced features
  enableUninstallerRbac: true,
  validatePrerequisites: true,
  uninstallerTimeoutSeconds: 600,
};
```

#### Production Environment
```typescript
// infrastructure/config/production.ts
export const longhornConfig = {
  namespace: 'longhorn-system',
  chartVersion: '1.5.3',
  environment: 'production' as const,
  domain: 'example.com',
  defaultStorageClass: true,
  replicaCount: 3,
  adminPassword: pulumi.secret('longhorn-admin-password'),
  
  // Enhanced features
  enableUninstallerRbac: true,
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

### 2. Component Integration

Add Longhorn to your infrastructure stack:

```typescript
// infrastructure/index.ts
import { LonghornComponent } from './components/longhorn';
import { longhornConfig } from './config/staging'; // or production

// Ensure dependencies are deployed first
const metallb = new MetalLBComponent('metallb', metallbConfig);
const certManager = new CertManagerComponent('cert-manager', certManagerConfig);

// Deploy Longhorn with dependencies
const longhorn = new LonghornComponent('longhorn', longhornConfig, {
  dependsOn: [metallb, certManager],
});

// Export important outputs
export const longhornNamespace = longhorn.namespace;
export const longhornStorageClass = longhorn.storageClassName;
```

### 3. Deployment Execution

#### Using Pulumi
```bash
# Navigate to infrastructure directory
cd infrastructure

# Preview deployment
pulumi preview

# Deploy to staging
pulumi up --stack staging

# Deploy to production (after staging validation)
pulumi up --stack production
```

#### Monitoring Deployment Progress

```bash
# Watch namespace creation
kubectl get namespace longhorn-system -w

# Monitor RBAC resource creation
kubectl get serviceaccount,clusterrole,clusterrolebinding | grep longhorn

# Watch CRD creation
kubectl get crd | grep longhorn

# Monitor pod deployment
kubectl get pods -n longhorn-system -w

# Check deployment status
kubectl get all -n longhorn-system
```

### 4. Post-deployment Validation

#### Verify Core Components
```bash
# Check all pods are running
kubectl get pods -n longhorn-system

# Verify daemonsets
kubectl get daemonset -n longhorn-system

# Check deployments
kubectl get deployment -n longhorn-system

# Verify services
kubectl get service -n longhorn-system
```

#### Verify Storage Functionality
```bash
# Check storage class
kubectl get storageclass longhorn

# Create test PVC
kubectl apply -f - <<EOF
apiVersion: v1
kind: PersistentVolumeClaim
metadata:
  name: longhorn-test-pvc
  namespace: default
spec:
  accessModes:
    - ReadWriteOnce
  storageClassName: longhorn
  resources:
    requests:
      storage: 1Gi
EOF

# Verify PVC is bound
kubectl get pvc longhorn-test-pvc

# Clean up test PVC
kubectl delete pvc longhorn-test-pvc
```

#### Verify Longhorn Nodes
```bash
# Check Longhorn node status
kubectl get nodes.longhorn.io -n longhorn-system

# Verify node readiness
kubectl get nodes.longhorn.io -n longhorn-system -o wide
```

## Advanced Configuration

### 1. Custom Storage Classes

Create additional storage classes for different use cases:

```yaml
# High-performance storage class
apiVersion: storage.k8s.io/v1
kind: StorageClass
metadata:
  name: longhorn-fast
provisioner: driver.longhorn.io
allowVolumeExpansion: true
parameters:
  numberOfReplicas: "2"
  staleReplicaTimeout: "30"
  fromBackup: ""
  fsType: "ext4"
  dataLocality: "strict-local"
---
# Backup-enabled storage class
apiVersion: storage.k8s.io/v1
kind: StorageClass
metadata:
  name: longhorn-backup
provisioner: driver.longhorn.io
allowVolumeExpansion: true
parameters:
  numberOfReplicas: "3"
  recurringJobSelector: '[{"name":"backup", "isGroup":true}]'
  fromBackup: ""
  fsType: "ext4"
```

### 2. Backup Configuration

#### S3 Backup Setup
```bash
# Create S3 credentials secret
kubectl create secret generic s3-backup-credentials \
  --from-literal=AWS_ACCESS_KEY_ID=your-access-key \
  --from-literal=AWS_SECRET_ACCESS_KEY=your-secret-key \
  -n longhorn-system

# Configure backup target
kubectl apply -f - <<EOF
apiVersion: longhorn.io/v1beta2
kind: Setting
metadata:
  name: backup-target
  namespace: longhorn-system
spec:
  value: "s3://your-backup-bucket@us-west-2/"
---
apiVersion: longhorn.io/v1beta2
kind: Setting
metadata:
  name: backup-target-credential-secret
  namespace: longhorn-system
spec:
  value: "s3-backup-credentials"
EOF
```

### 3. Monitoring Setup

#### Prometheus Integration
```yaml
# ServiceMonitor for Prometheus
apiVersion: monitoring.coreos.com/v1
kind: ServiceMonitor
metadata:
  name: longhorn-prometheus-servicemonitor
  namespace: longhorn-system
  labels:
    name: longhorn-prometheus-servicemonitor
spec:
  selector:
    matchLabels:
      app: longhorn-manager
  endpoints:
  - port: manager
```

## Troubleshooting Deployment

### Common Issues During Deployment

#### 1. Prerequisite Validation Failures
```bash
# Check validation job logs
kubectl logs -n longhorn-system job/longhorn-prerequisite-validation

# Manual prerequisite check
kubectl get events -n longhorn-system | grep -i prerequisite
```

#### 2. RBAC Creation Issues
```bash
# Verify RBAC resources
kubectl get serviceaccount longhorn-uninstaller -n longhorn-system
kubectl get clusterrole longhorn-uninstaller
kubectl get clusterrolebinding longhorn-uninstaller

# Check permissions
kubectl auth can-i create jobs --as=system:serviceaccount:longhorn-system:longhorn-uninstaller
```

#### 3. CRD Timing Issues
```bash
# Check CRD pre-creation job
kubectl logs -n longhorn-system job/longhorn-crd-setup

# Verify CRDs exist
kubectl get crd | grep longhorn

# Check deleting-confirmation-flag
kubectl get settings.longhorn.io deleting-confirmation-flag -n longhorn-system
```

### Recovery Procedures

#### Restart Deployment
```bash
# Delete failed jobs
kubectl delete job -n longhorn-system -l app=longhorn

# Restart Pulumi deployment
pulumi up --stack <environment>
```

#### Force Clean Installation
```bash
# Complete cleanup (use with caution)
helm uninstall longhorn -n longhorn-system
kubectl delete namespace longhorn-system
kubectl delete crd -l app.kubernetes.io/name=longhorn

# Redeploy
pulumi up --stack <environment>
```

## Maintenance and Operations

### 1. Regular Health Checks

Create a health check script:
```bash
#!/bin/bash
echo "=== Longhorn Health Check ==="

# Check pod status
echo "Pod Status:"
kubectl get pods -n longhorn-system | grep -v Running | grep -v Completed || echo "All pods running"

# Check volume status
echo -e "\nVolume Status:"
kubectl get volumes.longhorn.io -n longhorn-system --no-headers | wc -l | xargs echo "Total volumes:"

# Check node status
echo -e "\nNode Status:"
kubectl get nodes.longhorn.io -n longhorn-system -o custom-columns=NAME:.metadata.name,READY:.status.conditions[0].status

# Check storage usage
echo -e "\nStorage Usage:"
kubectl top nodes 2>/dev/null | grep -E "(NAME|%)" || echo "Metrics not available"
```

### 2. Backup Verification

```bash
# List backups
kubectl get backups.longhorn.io -n longhorn-system

# Test restore (in staging)
kubectl apply -f - <<EOF
apiVersion: longhorn.io/v1beta2
kind: Volume
metadata:
  name: test-restore
  namespace: longhorn-system
spec:
  fromBackup: "backup-name"
  numberOfReplicas: 1
  size: "1Gi"
EOF
```

### 3. Upgrade Procedures

```bash
# Update chart version in configuration
# infrastructure/config/staging.ts
chartVersion: '1.6.0'

# Test in staging first
pulumi up --stack staging

# Monitor upgrade
kubectl get pods -n longhorn-system -w

# Verify functionality
kubectl get storageclass longhorn
kubectl get volumes.longhorn.io -n longhorn-system

# Deploy to production
pulumi up --stack production
```

## Security Considerations

### 1. RBAC Best Practices
- Use dedicated service accounts for different operations
- Apply principle of least privilege
- Regular RBAC audits

### 2. Network Security
- Use network policies to restrict access
- Secure backup credentials
- Monitor access logs

### 3. Data Protection
- Enable encryption at rest
- Regular backup testing
- Secure backup storage

## Performance Optimization

### 1. Node Optimization
- Use SSD storage for better performance
- Ensure adequate CPU and memory
- Optimize network connectivity

### 2. Volume Configuration
- Choose appropriate replica count
- Use data locality settings
- Configure appropriate storage classes

### 3. Monitoring and Alerting
- Set up performance monitoring
- Configure alerts for issues
- Regular performance reviews

This deployment guide ensures a successful Longhorn installation with all the enhanced features for improved reliability and maintainability.
