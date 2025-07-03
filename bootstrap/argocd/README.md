# ArgoCD Bootstrap

## Overview

This directory contains the ArgoCD bootstrap configuration that enables GitOps for the entire rzp-infra repository. ArgoCD is deployed via Pulumi and then manages its own configuration through GitOps (inception pattern).

## Architecture

```
Pulumi (K3s + ArgoCD) → ArgoCD watches bootstrap/argocd → ArgoCD manages itself
```

## Bootstrap Process

### 1. Initial Deployment (via Pulumi)

ArgoCD is initially deployed using the `ArgoCdBootstrap` Pulumi component:

```typescript
const argocd = new ArgoCdBootstrap("argocd", {
  kubeconfig: k3sCredentials.kubeconfig,
  repositoryUrl: "https://github.com/stephen/rzp-infra.git",
  domain: "argocd.rzp.local",
});
```

**Required Configuration:**
```bash
# Set ArgoCD admin password as Pulumi secret
pulumi config set --secret argoCdAdminPassword "your-secure-password"
```

### 2. GitOps Takeover

Once ArgoCD is running, it creates an Application pointing to this directory (`bootstrap/argocd/`) and begins managing its own configuration.

### 3. Self-Healing

ArgoCD will automatically:

- Sync any changes to this directory
- Heal any configuration drift
- Manage its own updates and configuration

## Files

- **`namespace.yaml`**: ArgoCD namespace and initial admin secret
- **`gotk-sync.yaml`**: ArgoCD Application for self-management
- **`README.md`**: This documentation

## Access

### ArgoCD UI

- **URL**: `https://argocd.rzp.local` (or configured domain)
- **Username**: `admin`
- **Password**: The password you set in Pulumi config:
  ```bash
  # View the configured password (if needed)
  pulumi config get argoCdAdminPassword --show-secrets
  
  # Or retrieve from Kubernetes secret
  kubectl -n argocd get secret argocd-initial-admin-secret -o jsonpath="{.data.password}" | base64 -d
  ```

### CLI Access

```bash
# Install ArgoCD CLI
brew install argocd

# Login
argocd login argocd.rzp.local

# List applications
argocd app list
```

## Recovery Instructions

If ArgoCD becomes unavailable:

### 1. Check K3s Cluster

```bash
# Verify K3s is running
kubectl get nodes
kubectl get pods -n argocd
```

### 2. Redeploy via Pulumi

```bash
cd infrastructure
pulumi up
```

### 3. Manual Bootstrap (Emergency)

If Pulumi is unavailable, manually apply the bootstrap:

```bash
kubectl apply -f bootstrap/argocd/namespace.yaml
kubectl apply -f bootstrap/argocd/gotk-sync.yaml
```

### 4. Reset Admin Password

```bash
# Generate new password
kubectl -n argocd patch secret argocd-initial-admin-secret \
  -p '{"data":{"password":"'$(echo -n "new-password" | base64)'"}}'

# Restart ArgoCD server
kubectl -n argocd rollout restart deployment argocd-server
```

## Next Steps

Once ArgoCD is running:

1. **Add Core Services**: Create `kubernetes/core/` applications
2. **Platform Services**: Deploy observability, storage, security
3. **Application Services**: Add media, home-automation, dev-tools
4. **App-of-Apps**: Implement application-of-applications pattern

## Security Notes

- **Secure Password Management**: Admin password is managed via Pulumi secrets:
  ```bash
  # Set a strong password
  pulumi config set --secret argoCdAdminPassword "$(openssl rand -base64 32)"
  ```
- **RBAC**: Implement proper RBAC policies for production use
- **TLS**: Ensure ArgoCD UI is only accessible via HTTPS
- **Repository Access**: Use SSH keys or tokens for private repository access

## Troubleshooting

### ArgoCD Server Not Starting

```bash
kubectl -n argocd logs deployment/argocd-server
kubectl -n argocd describe pod -l app.kubernetes.io/name=argocd-server
```

### Sync Issues

```bash
# Check application status
argocd app get argocd-bootstrap

# Force sync
argocd app sync argocd-bootstrap

# View sync history
argocd app history argocd-bootstrap
```

### Network Issues

```bash
# Check ingress
kubectl -n argocd get ingress
kubectl -n argocd describe ingress argocd-server-ingress

# Check service
kubectl -n argocd get svc argocd-server
```
