# Secrets Management with Infisical

This platform uses Infisical as the centralized secrets management solution, integrated with Kubernetes via the External Secrets Operator.

## Architecture

```
Infisical Dashboard → API → External Secrets Operator → Kubernetes Secrets → Applications
      ↓               ↓            ↓                        ↓               ↓
  Secret Storage   Auth Token   Synchronization         Native K8s      Pod Env Vars
  Web Interface    Machine ID   Custom Resources        Secret API      Volume Mounts
```

## Components

### **🔐 Infisical Platform**

- **Service**: `https://infisical.stg.rzp.one`
- **Purpose**: Centralized secret storage and management
- **Features**: Web UI, API, audit logs, secret rotation

### **🔄 External Secrets Operator**

- **Namespace**: `external-secrets-system`
- **Purpose**: Synchronizes secrets from Infisical to Kubernetes
- **CRDs**: SecretStore, ClusterSecretStore, ExternalSecret

### **📦 Secret Organization**

#### **Core Secrets Project**

- **Project**: `core-secrets`
- **Environment**: `stg`
- **Secrets**:
  - `cloudflare-api-token` - DNS01 challenge for cert-manager

#### **Platform Secrets Project**

- **Project**: `platform-secrets`
- **Environment**: `stg`
- **Secrets**:
  - Database passwords (PostgreSQL, Redis)
  - JWT secrets and encryption keys
  - OIDC client credentials
  - S3 access keys

## Initial Setup Process

### **1. Deploy Infisical**

```bash
# Deploy Infisical application first
kubectl apply -f kubernetes/platform/infisical.yaml
```

### **2. Configure Infisical**

1. **Access**: Navigate to `https://infisical.stg.rzp.one`
2. **Complete setup** wizard with admin account
3. **Create organizations**: "RZP Infrastructure"
4. **Create projects**:
   - `core-secrets` (for infrastructure)
   - `platform-secrets` (for platform services)

### **3. Create Machine Identities**

For each project, create machine identities for External Secrets Operator:

1. Navigate to **Project Settings** → **Machine Identities**
2. **Create** new machine identity:
   - **Name**: "external-secrets-operator"
   - **Role**: "Admin" (or custom role with read access)
3. **Generate** client credentials:
   - Copy **Client ID**
   - Copy **Client Secret**

### **4. Add Secrets to Infisical**

Add all required secrets to their respective projects:

#### **Core Secrets Project**

```
cloudflare-api-token = "your-cloudflare-api-token"
```

#### **Platform Secrets Project**

```
# Database passwords
infisical-db-password = "secure-random-password"
infisical-redis-password = "secure-random-password"
zitadel-db-password = "secure-random-password"
zitadel-postgres-password = "secure-random-password"
openobserve-db-password = "secure-random-password"
openobserve-postgres-password = "secure-random-password"

# Application secrets
infisical-auth-secret = "32-char-random-string"
infisical-encryption-key = "32-char-random-string"
infisical-admin-password = "admin-password"
zitadel-master-key = "32-char-random-string"
openobserve-root-password = "admin-password"
openobserve-jwt-secret = "32-char-random-string"

# OIDC credentials (after Zitadel setup)
zitadel-auth-proxy-client-id = "client-id-from-zitadel"
zitadel-auth-proxy-client-secret = "client-secret-from-zitadel"
zitadel-auth-proxy-secret = "32-char-session-secret"

# Optional S3 credentials
openobserve-s3-access-key = "s3-access-key"
openobserve-s3-secret-key = "s3-secret-key"
```

### **5. Configure External Secrets Operator**

Update the auth credentials in the secret stores:

```bash
# Update the Infisical client credentials
kubectl patch secret infisical-auth-credentials -n external-secrets-system --patch='
stringData:
  client-id: "your-client-id"
  client-secret: "your-client-secret"
'
```

### **6. Deploy Secret Infrastructure**

```bash
# Deploy External Secrets Operator
kubectl apply -f kubernetes/platform/external-secrets.yaml

# Deploy secret stores and ExternalSecrets
kubectl apply -f kubernetes/platform/infisical-secrets.yaml
kubectl apply -f kubernetes/core/core-secrets.yaml
```

### **7. Verify Secret Synchronization**

```bash
# Check External Secrets Operator
kubectl get pods -n external-secrets-system

# Check ClusterSecretStores
kubectl get clustersecretstore

# Check ExternalSecrets status
kubectl get externalsecret -A

# Verify secrets were created
kubectl get secret -n longhorn-system
kubectl get secret -n zitadel
kubectl get secret -n observability
kubectl get secret -n infisical
```

## Secret Lifecycle Management

### **🔄 Adding New Secrets**

1. **Add to Infisical**: Use web UI or API
2. **Create ExternalSecret**: Reference the new secret
3. **Update application**: Use the generated Kubernetes secret

### **🔑 Secret Rotation**

1. **Update in Infisical**: Change secret value
2. **Automatic sync**: External Secrets Operator detects change
3. **Pod restart**: May be needed for applications to pick up new values

### **📊 Monitoring**

```bash
# Check synchronization status
kubectl describe externalsecret <name> -n <namespace>

# View External Secrets Operator logs
kubectl logs -n external-secrets-system -l app.kubernetes.io/name=external-secrets

# Check secret store connectivity
kubectl describe clustersecretstore infisical-platform-secrets
```

## Security Considerations

### **🔐 Access Control**

- **Machine identities** have minimal required permissions
- **Environment separation** via Infisical projects
- **Network policies** restrict External Secrets Operator access

### **🔍 Audit Trail**

- **Infisical audit logs** track all secret access
- **Kubernetes events** show secret synchronization
- **External Secrets metrics** available for monitoring

### **🛡️ Best Practices**

- **Rotate secrets regularly** using Infisical's rotation features
- **Use least privilege** for machine identity permissions
- **Monitor failed synchronizations** for security issues
- **Backup Infisical database** for disaster recovery

## Troubleshooting

### **❌ ExternalSecret Not Syncing**

```bash
# Check ExternalSecret status
kubectl describe externalsecret <name> -n <namespace>

# Check secret store connectivity
kubectl describe clustersecretstore <store-name>

# Check operator logs
kubectl logs -n external-secrets-system -l app.kubernetes.io/name=external-secrets
```

### **🔑 Authentication Issues**

```bash
# Verify machine identity credentials
kubectl get secret infisical-auth-credentials -n external-secrets-system -o yaml

# Test Infisical API connectivity
kubectl run -it --rm debug --image=curlimages/curl --restart=Never -- \
  curl -H "Authorization: Bearer <token>" https://infisical.stg.rzp.one/api/v1/auth/verify
```

### **📦 Application Not Getting Secrets**

```bash
# Check if Kubernetes secret exists
kubectl get secret <secret-name> -n <namespace>

# Verify secret content
kubectl get secret <secret-name> -n <namespace> -o yaml

# Check pod environment variables
kubectl exec <pod-name> -n <namespace> -- env | grep <SECRET_VAR>
```

This centralized secrets management eliminates hardcoded credentials while maintaining GitOps principles and providing enterprise-grade security features.
