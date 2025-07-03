# ArgoCD Secret Configuration

## Overview

ArgoCD admin password is now properly managed using Pulumi's secret configuration system, ensuring security best practices and consistency with other infrastructure secrets.

## Configuration Steps

### 1. Set ArgoCD Admin Password

```bash
# Navigate to infrastructure directory
cd infrastructure

# Set a secure password as a Pulumi secret
pulumi config set --secret argoCdAdminPassword "your-secure-password"

# Or generate a random secure password
pulumi config set --secret argoCdAdminPassword "$(openssl rand -base64 32)"
```

### 2. Verify Configuration

```bash
# Check that the secret is set (will show encrypted value)
pulumi config

# View the actual password (if needed)
pulumi config get argoCdAdminPassword --show-secrets
```

### 3. Deploy ArgoCD

```bash
# Deploy the infrastructure (ArgoCD will use the configured password)
pulumi up
```

## How It Works

### Pulumi Component Integration

The `ArgoCdBootstrap` component automatically reads the password from Pulumi config:

```typescript
// In argocd-resources.ts
const cfg = new pulumi.Config();
const adminPassword = config.adminPassword ?? cfg.getSecret("argoCdAdminPassword") ?? pulumi.secret("argocd-admin-fallback");
```

### Precedence Order

1. **Explicit parameter**: If `adminPassword` is passed to the component
2. **Pulumi config**: Reads `argoCdAdminPassword` from stack configuration
3. **Fallback secret**: Uses a Pulumi-generated secret as last resort

### Environment-Specific Passwords

Different environments can have different passwords:

```bash
# Staging environment
pulumi stack select staging
pulumi config set --secret argoCdAdminPassword "staging-password"

# Production environment  
pulumi stack select production
pulumi config set --secret argoCdAdminPassword "production-password"
```

## Security Benefits

### ✅ **Encrypted Storage**
- Password is encrypted in Pulumi state
- Never visible in Git repository
- Proper secret management practices

### ✅ **Environment Isolation**
- Different passwords per environment/stack
- No shared secrets between staging/production
- Audit trail of secret changes

### ✅ **Consistent Patterns**
- Same approach as SSH keys and other secrets
- Follows Pulumi best practices
- Integrates with existing infrastructure patterns

## Access After Deployment

### ArgoCD UI Login

1. **URL**: `https://argocd.staging.rzp.local` (or your configured domain)
2. **Username**: `admin`
3. **Password**: The password you set in Pulumi config

### Retrieve Password If Forgotten

```bash
# From Pulumi config
pulumi config get argoCdAdminPassword --show-secrets

# From Kubernetes secret (alternative method)
kubectl -n argocd get secret argocd-initial-admin-secret -o jsonpath="{.data.password}" | base64 -d
```

### CLI Access

```bash
# Install ArgoCD CLI
brew install argocd

# Login using the configured password
argocd login argocd.staging.rzp.local --username admin

# List applications
argocd app list
```

## Troubleshooting

### Password Not Set Error

If you get an error about missing password:

```bash
# Check if secret is configured
pulumi config get argoCdAdminPassword

# If not set, configure it
pulumi config set --secret argoCdAdminPassword "your-password"

# Redeploy
pulumi up
```

### Password Change

To change the ArgoCD admin password:

```bash
# Update Pulumi config
pulumi config set --secret argoCdAdminPassword "new-password"

# Redeploy to update the secret
pulumi up

# ArgoCD will automatically pick up the new password
```

### Emergency Access

If you're locked out of ArgoCD:

```bash
# Reset admin password directly in Kubernetes
kubectl -n argocd patch secret argocd-initial-admin-secret \
  -p '{"data":{"password":"'$(echo -n "emergency-password" | base64)'"}}'

# Restart ArgoCD server to pick up the change
kubectl -n argocd rollout restart deployment argocd-server

# Update Pulumi config to match
pulumi config set --secret argoCdAdminPassword "emergency-password"
```

This ensures the ArgoCD password is managed securely and consistently with the rest of the infrastructure secrets.