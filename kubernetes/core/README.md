# Core Platform Applications

This directory contains ArgoCD Application manifests for the core platform infrastructure components that were previously managed by Pulumi.

## Components

The following components are deployed in order using sync waves:

1. **MetalLB** (wave 1-2) - LoadBalancer for bare metal
2. **cert-manager** (wave 2-3) - TLS certificate management
3. **Traefik** (wave 3) - Ingress controller
4. **Longhorn** (wave 4-5) - Distributed storage
5. **Infisical** (wave 5-6) - Secrets management

## Deployment Order

The sync waves ensure proper deployment order:

- Wave 1: MetalLB controller
- Wave 2: MetalLB config, cert-manager
- Wave 3: cert-manager config, Traefik
- Wave 4: Longhorn
- Wave 5: Longhorn config, Infisical databases
- Wave 6: Infisical application

## Configuration Placeholders

Before deploying, replace these placeholders in the manifests:

### Global Configuration

- `rzp.one` - Your domain (e.g., `example.com`)
- `admin@rzp.one` - Your email for Let's Encrypt
- `CLOUDFLARE_API_TOKEN_PLACEHOLDER` - Your Cloudflare API token

### Longhorn Configuration

- `LONGHORN_PASSWORD_HASH_PLACEHOLDER` - Bcrypt hash of admin password

### Infisical Configuration

- `INFISICAL_DB_PASSWORD_PLACEHOLDER` - PostgreSQL password
- `INFISICAL_REDIS_PASSWORD_PLACEHOLDER` - Redis password
- `INFISICAL_AUTH_SECRET_PLACEHOLDER` - Auth secret (32+ chars)
- `INFISICAL_ENCRYPTION_KEY_PLACEHOLDER` - Encryption key (32+ chars)
- `INFISICAL_ADMIN_PASSWORD_PLACEHOLDER` - Admin password

## Usage

### Option 1: Deploy Core App of Apps

```bash
kubectl apply -f kubernetes/core/core.yaml
```

### Option 2: Deploy Individual Applications

```bash
kubectl apply -f kubernetes/core/metallb.yaml
kubectl apply -f kubernetes/core/cert-manager.yaml
kubectl apply -f kubernetes/core/traefik.yaml
kubectl apply -f kubernetes/core/longhorn.yaml
kubectl apply -f kubernetes/core/infisical.yaml
```

## Prerequisites

1. **Kubernetes cluster** with ArgoCD installed
2. **Longhorn requirements**:
   - open-iscsi installed on all nodes (handled by prerequisites DaemonSet)
   - At least 6GB free space per node
3. **Network requirements**:
   - IP range 10.10.0.200-10.10.210 available for LoadBalancer services
4. **DNS requirements**:
   - Cloudflare API access for DNS01 challenges

## Migration from Pulumi

To migrate from the current Pulumi-managed deployment:

1. **Prepare ArgoCD**: Ensure minimal ArgoCD is running
2. **Replace placeholders** in all manifests with actual values
3. **Deploy core applications**: Apply the core.yaml or individual manifests
4. **Remove from Pulumi**: Comment out platform components from Pulumi
5. **Verify deployment**: Check ArgoCD UI for application status

## Troubleshooting

### MetalLB Issues

- Check IP pool configuration in `metallb-config/ipaddresspool.yaml`
- Verify network connectivity to IP range

### Longhorn Issues

- Check open-iscsi installation via prerequisites DaemonSet
- Verify disk space and node readiness
- Check Longhorn UI at `https://longhorn.stg.rzp.one`

### Traefik Issues

- Verify LoadBalancer IP assignment
- Check ingress controller logs
- Verify certificate issuance

### ArgoCD Sync Issues

- Check sync waves and dependencies
- Verify repository access and paths
- Check ArgoCD application health status

## Security Notes

- All secrets use placeholders - replace with actual values before deployment
- Longhorn UI uses basic auth middleware via Traefik
- All services use TLS certificates from Let's Encrypt
- Infisical handles additional secrets management once deployed
