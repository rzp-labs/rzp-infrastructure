# ArgoCD Troubleshooting Guide

## Application Lifecycle Issues

### Issue: Applications Not Auto-Created by Directory Sync
**Problem:** New applications in `kubernetes/core/` weren't automatically created by the `core-infrastructure` application.

**Root Cause:** ArgoCD directory sync only applies files, it doesn't create new Application resources from individual YAML files in the directory.

**Solution:** Manually apply new Application resources:
```bash
# Apply new applications manually
kubectl apply -f kubernetes/core/infisical-secrets-operator.yaml
kubectl apply -f kubernetes/core/longhorn.yaml
kubectl apply -f kubernetes/core/core-secrets.yaml
```

### Issue: Renamed Applications Leave Orphans
**Problem:** When renaming `core-external-secrets` to `core-infisical-secrets`, the old application continued trying to sync non-existent paths.

**Solution:** Clean up old applications before applying new ones:
```bash
# Delete old application
kubectl delete application core-external-secrets -n argocd

# Apply new application
kubectl apply -f kubernetes/core/core-secrets.yaml
```

## Sync Wave Architecture

### Current Working Order
- **Wave 0:** Namespaces
- **Wave 1:** Operators (Infisical, MetalLB)
- **Wave 2:** External Dependencies (Infisical secrets)
- **Wave 3:** cert-manager
- **Wave 4:** Longhorn storage
- **Wave 5:** Traefik (needs MetalLB + Longhorn + cert-manager)

### Key Dependencies
- **Traefik** requires all three: MetalLB (LoadBalancer), Longhorn (storage), cert-manager (TLS)
- **Infisical secrets** require Infisical operator to be running first
- **Storage classes** must exist before persistent volumes are created

## Host Crash Recovery

### Applications Survive Reboots
ArgoCD applications and their configurations persist through host crashes. Applications will show "Unknown" status temporarily during reconnection but resume normal operation.

### Manual Interventions Needed After Crashes
1. **Check Longhorn managers** - May need pod restarts if storage prerequisites changed
2. **Verify operator pods** - Controllers may need restart to pick up configuration changes
3. **Force application refresh** - `kubectl annotate application APP -n argocd argocd.argoproj.io/refresh=normal --overwrite`