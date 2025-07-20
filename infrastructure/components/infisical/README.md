# Infisical Component

A simplified, maintainable Infisical secrets management component for homelab Kubernetes deployments.

## Features

- **Proven Helm Charts**: Uses bitnami/postgresql and bitnami/redis for reliability
- **Security First**: Dedicated service account with minimal RBAC permissions for secrets management
- **Homelab Optimized**: Simple configuration suitable for small-scale deployments
- **Integrated**: Works seamlessly with existing Traefik, cert-manager, and Longhorn infrastructure
- **Secure**: Proper secret management, TLS termination, and principle of least privilege
- **Lightweight**: ~250 lines of code vs 1000+ lines in complex implementations

## Architecture

```
InfisicalComponent
├── Namespace (dedicated namespace)
├── PostgreSQL (bitnami/postgresql Helm chart)
├── Redis (bitnami/redis Helm chart - optional)
├── RBAC (dedicated service account, role, and role binding)
├── Infisical App (single deployment with dedicated service account)
├── Service (ClusterIP)
└── Ingress (Traefik with cert-manager TLS)
```

## Usage

### Basic Deployment

```typescript
import { InfisicalComponent } from "./component-infisical-new";

const infisical = new InfisicalComponent("infisical", {
  namespace: "infisical",
  environment: "prd",
  domain: "secrets.homelab.local",
  
  databaseConfig: {
    storageSize: "20Gi",
    username: "infisical",
    password: config.requireSecret("db-password"),
    database: "infisical",
  },
  
  infisicalConfig: {
    authSecret: config.requireSecret("auth-secret"),
    encryptionKey: config.requireSecret("encryption-key"),
    adminEmail: "admin@homelab.local",
    adminPassword: config.requireSecret("admin-password"),
    siteUrl: "https://secrets.homelab.local",
  },
});
```

### With Redis Caching

```typescript
const infisical = new InfisicalComponent("infisical", {
  // ... basic config ...
  
  redisConfig: {
    storageSize: "2Gi",
    password: config.requireSecret("redis-password"),
  },
});
```

## Configuration

### Required Configuration

- `namespace`: Kubernetes namespace for deployment
- `environment`: Environment type ("dev", "stg", "prd")
- `domain`: Domain for ingress access
- `databaseConfig`: PostgreSQL configuration
- `infisicalConfig`: Infisical application settings

### Optional Configuration

- `redisConfig`: Redis caching configuration
- `postgresqlChartVersion`: Specific PostgreSQL chart version
- `redisChartVersion`: Specific Redis chart version

## Security

### RBAC Implementation

The Infisical component implements **dedicated RBAC resources** for security:

- **Service Account**: Dedicated `infisical` service account (not default)
- **Role**: Minimal permissions for secrets management operations:
  - `secrets`: `get`, `list`, `watch`, `create`, `update`, `patch`, `delete`
  - `configmaps`: `get`, `list`, `watch` (read-only)
  - `serviceaccounts`: `get`, `list`, `watch` (read-only)
- **Role Binding**: Associates service account with role

### Security Best Practices

- **Principle of Least Privilege**: Only necessary permissions granted
- **Namespace Isolation**: All resources scoped to dedicated namespace
- **Secret Management**: Application secrets properly encrypted at rest
- **TLS Encryption**: All traffic encrypted with cert-manager certificates
- **No Default Service Account**: Uses dedicated service account for better security posture

## Dependencies

This component depends on the following infrastructure components:

- **Longhorn**: For persistent storage (automatically configured)
- **Traefik**: For ingress routing (automatically configured)
- **cert-manager**: For TLS certificates (automatically configured)

## Secrets Management

### **⚠️ CRITICAL: Secrets Must Be Set Before Deployment**

These secrets **MUST be configured BEFORE running `pulumi up`**:

```bash
# Generate and set all required secrets
pulumi config set --secret infisical-db-password "$(openssl rand -base64 24)"
pulumi config set --secret infisical-redis-password "$(openssl rand -base64 24)"
pulumi config set --secret infisical-jwt-secret "$(openssl rand -hex 32)"
pulumi config set --secret infisical-encryption-key "$(openssl rand -base64 32)"
pulumi config set --secret infisical-admin-password "$(openssl rand -base64 16)"

# CRITICAL: Backup your encryption key!
pulumi config get --secret infisical-encryption-key > ~/.secrets/infisical-encryption-key.backup
chmod 600 ~/.secrets/infisical-encryption-key.backup
```

### **Deployment Script**

For easier setup, use the deployment script from `example-usage.ts` that automatically generates missing secrets and backs up the encryption key.

## Testing

Run unit tests:

```bash
cd infrastructure/
pnpm test components/infisical/component-infisical-new.test.ts
```

## Troubleshooting

### Common Issues

1. **PostgreSQL won't start**: Check if Longhorn storage class is available
2. **Ingress not working**: Verify Traefik is running and cert-manager is configured
3. **Application errors**: Check application logs for database connection issues

### Debugging Commands

```bash
# Check component status
kubectl get pods -n infisical

# Check PostgreSQL logs
kubectl logs -n infisical <postgresql-pod-name>

# Check Infisical application logs
kubectl logs -n infisical <infisical-pod-name>

# Check ingress status
kubectl get ingress -n infisical
```

## Migration from Complex Implementation

If migrating from the previous complex implementation:

1. **Backup existing data**: Export secrets from current deployment
2. **Deploy new component**: Use this simplified implementation
3. **Import data**: Restore secrets to new deployment
4. **Update DNS**: Point domain to new ingress
5. **Clean up**: Remove old complex deployment

## Chart Versions

Default chart versions used:
- PostgreSQL: `15.5.32` (bitnami/postgresql)
- Redis: `19.6.4` (bitnami/redis)

These can be overridden via `postgresqlChartVersion` and `redisChartVersion` parameters.

## Contributing

When making changes:

1. Keep it simple - avoid over-engineering
2. Follow existing project patterns (like Traefik/cert-manager components)
3. Use proven Helm charts instead of custom implementations
4. Add tests for new functionality
5. Update documentation