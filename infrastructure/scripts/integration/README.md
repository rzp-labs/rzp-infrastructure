# Integration Tests

## Overview

Integration tests validate functionality against real K3s clusters using **Pulumi Automation SDK** for SSH tunnel provisioning. This approach follows ADR-003 and provides infrastructure-as-code testing patterns.

## Architecture (ADR-003)

### Pulumi Automation SDK Approach

Instead of manual secret extraction and direct SSH tunnel management, integration tests use Pulumi's LocalWorkspace to provision SSH tunnels as infrastructure:

```typescript
// ✅ NEW: Pulumi Automation SDK approach
const provisioner = createK3sTunnelProvisioner("10.10.0.20", "test-name");
const tunnelResult = await provisioner.provision();
// Tests run against localhost:${tunnelResult.localPort}
await tunnelResult.destroy(); // Clean infrastructure
```

### Benefits

✅ **Reuses Production SSH Patterns**: Same connection logic as K3sMaster/K3sWorker components  
✅ **Eliminates Manual Secret Handling**: Native Pulumi secret resolution  
✅ **Proper Lifecycle Management**: Infrastructure provisioning with setup/teardown  
✅ **Architectural Consistency**: Maintains single source of truth for SSH credentials

## Setup Requirements

### Environment Variables

Required for Pulumi Automation SDK:

```bash
# Pulumi configuration
export PULUMI_CONFIG_PASSPHRASE="your-passphrase"
export PULUMI_ACCESS_TOKEN="your-access-token"  # If using Pulumi service

# Optional: Control Pulumi behavior
export PULUMI_SKIP_UPDATE_CHECK=true
```

### Pulumi Stack Configuration

SSH credentials must be configured in your Pulumi stack:

```bash
# Configure SSH credentials (same as used by K3s components)
pulumi config set proxmox:sshUsername "admin_ops"
pulumi config set --secret proxmox:sshPrivateKey "$(cat ~/.ssh/proxmox_key)"
```

### Network Access

- **SSH Connectivity**: Tests need SSH access to Proxmox nodes
- **Target Hosts**: Default K3s master node IP is `10.10.0.20`
- **Ports**: SSH (22) and K3s API (6443) must be accessible

## Test Types

### 🔗 SSH Tunnel Integration (`ssh-tunnel-integration.test.ts`)

Tests the Pulumi Automation SDK tunnel provisioning:

```bash
# Run SSH tunnel integration tests
pnpm test tests/integration/k3s/ssh-tunnel-integration.test.ts
```

**What it validates:**

- Pulumi tunnel provisioner functionality
- SSH connectivity using production credentials
- K3s API access via tunnel
- Proper infrastructure lifecycle management

### 🔧 System Component Tests

Other integration tests that may use tunnels for remote cluster access:

- `node-validation.test.ts` - Node configuration validation
- `system-pods.test.ts` - System pod functionality
- `network-functionality.test.ts` - Network and service testing

## Running Tests

```bash
# Run all integration tests
pnpm test:integration

# Run K3s integration tests specifically
pnpm run test:k3s:integration

# Run specific test file
pnpm test tests/integration/k3s/ssh-tunnel-integration.test.ts

# With verbose output for debugging
pnpm test tests/integration/k3s/ssh-tunnel-integration.test.ts --verbose
```

## Test Behavior

### ✅ Successful Execution

- Provisions SSH tunnel infrastructure via Pulumi
- Connects to K3s cluster through localhost tunnel
- Validates cluster functionality
- Destroys tunnel infrastructure cleanly

### ⚠️ Environment Not Available

- Tests skip gracefully with warning messages
- No infrastructure provisioning attempted
- Clear indication of missing requirements

### ❌ Configuration Errors

- Missing Pulumi configuration: Clear error about setup requirements
- SSH connectivity issues: Network/credential problems indicated
- Cluster unavailable: API connectivity problems reported

## Troubleshooting

### Common Issues

**"Cannot find Pulumi stack"**

```bash
# Initialize Pulumi stack if needed
cd infrastructure
pulumi stack init dev
pulumi config set proxmox:endpoint "https://your-proxmox:8006"
# ... configure other settings
```

**"SSH connection refused"**

- Verify SSH key has access to target Proxmox nodes
- Check network connectivity: `ssh admin_ops@10.10.0.20`
- Verify Pulumi SSH configuration: `pulumi config get proxmox:sshUsername`

**"Tunnel provision timeout"**

- Check Proxmox node availability
- Verify SSH key format and permissions
- Ensure Pulumi has access to encrypted secrets

### Debug Mode

Enable verbose logging for tunnel provisioning:

```bash
# Set Pulumi log level
export PULUMI_LOG_LEVEL=debug

# Run tests with detailed output
pnpm test tests/integration/k3s/ssh-tunnel-integration.test.ts --verbose
```

## Security Guidelines

### ✅ **Secure Practices**

- SSH credentials stored in encrypted Pulumi config
- No secrets in code or environment variables
- Automatic cleanup of tunnel infrastructure
- Uses same security patterns as production components

### ❌ **Avoid These**

- Never commit SSH keys or credentials to Git
- Don't store `PULUMI_CONFIG_PASSPHRASE` in plain text files
- Avoid bypassing Pulumi's secret management

## CI/CD Integration

### Environment Setup

For CI environments, configure:

```yaml
# Example GitHub Actions
env:
  PULUMI_CONFIG_PASSPHRASE: ${{ secrets.PULUMI_CONFIG_PASSPHRASE }}
  PULUMI_ACCESS_TOKEN: ${{ secrets.PULUMI_ACCESS_TOKEN }}
```

### Test Execution

- Tests require Pulumi stack access in CI
- SSH connectivity to Proxmox infrastructure needed
- Consider using dedicated test infrastructure for CI

### Alternative Approaches

For CI environments without Proxmox access:

- Use mock implementations for SSH connectivity tests
- Focus on unit tests for CI pipelines
- Run integration tests in dedicated environments

## Extending for Other Components

The Pulumi tunnel provisioner pattern can be extended for other infrastructure testing:

```typescript
// Create provisioner for different service
const dbProvisioner = createDatabaseTunnelProvisioner("10.10.0.30", "postgres");
const tunnelResult = await dbProvisioner.provision();
// Test database connectivity via tunnel
```

This maintains consistency with the infrastructure-as-code approach across all components.
