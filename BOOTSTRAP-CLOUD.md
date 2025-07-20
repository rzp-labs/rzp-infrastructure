# Infisical Cloud Bootstrap Strategy

Using Infisical Cloud for bootstrap secrets, then migrating to self-hosted with sync capabilities.

## 🌤️ Architecture

```
Phase 1: Infisical Cloud → Infisical Operator → cert-manager → TLS Working
Phase 2: Deploy self-hosted Infisical (with TLS)
Phase 3: Migrate secrets Cloud → Self-hosted
Phase 4: Switch Infisical Operator to self-hosted
```

## 🎯 Benefits

### **✅ Eliminates Bootstrap Problems**
- **No HTTP access** needed for initial setup
- **Immediate TLS** support from day one
- **No chicken-and-egg** dependency issues
- **Clean deployment** process

### **🔄 Migration Path**
- **Seamless transition** from cloud to self-hosted
- **Automated migration** via Kubernetes Job
- **Backup strategy** - cloud as disaster recovery
- **Sync capabilities** for ongoing operations

### **🛡️ Security Benefits**
- **External backup** of critical secrets
- **Disaster recovery** via cloud instance
- **Multi-environment** support (cloud prod, self-hosted stg)
- **Audit trail** across both instances

## 📋 Implementation Phases

### **Phase 1: Cloud Bootstrap (Day 0)**

1. **Setup Infisical Cloud**:
   - Create account at `https://app.infisical.com`
   - Create project: `rzp-bootstrap-secrets`
   - Add all bootstrap secrets:
     ```
     cloudflare-api-token
     infisical-db-password
     infisical-redis-password
     infisical-auth-secret
     infisical-encryption-key
     infisical-admin-password
     ```

2. **Create Machine Identity**:
   - Generate client ID/secret for Infisical Kubernetes Operator
   - Configure permissions for the bootstrap project

3. **Deploy with Cloud Secrets**:
   ```bash
   # Update cloud credentials
   kubectl patch secret infisical-cloud-universal-auth -n infisical-secrets-system --patch='
   stringData:
     client-id: "your-cloud-client-id"
     client-secret: "your-cloud-client-secret"
   '
   
   # Deploy Infisical Operator with cloud bootstrap
   kubectl apply -f kubernetes/platform/infisical-secrets/cloud-bootstrap-store.yaml
   
   # Deploy cert-manager (gets Cloudflare token from cloud)
   kubectl apply -f kubernetes/core/cert-manager.yaml
   
   # Deploy self-hosted Infisical (gets DB credentials from cloud)
   kubectl apply -f kubernetes/platform/infisical.yaml
   ```

### **Phase 2: Self-hosted Deployment (Day 1)**

4. **Verify TLS is working**:
   ```bash
   kubectl get certificate -A
   curl -I https://infisical.stg.rzp.one
   ```

5. **Setup self-hosted Infisical**:
   - Access: `https://infisical.stg.rzp.one`
   - Complete setup wizard
   - Create matching project structure
   - Create machine identities

### **Phase 3: Migration (Day 2)**

6. **Run migration job**:
   ```bash
   # Update migration job with project IDs
   kubectl patch configmap infisical-migration-script -n infisical --patch='
   data:
     CLOUD_PROJECT_ID: "your-cloud-project-id"
     SELF_PROJECT_ID: "your-self-hosted-project-id"
   '
   
   # Execute migration
   kubectl apply -f kubernetes/platform/infisical-secrets/migration-config.yaml
   ```

7. **Verify migration**:
   ```bash
   kubectl logs job/infisical-migration-job -n infisical
   ```

### **Phase 4: Switch to Self-hosted (Day 3)**

8. **Update ClusterSecretStore**:
   ```bash
   # Switch from cloud to self-hosted
   kubectl patch clustersecretstore infisical-platform-secrets --patch='
   spec:
     provider:
       infisical:
         hostAPI: "https://infisical.stg.rzp.one"
   '
   ```

9. **Restart Infisical Operator**:
   ```bash
   kubectl rollout restart deployment -n infisical-secrets-system infisical-secrets-operator-controller-manager
   ```

10. **Verify self-hosted sync**:
    ```bash
    kubectl get infisicalsecret -A
    kubectl describe infisicalsecret -n longhorn-system
    ```

## 🔄 Ongoing Operations

### **Backup Strategy**
- **Cloud instance** serves as backup/DR
- **Periodic sync** cloud ← self-hosted
- **Emergency fallback** to cloud if self-hosted fails

### **Multi-Environment**
- **Cloud**: Production secrets, backup storage
- **Self-hosted**: Staging/development secrets
- **Cross-sync**: Selected secrets between instances

### **Disaster Recovery**
```bash
# Emergency: Switch back to cloud
kubectl patch clustersecretstore infisical-platform-secrets --patch='
spec:
  provider:
    infisical:
      hostAPI: "https://app.infisical.com"
'

kubectl rollout restart deployment -n external-secrets-system external-secrets
```

## 🛠️ Migration Tools

### **Automated Migration Script**
- **API-based** secret transfer
- **Kubernetes Job** for execution
- **Error handling** and retry logic
- **Verification** of successful migration

### **Sync Monitoring**
```bash
# Check migration job status
kubectl get job infisical-migration-job -n infisical

# View migration logs
kubectl logs job/infisical-migration-job -n infisical

# Verify secrets in self-hosted
curl -H "Authorization: Bearer $TOKEN" \
  https://infisical.stg.rzp.one/api/v3/secrets?workspaceId=$PROJECT_ID&environment=stg
```

## 🔍 Verification Commands

### **Phase 1: Cloud Bootstrap**
```bash
# Verify cloud connectivity
kubectl describe clustersecretstore infisical-cloud-bootstrap

# Check bootstrap secrets
kubectl get secret cloudflare-api-token -n cert-manager
kubectl get secret infisical-db-credentials -n infisical
```

### **Phase 3: Migration**
```bash
# Check migration job
kubectl describe job infisical-migration-job -n infisical

# Verify secrets in self-hosted
kubectl exec -n infisical deployment/infisical -- \
  curl -s https://infisical.stg.rzp.one/api/status
```

### **Phase 4: Self-hosted**
```bash
# Verify switch to self-hosted
kubectl get externalsecret -A -o wide

# Check secret sync status
kubectl describe externalsecret cloudflare-api-token-bootstrap -n cert-manager
```

## 🚨 Troubleshooting

### **Cloud Authentication Issues**
```bash
# Test cloud connectivity
kubectl run debug --image=curlimages/curl --rm -it --restart=Never -- \
  curl -v https://app.infisical.com/api/v1/auth/universal-auth/login

# Check cloud credentials
kubectl get secret infisical-cloud-auth-credentials -n external-secrets-system -o yaml
```

### **Migration Failures**
```bash
# Check migration job logs
kubectl logs job/infisical-migration-job -n infisical

# Re-run migration
kubectl delete job infisical-migration-job -n infisical
kubectl apply -f kubernetes/platform/infisical-secrets/migration-config.yaml
```

### **Self-hosted Connectivity**
```bash
# Test self-hosted API
kubectl port-forward -n infisical svc/infisical 8080:80
curl http://localhost:8080/api/status

# Check self-hosted logs
kubectl logs -n infisical deployment/infisical
```

This approach provides a robust, production-ready bootstrap strategy with built-in migration and disaster recovery capabilities!