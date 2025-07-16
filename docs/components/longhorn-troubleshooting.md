# Longhorn Troubleshooting Guide

## Overview

This guide provides solutions for common Longhorn deployment and uninstaller issues. The enhanced Longhorn component addresses many of these issues automatically, but this guide helps diagnose and resolve problems when they occur.

## Common Uninstaller Issues

### 1. RBAC Permission Denied Errors

#### Symptoms
```
Error: jobs.batch is forbidden: User "system:serviceaccount:longhorn-system:default" cannot create resource "jobs" in API group "batch" at the cluster scope
```

#### Root Cause
The uninstaller job lacks proper RBAC permissions to perform cleanup operations.

#### Solution (Automatic)
The enhanced Longhorn component automatically creates proper RBAC resources:
- Dedicated ServiceAccount (`longhorn-uninstaller`)
- ClusterRole with comprehensive permissions
- ClusterRoleBinding for cluster-wide access

#### Manual Verification
```bash
# Check if RBAC resources exist
kubectl get serviceaccount longhorn-uninstaller -n longhorn-system
kubectl get clusterrole longhorn-uninstaller
kubectl get clusterrolebinding longhorn-uninstaller

# Verify permissions
kubectl auth can-i create jobs --as=system:serviceaccount:longhorn-system:longhorn-uninstaller
kubectl auth can-i delete customresourcedefinitions --as=system:serviceaccount:longhorn-system:longhorn-uninstaller
```

#### Manual Fix (if needed)
```bash
# Create ServiceAccount
kubectl create serviceaccount longhorn-uninstaller -n longhorn-system

# Apply ClusterRole and ClusterRoleBinding
kubectl apply -f - <<EOF
apiVersion: rbac.authorization.k8s.io/v1
kind: ClusterRole
metadata:
  name: longhorn-uninstaller
rules:
- apiGroups: [""]
  resources: ["pods", "services", "endpoints", "persistentvolumeclaims", "persistentvolumes"]
  verbs: ["*"]
- apiGroups: ["batch"]
  resources: ["jobs"]
  verbs: ["*"]
- apiGroups: ["apiextensions.k8s.io"]
  resources: ["customresourcedefinitions"]
  verbs: ["*"]
- apiGroups: ["longhorn.io"]
  resources: ["*"]
  verbs: ["*"]
---
apiVersion: rbac.authorization.k8s.io/v1
kind: ClusterRoleBinding
metadata:
  name: longhorn-uninstaller
roleRef:
  apiGroup: rbac.authorization.k8s.io
  kind: ClusterRole
  name: longhorn-uninstaller
subjects:
- kind: ServiceAccount
  name: longhorn-uninstaller
  namespace: longhorn-system
EOF
```

### 2. CRD Timing Conflicts

#### Symptoms
```
Error: the server could not find the requested resource (post settings.longhorn.io)
Error: deleting-confirmation-flag setting not found
```

#### Root Cause
Helm chart tries to create resources before CRDs are fully established, or the `deleting-confirmation-flag` setting is missing.

#### Solution (Automatic)
The enhanced component includes CRD pre-creation jobs that:
- Create required CRDs before Helm deployment
- Set up the `deleting-confirmation-flag` setting
- Wait for CRD readiness before proceeding

#### Manual Verification
```bash
# Check if CRDs exist
kubectl get crd | grep longhorn

# Check deleting-confirmation-flag setting
kubectl get settings.longhorn.io deleting-confirmation-flag -n longhorn-system -o yaml
```

#### Manual Fix (if needed)
```bash
# Create the deleting-confirmation-flag setting
kubectl apply -f - <<EOF
apiVersion: longhorn.io/v1beta2
kind: Setting
metadata:
  name: deleting-confirmation-flag
  namespace: longhorn-system
spec:
  value: "true"
EOF
```

### 3. Node Prerequisite Failures

#### Symptoms
```
Error: open-iscsi not found on node worker-1
Error: required kernel modules not loaded
```

#### Root Cause
Nodes lack required packages or kernel modules for Longhorn operation.

#### Solution (Automatic)
The enhanced component includes prerequisite validation that:
- Checks for open-iscsi installation on all nodes
- Validates required kernel modules
- Provides clear error messages with remediation steps

#### Manual Verification
```bash
# Check open-iscsi on all nodes
kubectl get nodes -o wide
for node in $(kubectl get nodes -o name); do
  echo "Checking $node:"
  kubectl debug $node -it --image=busybox -- chroot /host which iscsiadm
done

# Check Longhorn node status
kubectl get nodes.longhorn.io -n longhorn-system
```

#### Manual Fix
```bash
# Install open-iscsi on Ubuntu/Debian nodes
sudo apt-get update
sudo apt-get install -y open-iscsi

# Install open-iscsi on RHEL/CentOS nodes
sudo yum install -y iscsi-initiator-utils

# Enable and start iscsid service
sudo systemctl enable iscsid
sudo systemctl start iscsid

# Load required kernel modules
sudo modprobe iscsi_tcp
```

### 4. Uninstaller Job Timeout

#### Symptoms
```
Error: Job longhorn-uninstall-job exceeded timeout of 300 seconds
```

#### Root Cause
Uninstaller job takes longer than expected, often due to:
- Large number of volumes to clean up
- Slow storage backend
- Network connectivity issues

#### Solution (Automatic)
The enhanced component allows configurable timeout values:

```typescript
const longhorn = new LonghornComponent('longhorn', {
  // ... other config
  uninstallerTimeoutSeconds: 600, // Increase timeout to 10 minutes
});
```

#### Manual Fix
```bash
# Check uninstaller job status
kubectl get jobs -n longhorn-system | grep uninstall

# Check job logs
kubectl logs -n longhorn-system job/longhorn-uninstall-job

# Manually delete stuck resources if needed
kubectl delete volumes.longhorn.io --all -n longhorn-system
kubectl delete engines.longhorn.io --all -n longhorn-system
```

### 5. Persistent Volume Cleanup Issues

#### Symptoms
```
Error: PersistentVolume pvc-xxx is stuck in Terminating state
Error: Volume detachment failed
```

#### Root Cause
Volumes are still attached to nodes or have finalizers preventing deletion.

#### Solution
```bash
# Check PV status
kubectl get pv | grep longhorn

# Check volume attachments
kubectl get volumeattachments

# Force remove finalizers if needed (use with caution)
kubectl patch pv <pv-name> -p '{"metadata":{"finalizers":null}}'

# Check Longhorn volumes
kubectl get volumes.longhorn.io -n longhorn-system
```

## Deployment Issues

### 1. Helm Chart Deployment Failures

#### Symptoms
```
Error: failed to install chart: timeout waiting for condition
Error: Helm release failed
```

#### Diagnosis Steps
```bash
# Check Helm release status
helm list -n longhorn-system

# Check Helm release history
helm history longhorn -n longhorn-system

# Check pod status
kubectl get pods -n longhorn-system

# Check events
kubectl get events -n longhorn-system --sort-by='.lastTimestamp'
```

#### Common Solutions
```bash
# Rollback failed release
helm rollback longhorn -n longhorn-system

# Force reinstall (use with caution)
helm uninstall longhorn -n longhorn-system
# Wait for cleanup, then redeploy
```

### 2. Pod Startup Issues

#### Symptoms
```
Pod longhorn-manager-xxx is in CrashLoopBackOff
Pod longhorn-driver-deployer-xxx failed to start
```

#### Diagnosis
```bash
# Check pod logs
kubectl logs -n longhorn-system <pod-name>

# Check pod events
kubectl describe pod -n longhorn-system <pod-name>

# Check node resources
kubectl top nodes
kubectl describe node <node-name>
```

#### Common Solutions
- Ensure sufficient node resources (CPU, memory)
- Verify node labels and taints
- Check for conflicting storage drivers

### 3. Storage Class Issues

#### Symptoms
```
Error: StorageClass longhorn not found
Error: PVC stuck in Pending state
```

#### Diagnosis
```bash
# Check storage classes
kubectl get storageclass

# Check PVC status
kubectl get pvc -A

# Check Longhorn settings
kubectl get settings.longhorn.io -n longhorn-system
```

## Monitoring and Debugging

### 1. Component Status Monitoring

```bash
# Check overall Longhorn status
kubectl get pods -n longhorn-system
kubectl get daemonset -n longhorn-system
kubectl get deployment -n longhorn-system

# Check Longhorn nodes
kubectl get nodes.longhorn.io -n longhorn-system

# Check Longhorn volumes
kubectl get volumes.longhorn.io -n longhorn-system
```

### 2. Log Analysis

```bash
# Manager logs
kubectl logs -n longhorn-system deployment/longhorn-manager

# Driver logs
kubectl logs -n longhorn-system daemonset/longhorn-manager

# UI logs
kubectl logs -n longhorn-system deployment/longhorn-ui

# Instance manager logs
kubectl logs -n longhorn-system -l app=longhorn-instance-manager
```

### 3. Performance Monitoring

```bash
# Check resource usage
kubectl top pods -n longhorn-system

# Check volume performance
kubectl get volumes.longhorn.io -n longhorn-system -o wide

# Check engine status
kubectl get engines.longhorn.io -n longhorn-system
```

## Recovery Procedures

### 1. Complete Reinstallation

If Longhorn is in an unrecoverable state:

```bash
# 1. Backup important data first
kubectl get pvc -A -o yaml > pvc-backup.yaml

# 2. Scale down applications using Longhorn volumes
kubectl scale deployment <app-deployment> --replicas=0

# 3. Delete PVCs (this will delete data!)
kubectl delete pvc -l storageclass=longhorn

# 4. Uninstall Longhorn
helm uninstall longhorn -n longhorn-system

# 5. Clean up CRDs and resources
kubectl delete crd -l app.kubernetes.io/name=longhorn

# 6. Clean up namespace
kubectl delete namespace longhorn-system

# 7. Reinstall with enhanced component
# Use your Pulumi configuration
```

### 2. Partial Recovery

For specific component failures:

```bash
# Restart specific components
kubectl rollout restart deployment/longhorn-manager -n longhorn-system
kubectl rollout restart daemonset/longhorn-manager -n longhorn-system

# Force pod recreation
kubectl delete pod -l app=longhorn-manager -n longhorn-system
```

## Prevention Best Practices

### 1. Pre-deployment Validation
- Always run prerequisite validation
- Verify node resources and storage
- Test in staging environment first

### 2. Monitoring Setup
- Monitor Longhorn metrics and logs
- Set up alerts for deployment failures
- Regular health checks

### 3. Backup Strategy
- Regular volume backups
- Test restore procedures
- Document recovery processes

### 4. Upgrade Planning
- Test upgrades in staging
- Plan for rollback scenarios
- Monitor during upgrade process

## Getting Help

### 1. Log Collection
When reporting issues, collect:
```bash
# System information
kubectl version
kubectl get nodes -o wide

# Longhorn status
kubectl get all -n longhorn-system
kubectl get crd | grep longhorn

# Recent events
kubectl get events -n longhorn-system --sort-by='.lastTimestamp'

# Pod logs
kubectl logs -n longhorn-system -l app=longhorn-manager --tail=100
```

### 2. Configuration Export
```bash
# Export current configuration
helm get values longhorn -n longhorn-system > longhorn-values.yaml
kubectl get settings.longhorn.io -n longhorn-system -o yaml > longhorn-settings.yaml
```

### 3. Support Resources
- [Longhorn Documentation](https://longhorn.io/docs/)
- [Longhorn GitHub Issues](https://github.com/longhorn/longhorn/issues)
- Project-specific documentation in `docs/` directory
