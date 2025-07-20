# Pod Security Policy Requirements

## Overview
This document captures the pod security policy requirements discovered during deployment troubleshooting.

## Namespace Security Policies

### Privileged Namespaces
These namespaces require `privileged` pod security policy:

```yaml
pod-security.kubernetes.io/enforce: privileged
pod-security.kubernetes.io/audit: privileged
pod-security.kubernetes.io/warn: privileged
```

**Namespaces:**
- `infisical-secrets-system` - Infisical Secrets Operator requires privileged containers
- `longhorn-system` - Longhorn storage requires privileged access for disk management

### Restricted Namespaces
These namespaces can use `restricted` pod security policy:

```yaml
pod-security.kubernetes.io/enforce: restricted
pod-security.kubernetes.io/audit: restricted
pod-security.kubernetes.io/warn: restricted
```

**Namespaces:**
- `cert-manager` - Standard certificate management
- `traefik` - Ingress controller (when not using privileged ports)
- `metallb-system` - MetalLB load balancer

## Troubleshooting Context

### Issue: Infisical Operator Pod Security Violation
**Error:** `seccompProfile (pod or containers "kube-rbac-proxy", "manager" must set securityContext.seccompProfile.type to "RuntimeDefault" or "Localhost")`

**Root Cause:** Namespace had `restricted` policy but operator needs `privileged`

**Solution:** Update namespace to use `privileged` pod security policy

### Issue: Longhorn Prerequisites Missing
**Error:** `failed to execute: nsenter --mount=/host/proc/1680/ns/mnt --net=/host/proc/1680/ns/net iscsiadm --version`

**Root Cause:** `open-iscsi` package not installed on nodes

**Solution:** Added to cloud-init package installation and service enablement