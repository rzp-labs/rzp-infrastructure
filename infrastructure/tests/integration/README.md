# Integration Tests

## Overview

Integration tests validate functionality against real K3s clusters. These tests require cluster connectivity and will skip gracefully when no cluster is available.

## Setup

### Environment Variables

Set `KUBECONFIG` to point to your cluster configuration:

```bash
export KUBECONFIG=/path/to/your/kubeconfig
```

### Default Locations

If `KUBECONFIG` is not set, tests will try:
1. `~/.kube/config` (default kubectl location)
2. Skip if no configuration found

## Security Guidelines

**NEVER commit kubeconfig files to version control.**

Kubeconfig files contain sensitive cluster credentials and should be:
- Stored outside the repository
- Referenced via environment variables
- Excluded from Git via `.gitignore`

## Running Tests

```bash
# Run all integration tests
pnpm test:integration

# Run specific integration test
pnpm test infrastructure/tests/integration/k3s/system-pods.test.ts
```

## Test Behavior

- **Cluster Available**: Tests run normally against the cluster
- **Cluster Unavailable**: Tests skip with warning messages
- **Connection Errors**: Tests fail with clear error messages

## Proxmox Cluster Access

For testing against the Proxmox K3s cluster:

1. Obtain kubeconfig from cluster administrator
2. Store in secure location outside repository
3. Set `KUBECONFIG` environment variable
4. Verify connectivity: `kubectl get nodes`

## CI/CD Integration

In CI environments, configure cluster access via:
- Secure environment variables
- Service account tokens
- Temporary kubeconfig generation

Never store credentials in CI configuration files.