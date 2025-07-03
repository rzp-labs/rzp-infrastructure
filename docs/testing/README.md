# Testing Documentation

This directory contains comprehensive testing documentation for the rzp-infra project, which follows ADR-003 for Pulumi Automation SDK-based testing patterns.

## Documentation Overview

### 📋 **Core Testing Documentation**

- **[../infrastructure/tests/README.md](../../infrastructure/tests/README.md)** - Main test directory structure and patterns
- **[../infrastructure/tests/integration/README.md](../../infrastructure/tests/integration/README.md)** - Integration test setup and usage

### 🏗️ **Architecture and Patterns**

- **[pulumi-automation-sdk-patterns.md](pulumi-automation-sdk-patterns.md)** - Comprehensive guide to Pulumi Automation SDK testing patterns
- **[../architecture/decisions/ADR-003-pulumi-automation-sdk-for-integration-tests.md](../architecture/decisions/ADR-003-pulumi-automation-sdk-for-integration-tests.md)** - Architecture decision record

### 🔧 **Troubleshooting and Debugging**

- **[troubleshooting-guide.md](troubleshooting-guide.md)** - Common issues and solutions for testing problems

## Quick Start

### Prerequisites

```bash
# Ensure correct Node.js version
node --version  # Should be 18.x+

# Install dependencies
cd infrastructure
pnpm install

# Configure Pulumi for integration tests
export PULUMI_CONFIG_PASSPHRASE="your-passphrase"
pulumi config set proxmox:sshUsername "admin_ops"
pulumi config set --secret proxmox:sshPrivateKey "$(cat ~/.ssh/proxmox_key)"
```

### Running Tests

```bash
# Unit tests (no external dependencies)
pnpm run test:unit

# Integration tests (requires Pulumi + SSH access)
pnpm run test:integration

# Specific component tests
pnpm run test:k3s
```

## Architecture Overview

### Pulumi Automation SDK Integration

The testing infrastructure implements ADR-003 by using Pulumi's LocalWorkspace for SSH tunnel provisioning:

```typescript
// Provision tunnel using Pulumi Automation SDK
const provisioner = createK3sTunnelProvisioner("10.10.0.20", "test-name");
const tunnelResult = await provisioner.provision();

// Test against localhost via tunnel
const client = new K8sTestClient(kubeconfig);
// ... run tests

// Clean up infrastructure
await tunnelResult.destroy();
```

### Benefits

✅ **Architectural Consistency**: Uses same SSH patterns as production components  
✅ **No Manual Secret Extraction**: Native Pulumi secret resolution  
✅ **Proper Lifecycle Management**: Infrastructure provisioning with cleanup  
✅ **Industry Best Practices**: Follows Pulumi's official testing recommendations  

## Testing Layers

### 1. Unit Tests (`tests/unit/`)

- **Purpose**: Validate individual component behavior
- **Dependencies**: None (fully mocked)
- **Execution**: Fast (< 10 seconds)
- **Coverage**: Component logic, configuration validation, SOLID principles

### 2. Integration Tests (`tests/integration/`)

- **Purpose**: Validate end-to-end functionality with real infrastructure
- **Dependencies**: Pulumi configuration, SSH access, running K3s cluster
- **Execution**: Slower (30-60 seconds)
- **Coverage**: SSH connectivity, K3s API access, infrastructure provisioning

### 3. Fixtures and Helpers (`tests/fixtures/`, `tests/helpers/`)

- **Purpose**: Reusable test utilities and setup/teardown logic
- **Key Components**:
  - `PulumiTunnelProvisioner`: SSH tunnel infrastructure provisioning
  - `K8sTestClient`: Simplified Kubernetes client for testing
  - `NodeValidator`, `PodValidator`: Infrastructure state validation

## Development Workflow

### 1. Writing New Tests

```bash
# Create test file following patterns
tests/unit/[component]/[feature].test.ts
tests/integration/[component]/[scenario].test.ts

# Follow AAA pattern
test("should validate specific behavior", async () => {
  // Arrange
  const testData = setupTestData();
  
  // Act
  const result = await performAction(testData);
  
  // Assert
  expect(result).toBe(expectedValue);
});
```

### 2. Running During Development

```bash
# Watch mode for rapid feedback
pnpm run test:watch

# Specific test files
pnpm test tests/unit/k3s/k3s-master.test.ts

# Debug mode for integration tests
export PULUMI_LOG_LEVEL=debug
pnpm test tests/integration/k3s/ssh-tunnel-integration.test.ts --verbose
```

### 3. Quality Checks

```bash
# Type checking
pnpm run type-check

# Linting
pnpm run lint

# Full quality check
pnpm run quality:check
```

## Environment Requirements

### For Unit Tests
- Node.js 18+
- pnpm package manager
- No external dependencies

### For Integration Tests
- All unit test requirements
- Pulumi CLI and configuration
- SSH access to Proxmox infrastructure
- Running K3s cluster on target nodes

### Environment Variables

```bash
# Required for integration tests
export PULUMI_CONFIG_PASSPHRASE="your-passphrase"

# Optional: Pulumi service integration
export PULUMI_ACCESS_TOKEN="your-access-token"

# Optional: Debug logging
export PULUMI_LOG_LEVEL=debug
```

## Common Patterns

### SSH Tunnel Provisioning

```typescript
import { createK3sTunnelProvisioner } from "../helpers/k3s/pulumi-tunnel-provisioner";

const provisioner = createK3sTunnelProvisioner("10.10.0.20", "test-name");
const tunnelResult = await provisioner.provision();
// Use tunnelResult.localPort for connections
await tunnelResult.destroy();
```

### Test Client Creation

```typescript
import { K8sTestClient } from "../helpers/k3s/k8s-test-client";

const client = new K8sTestClient(kubeconfig);
await client.initialize();

if (client.isClusterAvailable()) {
  const api = client.getCoreApi();
  // ... use Kubernetes API
}

client.cleanup();
```

## Best Practices

### ✅ **Do**
- Use infrastructure-as-code patterns for integration tests
- Maintain proper setup/teardown in test lifecycle
- Follow SOLID principles in test design
- Use meaningful test names and clear documentation
- Leverage existing fixtures and helpers

### ❌ **Don't**
- Bypass Pulumi's secret management
- Leave infrastructure provisioned after tests
- Test implementation details across component boundaries
- Use manual secret extraction from Pulumi outputs
- Skip proper error handling in test setup

## Getting Help

### 1. Review Documentation
- Start with this README for overview
- Check specific guides for detailed patterns
- Review troubleshooting guide for common issues

### 2. Debug Information
```bash
# Collect diagnostic information
cd infrastructure
echo "=== Environment ==="
node --version && pnpm --version && pulumi version

echo "=== Configuration ==="
pulumi config && pulumi stack ls

echo "=== Connectivity ==="
ping -c 3 10.10.0.20
ssh -o ConnectTimeout=5 admin_ops@10.10.0.20 'echo "SSH working"'
```

### 3. Common Commands
```bash
# Reset test environment
pnpm run test:unit  # Validate basic functionality
export PULUMI_CONFIG_PASSPHRASE="your-passphrase"
pnpm test tests/integration/k3s/ssh-tunnel-integration.test.ts
```

This testing infrastructure provides a solid foundation for validating infrastructure code while maintaining consistency with production deployment patterns.