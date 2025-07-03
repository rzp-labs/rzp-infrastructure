# Test Directory Structure

This directory contains all tests for the infrastructure components, organized by component type and test category.

## Directory Organization

### 📁 Unit Tests (`unit/`)

Component-specific unit tests focusing on individual component behavior:

- **`unit/k3s/`** - K3s component tests
  - `k3s-master.test.ts` - K3sMaster component testing
  - `k3s-worker.test.ts` - K3sWorker component testing
  - `k3s-credentials.test.ts` - K3sCredentials component testing
  - `component-integration.test.ts` - Multi-component interaction testing
  - `configuration-validation.test.ts` - Configuration validation and error handling
  - `k8s-test-client-factory.test.ts` - Test client factory validation

- **`unit/proxmox/`** - Proxmox component tests (future)
  - ProxmoxNode component tests
  - VM configuration tests
  - Storage component tests

### 📁 Integration Tests (`integration/`)

End-to-end tests that validate complete functionality using Pulumi Automation SDK:

- **`integration/k3s/`** - K3s cluster integration tests
  - `ssh-tunnel-integration.test.ts` - SSH tunnel connectivity via Pulumi Automation SDK
  - `node-validation.test.ts` - Node configuration and state validation
  - `system-pods.test.ts` - System pod functionality validation
  - `network-functionality.test.ts` - Network and service testing

- **`integration/cluster/`** - Cross-component cluster tests
  - `cluster-connectivity.test.ts` - Overall cluster API connectivity (uses K3s but tests cluster-level functionality)

- **`integration/proxmox/`** - Proxmox integration tests (future)
  - VM lifecycle tests
  - Storage integration tests

### 📁 Fixtures (`fixtures/`)

Test setup and teardown utilities organized by component:

- **`fixtures/k3s/`** - K3s testing fixtures
  - `test-environment.ts` - Central test environment manager
  - `test-namespace-manager.ts` - Kubernetes namespace management
  - `test-resource-manager.ts` - Kubernetes resource lifecycle management
  - `pulumi-test-environment.ts` - Pulumi testing setup

- **`fixtures/proxmox/`** - Proxmox testing fixtures (future)
  - VM testing fixtures
  - Storage testing fixtures

### 📁 Helpers (`helpers/`)

Utility classes and helper functions for testing:

- **`helpers/k3s/`** - K3s testing helpers
  - `k8s-test-client.ts` - Kubernetes client wrapper (simplified, no tunnel injection)
  - `pulumi-tunnel-provisioner.ts` - Pulumi Automation SDK tunnel provisioner
  - `node-validator.ts` - Node state validation utilities
  - `pod-validator.ts` - Pod state validation utilities
  - `network-tester.ts` - Network functionality testing
  - `mock-node-factory.ts` - Mock data generation for testing
  - `kubeconfig-extractor.ts` - Kubeconfig extraction utilities
  - `pulumi-test-setup.ts` - Pulumi test environment setup

- **`helpers/proxmox/`** - Proxmox testing helpers (future)
  - VM management helpers
  - Storage testing helpers

## SSH Tunnel Integration Architecture (ADR-003)

The testing infrastructure uses **Pulumi Automation SDK** for SSH tunnel provisioning, following ADR-003:

### Benefits of Pulumi Automation SDK Approach

✅ **Eliminates Manual Secret Extraction**: No more complex `Output<string>` handling  
✅ **Architectural Consistency**: Uses same SSH patterns as production K3sMaster/K3sWorker components  
✅ **Industry Best Practices**: Follows Pulumi's official recommendations for infrastructure testing  
✅ **Proper Lifecycle Management**: Infrastructure provisioning with clean setup/teardown  

### Tunnel Provisioner Usage

```typescript
import { createK3sTunnelProvisioner } from "../helpers/k3s/pulumi-tunnel-provisioner";

// Create tunnel provisioner
const provisioner = createK3sTunnelProvisioner("10.10.0.20", "test-name");

// Provision tunnel infrastructure
const tunnelResult = await provisioner.provision();

// Create client using tunnel
const kubeconfig = `
apiVersion: v1
kind: Config
clusters:
- name: k3s
  cluster:
    server: https://localhost:${tunnelResult.localPort}
    insecure-skip-tls-verify: true
# ... rest of kubeconfig
`;

const client = new K8sTestClient(kubeconfig);

// Clean up infrastructure
await tunnelResult.destroy();
```

## Test Patterns

### AAA Pattern

All tests follow the **Arrange-Act-Assert** pattern:

```typescript
test("should validate expected behavior", async () => {
  // Arrange
  const testData = setupTestData();
  const expectedResult = "expected-value";

  // Act
  const actualResult = await performAction(testData);

  // Assert
  expect(actualResult).toBe(expectedResult);
});
```

### SOLID Principles

- **Single Responsibility**: Each test file focuses on one specific component or functionality
- **Dependency Injection**: Fixtures provide all dependencies through constructor injection
- **Interface Segregation**: Test utilities expose only the methods needed for testing

### Fixtures and Teardown

- **Isolation**: Each test runs in a unique namespace to prevent interference
- **Repeatability**: Complete cleanup ensures tests can be run multiple times
- **Resource Management**: All created resources are tracked and cleaned up automatically

## Running Tests

```bash
# Run all tests
pnpm test

# Run specific test categories
pnpm run test:unit
pnpm run test:integration

# Run tests for specific components
pnpm test -- tests/unit/k3s/
pnpm test -- tests/integration/k3s/

# Run with coverage
pnpm run test:coverage

# Run K3s-specific tests
pnpm run test:k3s
pnpm run test:k3s:unit
pnpm run test:k3s:integration
```

## Environment Requirements

### For Unit Tests
- No external dependencies required
- All mocking handled internally

### For Integration Tests with SSH Tunnels
- **Pulumi Configuration**: Proper Pulumi stack setup with SSH credentials
- **Proxmox Access**: SSH connectivity to target Proxmox nodes
- **Environment Variables**: 
  - `PULUMI_CONFIG_PASSPHRASE` (for encrypted configs)
  - `PULUMI_ACCESS_TOKEN` (for Pulumi service)

### Test Execution Flow
1. **Provision Infrastructure**: Pulumi Automation SDK creates SSH tunnel
2. **Run Tests**: Connect to cluster via localhost tunnel
3. **Clean Up**: Destroy tunnel infrastructure automatically

## Adding New Tests

When adding tests for new components:

1. **Create component directory**: `tests/unit/[component]/` and `tests/integration/[component]/`
2. **Add fixtures**: Create fixtures in `tests/fixtures/[component]/`
3. **Add helpers**: Create utilities in `tests/helpers/[component]/`
4. **Follow AAA pattern**: Structure all tests with clear Arrange-Act-Assert sections
5. **Use fixtures**: Leverage the fixture system for setup/teardown
6. **Maintain SOLID principles**: One responsibility per test file
7. **For SSH connectivity**: Use Pulumi tunnel provisioner for infrastructure-as-code approach

## Benefits of This Structure

- **🔍 Easy Navigation**: Find tests by component type quickly
- **🔧 Maintainable**: Changes to one component don't affect others
- **📖 Clear Separation**: Unit vs integration tests are clearly separated
- **🧪 Reusable**: Fixtures and helpers can be shared within component categories
- **📈 Scalable**: Easy to add new components and test types
- **🏗️ Infrastructure-as-Code**: Tests provision real infrastructure using Pulumi patterns
- **🔒 Security**: No manual secret extraction or credential management