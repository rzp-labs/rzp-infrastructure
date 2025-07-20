# Deployment Playbook

## Pre-Deployment Checklist

### 1. Node Prerequisites
Ensure all K3s nodes have required packages:
```bash
# Check if prerequisites are installed
ssh admin_ops@NODE_IP "which iscsiadm && systemctl is-active iscsid"

# If missing, install manually:
ssh admin_ops@NODE_IP "sudo apt update && sudo apt install -y open-iscsi nfs-common util-linux && sudo systemctl enable --now iscsid open-iscsi"
```

### 2. Repository State
- Verify all placeholder secrets are git-safe
- Confirm sync wave annotations are correct
- Check namespace pod security policies

## Deployment Sequence

### Phase 1: Infrastructure Bootstrap
1. **Deploy ArgoCD** (via Pulumi)
2. **Apply core-infrastructure** Application
3. **Monitor sync waves** - Applications should appear in order

### Phase 2: Manual Application Deployment
If directory sync doesn't auto-create applications:
```bash
# Apply operators first
kubectl apply -f kubernetes/core/infisical-secrets-operator.yaml
kubectl apply -f kubernetes/core/longhorn.yaml

# Apply dependent applications
kubectl apply -f kubernetes/core/core-secrets.yaml
```

### Phase 3: Credential Configuration
```bash
# Patch real Infisical credentials (never commit to git)
kubectl patch secret infisical-auth-credentials -n infisical-secrets-system --patch='
stringData:
  clientId: "YOUR_ACTUAL_CLIENT_ID"
  clientSecret: "YOUR_ACTUAL_CLIENT_SECRET"
'

# Restart operator to pick up credentials
kubectl rollout restart deployment infisical-secre-controller-manager -n infisical-secrets-system
```

## Troubleshooting Common Issues

### Pod Security Violations
**Symptom:** `violates PodSecurity "restricted:latest"`
```bash
# Check namespace security policy
kubectl get namespace NAMESPACE -o yaml | grep pod-security

# Fix: Update to privileged for operators
kubectl patch namespace NAMESPACE --patch='
metadata:
  labels:
    pod-security.kubernetes.io/enforce: privileged
    pod-security.kubernetes.io/audit: privileged
    pod-security.kubernetes.io/warn: privileged
'
```

### Longhorn Storage Issues
**Symptom:** `failed to execute: iscsiadm --version`
```bash
# Install prerequisites on all nodes
for node in $(kubectl get nodes -o name | cut -d/ -f2); do
  ssh admin_ops@$node "sudo apt install -y open-iscsi && sudo systemctl enable --now iscsid"
done

# Restart Longhorn managers
kubectl delete pods -n longhorn-system -l app=longhorn-manager
```

### Application Sync Issues
**Symptom:** Applications stuck "OutOfSync" or "Unknown"
```bash
# Force refresh
kubectl annotate application APP_NAME -n argocd argocd.argoproj.io/refresh=normal --overwrite

# Check application health
kubectl describe application APP_NAME -n argocd | grep -A 10 "Health\\|Sync"
```

## Health Verification

### Check Application Status
```bash
kubectl get applications -n argocd
```

### Verify Storage Classes
```bash
kubectl get storageclass
# Should show: longhorn (default)
```

### Test Secret Synchronization
```bash
# Check if Infisical secrets are created
kubectl get secret cloudflare-api-token -n cert-manager

# Verify InfisicalSecret status
kubectl get infisicalsecret -A
```

### Validate Ingress
```bash
# Check LoadBalancer IP assignment
kubectl get svc -n traefik traefik -o wide

# Test TLS certificates
kubectl get certificate -A
```

## Recovery Procedures

### After Host Crash
1. **Wait for ArgoCD reconnection** - Applications will show "Unknown" temporarily
2. **Check Longhorn managers** - May need restart if prerequisites changed
3. **Verify operator pods** - Controllers may need restart for config changes
4. **Force application sync** if needed

### Application Cleanup
```bash
# Remove old/renamed applications
kubectl delete application OLD_APP_NAME -n argocd

# Apply new applications
kubectl apply -f kubernetes/core/NEW_APP.yaml
```

## Architecture Dependencies

### Sync Wave Dependencies
- Wave 0: Namespaces
- Wave 1: Operators (Infisical, MetalLB) 
- Wave 2: Configuration (Infisical secrets)
- Wave 3: cert-manager
- Wave 4: Longhorn storage
- Wave 5: Traefik (needs MetalLB + Longhorn + cert-manager)

### Critical Path
**Traefik depends on ALL THREE:**
- MetalLB (for LoadBalancer service)
- Longhorn (for persistent storage)
- cert-manager (for TLS certificates)

Any failure in this chain will block Traefik deployment.