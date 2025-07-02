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

- **`unit/proxmox/`** - Proxmox component tests (future)
  - ProxmoxNode component tests
  - VM configuration tests
  - Storage component tests

### 📁 Integration Tests (`integration/`)

End-to-end tests that validate complete functionality:

- **`integration/k3s/`** - K3s cluster integration tests
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
  - `k8s-test-client.ts` - Kubernetes client wrapper
  - `node-validator.ts` - Node state validation utilities
  - `pod-validator.ts` - Pod state validation utilities
  - `network-tester.ts` - Network functionality testing
  - `mock-node-factory.ts` - Mock data generation for testing
  - `kubeconfig-extractor.ts` - Kubeconfig extraction utilities
  - `pulumi-test-setup.ts` - Pulumi test environment setup

- **`helpers/proxmox/`** - Proxmox testing helpers (future)
  - VM management helpers
  - Storage testing helpers

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
```

## Adding New Tests

When adding tests for new components:

1. **Create component directory**: `tests/unit/[component]/` and `tests/integration/[component]/`
2. **Add fixtures**: Create fixtures in `tests/fixtures/[component]/`
3. **Add helpers**: Create utilities in `tests/helpers/[component]/`
4. **Follow AAA pattern**: Structure all tests with clear Arrange-Act-Assert sections
5. **Use fixtures**: Leverage the fixture system for setup/teardown
6. **Maintain SOLID principles**: One responsibility per test file

## Benefits of This Structure

- **🔍 Easy Navigation**: Find tests by component type quickly
- **🔧 Maintainable**: Changes to one component don't affect others
- **📖 Clear Separation**: Unit vs integration tests are clearly separated
- **🧪 Reusable**: Fixtures and helpers can be shared within component categories
- **📈 Scalable**: Easy to add new components and test types
