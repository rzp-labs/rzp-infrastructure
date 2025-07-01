# Secret Management Components

This document describes the secret management abstraction layer for RZP Infrastructure, which integrates with External
Secrets Operator and Infisical for secure credential management.

## Overview

The secret management components provide a type-safe, Pulumi-native way to manage secrets in Kubernetes using External
Secrets Operator. This abstraction handles:

- Connection to external secret stores (Infisical, Vault, AWS Secrets Manager)
- Automatic Kubernetes Secret creation from external sources
- Secret rotation and refresh policies
- Common patterns for database credentials, API keys, and TLS certificates

## Architecture

```
┌─────────────────┐     ┌──────────────────┐     ┌─────────────────┐
│   Infisical     │     │      Vault       │     │ AWS Secrets Mgr │
└────────┬────────┘     └────────┬─────────┘     └────────┬────────┘
         │                       │                          │
         └───────────────────────┴──────────────────────────┘
                                 │
                    ┌────────────▼────────────┐
                    │   External Secrets      │
                    │      Operator           │
                    └────────────┬────────────┘
                                 │
                ┌────────────────┴────────────────┐
                │                                 │
         ┌──────▼──────┐                ┌────────▼────────┐
         │ SecretStore │                │ ExternalSecret  │
         └──────┬──────┘                └────────┬────────┘
                │                                 │
                └────────────┬────────────────────┘
                             │
                    ┌────────▼────────┐
                    │ Kubernetes      │
                    │   Secret        │
                    └─────────────────┘
```

## Components

### Pydantic Models

#### SecretReference

Defines a reference to a secret in the external store:

```python
from infrastructure.models.secrets import SecretReference

ref = SecretReference(
    key="database-password",      # Key in the Kubernetes Secret
    path="/app/database",          # Path in external store
    property="password",           # Optional: specific property
    version="v2"                   # Optional: version (default: "latest")
)
```

#### SecretStoreConfig

Configuration for connecting to external secret stores:

```python
from infrastructure.models.secrets import SecretStoreConfig, InfisicalConfig

config = SecretStoreConfig(
    name="infisical-backend",
    namespace="platform",
    provider="infisical",
    refresh_interval="30m",
    infisical=InfisicalConfig(
        project_id="proj_123456",
        environment="production",
        service_token="st.prod.xxxxx",
        api_url="https://infisical.company.com"  # Optional
    )
)
```

#### ExternalSecretConfig

Configuration for creating Kubernetes secrets from external sources:

```python
from infrastructure.models.secrets import ExternalSecretConfig, SecretReference

config = ExternalSecretConfig(
    name="app-secrets",
    namespace="my-app",
    secret_store_ref="infisical-backend",
    target_secret_name="app-credentials",
    refresh_interval="1h",
    creation_policy="Owner",  # Owner, Merge, or Orphan
    data=[
        SecretReference(key="db-url", path="/app/database"),
        SecretReference(key="api-key", path="/app/stripe", property="key"),
    ]
)
```

### Components

#### SecretStore

Creates SecretStore or ClusterSecretStore resources:

```python
from infrastructure.components.secrets import SecretStore
from infrastructure.models.secrets import SecretStoreConfig, InfisicalConfig

# Namespace-scoped SecretStore
store_config = SecretStoreConfig(
    name="team-secrets",
    namespace="team-namespace",
    provider="infisical",
    infisical=InfisicalConfig(
        project_id="proj_team",
        environment="production",
        service_token="st.team.xxxxx"
    )
)

store = SecretStore("team-store", config=store_config)

# Cluster-scoped SecretStore
global_config = SecretStoreConfig(
    name="global-secrets",
    provider="vault",
    cluster_scoped=True
)

global_store = SecretStore("global-store", config=global_config)
```

#### ExternalSecret

Creates ExternalSecret resources with helper methods:

```python
from infrastructure.components.secrets import ExternalSecret

# Using configuration
secret = ExternalSecret("my-secret", config=secret_config)

# Using helper for database credentials
db_secret = ExternalSecret.database_credentials(
    name="postgres-creds",
    namespace="databases",
    secret_store_ref="infisical-backend",
    database_path="/databases/postgres/main",
    target_secret_name="postgres-connection"
)
# Creates secret with: host, port, username, password, database

# Using helper for API keys
api_secret = ExternalSecret.api_key(
    name="stripe-key",
    namespace="payments",
    secret_store_ref="vault-backend",
    api_path="/external/stripe",
    target_secret_name="stripe-secret",
    key_name="STRIPE_API_KEY"
)

# Using helper for TLS certificates
tls_secret = ExternalSecret.tls_certificate(
    name="app-tls",
    namespace="ingress",
    secret_store_ref="infisical-backend",
    cert_path="/certificates/app.example.com",
    target_secret_name="app-tls"
)
# Creates secret with: tls.crt, tls.key, ca.crt
```

## Usage Examples

### Complete Workflow

```python
import pulumi
from infrastructure.components.secrets import SecretStore, ExternalSecret
from infrastructure.models.secrets import (
    SecretStoreConfig,
    InfisicalConfig,
    ExternalSecretConfig,
    SecretReference
)

# 1. Create a SecretStore for your namespace
store_config = SecretStoreConfig(
    name="app-secret-store",
    namespace="my-app",
    provider="infisical",
    infisical=InfisicalConfig(
        project_id=pulumi.Config().require("infisical-project-id"),
        environment="production",
        service_token=pulumi.Config().require_secret("infisical-token")
    )
)

store = SecretStore("app-store", config=store_config)

# 2. Create ExternalSecrets that reference the store
db_secret = ExternalSecret.database_credentials(
    name="postgres",
    namespace="my-app",
    secret_store_ref="app-secret-store",
    database_path="/databases/postgres",
    target_secret_name="postgres-creds"
)

api_secret = ExternalSecret("api-keys", config=ExternalSecretConfig(
    name="external-apis",
    namespace="my-app",
    secret_store_ref="app-secret-store",
    target_secret_name="api-credentials",
    data=[
        SecretReference(key="stripe_key", path="/payments/stripe"),
        SecretReference(key="sendgrid_key", path="/email/sendgrid"),
        SecretReference(key="twilio_sid", path="/sms/twilio", property="account_sid"),
        SecretReference(key="twilio_token", path="/sms/twilio", property="auth_token"),
    ]
))
```

### Integration with BaseService

```python
from infrastructure.components.services import BaseService
from infrastructure.models.service import ServiceConfig

# The service automatically mounts secrets
service = BaseService(
    "my-app",
    config=ServiceConfig(
        name="my-app",
        namespace="my-app",
        env_from=[
            {"secretRef": {"name": "postgres-creds"}},
            {"secretRef": {"name": "api-credentials"}}
        ]
    )
)
```

## Best Practices

1. **Use Namespaced SecretStores**: Unless you need cluster-wide access, prefer namespace-scoped SecretStores for better
   isolation.

2. **Set Appropriate Refresh Intervals**:

   - Database credentials: 5-15 minutes
   - API keys: 1-6 hours
   - TLS certificates: 24 hours

3. **Use Helper Methods**: For common patterns like database credentials, use the provided helper methods for
   consistency.

4. **Organize Secret Paths**: Structure your paths in the external store logically:

   ```
   /databases/postgres/main
   /databases/mysql/analytics
   /external/stripe
   /external/sendgrid
   /certificates/app.example.com
   ```

5. **Handle Rotation**: Design your applications to handle secret rotation gracefully. The External Secrets Operator
   will update secrets based on the refresh interval.

## Security Considerations

1. **Service Token Protection**: Store Infisical service tokens as Kubernetes secrets, not in code
2. **RBAC**: Ensure proper RBAC for ExternalSecret resources
3. **Audit Logging**: Enable audit logging for secret access
4. **Network Policies**: Restrict network access from External Secrets Operator to secret stores

## Troubleshooting

### Secret Not Syncing

1. Check SecretStore status: `kubectl describe secretstore <name> -n <namespace>`
2. Verify service token is valid
3. Check External Secrets Operator logs
4. Ensure the path exists in the external store

### Permission Errors

1. Verify the service token has read access to the specified paths
2. Check RBAC permissions for the External Secrets Operator service account

### Refresh Not Working

1. Check the refresh interval format (e.g., "30s", "5m", "1h")
2. Look for errors in the ExternalSecret status
3. Verify the external store is accessible
