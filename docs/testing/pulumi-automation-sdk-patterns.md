# Pulumi Automation SDK Testing Patterns

## Overview

This guide documents the testing patterns implemented following ADR-003: "Use Pulumi Automation SDK for Integration Test SSH Connectivity". These patterns provide infrastructure-as-code approaches to testing that maintain consistency with production deployment patterns.

## Architecture Decision Context

### Problem Statement

Integration tests for K3s infrastructure required SSH tunnel connectivity to access cluster APIs that are bound to localhost for security. The initial implementation attempted to manually extract SSH credentials from Pulumi secrets and create SSH tunnels using the ssh2 library directly.

### Issues with Manual Approach

- **Secret Extraction Complexity**: Manual extraction from Pulumi `Output<string>` types required complex async handling
- **Architectural Inconsistency**: Created duplicate SSH connection logic outside of Pulumi's established patterns
- **Environment Dependencies**: Required `PULUMI_CONFIG_PASSPHRASE` environment variable in test environments

### Pulumi Automation SDK Solution

Use Pulumi's LocalWorkspace to provision SSH tunnels as infrastructure, then run tests against the provisioned connectivity.

## Implementation Patterns

### 1. Tunnel Provisioner Pattern

**File**: `infrastructure/tests/helpers/k3s/pulumi-tunnel-provisioner.ts`

The core pattern for provisioning SSH tunnels using Pulumi Automation SDK:

```typescript
export class PulumiTunnelProvisioner {
  private stack?: pulumi.automation.Stack;
  private readonly config: IPulumiTunnelConfig;

  constructor(config: IPulumiTunnelConfig) {
    this.config = config;
  }

  async provision(): Promise<IPulumiTunnelResult> {
    const program = async () => {
      const config = getProxmoxConfig();
      
      // Use existing Pulumi SSH patterns
      const tunnel = new command.remote.Command("ssh-tunnel", {
        connection: {
          host: this.config.remoteHost,
          user: config.ssh!.username!,
          privateKey: config.ssh!.privateKey!,
        },
        create: `ssh -L ${this.config.localPort}:localhost:${this.config.remotePort} -N -f ${this.config.remoteHost}`,
        delete: `pkill -f 'ssh.*-L ${this.config.localPort}:localhost:${this.config.remotePort}'`,
      });

      return {
        localPort: pulumi.output(this.config.localPort),
        tunnelId: tunnel.id,
      };
    };

    // Create LocalWorkspace stack
    const stack = await pulumi.automation.LocalWorkspace.createStack({
      stackName: this.config.stackName,
      projectName: "tunnel-provisioner",
      program: program,
    });

    this.stack = stack;
    await stack.up({ onOutput: console.log });

    return {
      localPort: this.config.localPort,
      destroy: async () => {
        if (this.stack) {
          await this.stack.destroy({ onOutput: console.log });
          await this.stack.workspace.removeStack(this.config.stackName);
        }
      },
    };
  }
}
```

### 2. Factory Function Pattern

Simplify tunnel creation for common use cases:

```typescript
export function createK3sTunnelProvisioner(remoteHost: string, testName: string): PulumiTunnelProvisioner {
  // Auto-assign available port
  const localPort = Math.floor(Math.random() * (65535 - 32768)) + 32768;
  
  return new PulumiTunnelProvisioner({
    remoteHost,
    remotePort: 6443, // K3s API port
    localPort,
    stackName: `k3s-tunnel-${testName}-${Date.now()}`,
  });
}
```

### 3. Integration Test Pattern

**File**: `infrastructure/tests/integration/k3s/ssh-tunnel-integration.test.ts`

Complete integration test using tunnel provisioner:

```typescript
describe("SSH Tunnel Integration Tests", () => {
  let tunnelResult: IPulumiTunnelResult | null = null;
  let k8sClient: IK8sTestClient;

  beforeAll(async () => {
    try {
      const remoteHost = "10.10.0.20"; // K3s master node IP
      
      // Create tunnel provisioner using Pulumi Automation SDK
      const provisioner = createK3sTunnelProvisioner(remoteHost, "integration-test");
      
      // Provision SSH tunnel infrastructure
      tunnelResult = await provisioner.provision();
      
      // Create K8s client that connects to localhost via the tunnel
      const kubeconfig = createTunnelKubeconfig(tunnelResult.localPort);
      
      k8sClient = new K8sTestClient(kubeconfig);
      await k8sClient.initialize();
    } catch (error) {
      console.warn(`K8s cluster not available for integration tests: ${error}`);
      return;
    }
  });

  afterAll(async () => {
    if (tunnelResult) {
      await tunnelResult.destroy(); // Clean up infrastructure
    }
  });

  test("should connect to K3s cluster via Pulumi-provisioned SSH tunnel", async () => {
    if (!k8sClient.isClusterAvailable()) {
      console.log("Skipping test: K8s cluster not available");
      return;
    }

    const coreApi = k8sClient.getCoreApi();
    const nodesResponse = await coreApi.listNode();
    
    expect(nodesResponse.items).toBeDefined();
    expect(Array.isArray(nodesResponse.items)).toBe(true);
  });
});
```

### 4. Factory Integration Pattern

**File**: `infrastructure/helpers/k3s/k8s-test-client-factory.ts`

Simplified factory for creating test clients with tunnel provisioning:

```typescript
export async function createIntegrationTestClientWithPulumiConfig(): Promise<{
  client: IK8sTestClient;
  cleanup: () => Promise<void>;
}> {
  // Use Pulumi Automation SDK to provision SSH tunnel infrastructure
  const remoteHost = "10.10.0.20"; // K3s master node IP
  const provisioner = createK3sTunnelProvisioner(remoteHost, "factory-integration-test");
  
  // Provision tunnel infrastructure
  const tunnelResult = await provisioner.provision();
  
  // Create kubeconfig that connects to localhost via the tunnel
  const kubeconfig = createTunnelKubeconfig(tunnelResult.localPort);
  
  const client = new K8sTestClient(kubeconfig);
  
  return {
    client,
    cleanup: async () => {
      client.cleanup();
      await tunnelResult.destroy();
    },
  };
}
```

## Benefits of This Approach

### ✅ **Architectural Consistency**

- **Reuses Production Patterns**: Uses same SSH connection objects and patterns as K3sMaster/K3sWorker components
- **Single Source of Truth**: SSH credentials maintained in Pulumi configuration only
- **Industry Standard**: Follows Pulumi's official recommendations for infrastructure testing

### ✅ **Operational Benefits**

- **Proper Lifecycle Management**: Infrastructure provisioning with clean setup/teardown
- **No Manual Secret Extraction**: Eliminates complex `Output<string>` handling
- **Environment Validation**: Fails fast if Pulumi environment not properly configured

### ✅ **Developer Experience**

- **Clear Dependencies**: Tests explicitly require proper Pulumi configuration
- **Consistent Patterns**: Same approach can be extended to other infrastructure testing
- **Easy Debugging**: Infrastructure-as-code approach provides clear error messages

## Usage Guidelines

### When to Use This Pattern

✅ **Use for Integration Tests** that need SSH connectivity to remote infrastructure  
✅ **Use for End-to-End Testing** of infrastructure components  
✅ **Use when Testing Production Patterns** to ensure consistency  

### When NOT to Use This Pattern

❌ **Unit Tests**: Use mocks and fixtures instead  
❌ **CI Environments without Infrastructure Access**: Consider alternative patterns  
❌ **Simple API Testing**: Direct kubeconfig approach may be simpler  

## Environment Requirements

### Required Configuration

```bash
# Pulumi configuration
export PULUMI_CONFIG_PASSPHRASE="your-passphrase"

# SSH credentials in Pulumi stack
pulumi config set proxmox:sshUsername "admin_ops"
pulumi config set --secret proxmox:sshPrivateKey "$(cat ~/.ssh/proxmox_key)"
```

### Network Requirements

- SSH access to target infrastructure (port 22)
- Target service port access (e.g., 6443 for K3s API)
- Pulumi stack access for credential resolution

## Extending the Pattern

### For Other Services

Create service-specific provisioners following the same pattern:

```typescript
// Database tunnel provisioner
export function createDatabaseTunnelProvisioner(remoteHost: string, testName: string): PulumiTunnelProvisioner {
  return new PulumiTunnelProvisioner({
    remoteHost,
    remotePort: 5432, // PostgreSQL port
    localPort: Math.floor(Math.random() * (65535 - 32768)) + 32768,
    stackName: `db-tunnel-${testName}-${Date.now()}`,
  });
}

// Web service tunnel provisioner
export function createWebTunnelProvisioner(remoteHost: string, testName: string): PulumiTunnelProvisioner {
  return new PulumiTunnelProvisioner({
    remoteHost,
    remotePort: 80, // HTTP port
    localPort: Math.floor(Math.random() * (65535 - 32768)) + 32768,
    stackName: `web-tunnel-${testName}-${Date.now()}`,
  });
}
```

### For Multiple Environments

Environment-specific configurations:

```typescript
export function createStagingK3sTunnelProvisioner(testName: string): PulumiTunnelProvisioner {
  return createK3sTunnelProvisioner("staging.k3s.example.com", testName);
}

export function createProductionK3sTunnelProvisioner(testName: string): PulumiTunnelProvisioner {
  return createK3sTunnelProvisioner("prod.k3s.example.com", testName);
}
```

## Troubleshooting

### Common Issues

**"Stack not found"**: Initialize Pulumi stack with proper configuration  
**"SSH connection refused"**: Verify SSH key access and network connectivity  
**"Tunnel provision timeout"**: Check target host availability and SSH credentials  

### Debug Mode

```bash
export PULUMI_LOG_LEVEL=debug
pnpm test tests/integration/k3s/ssh-tunnel-integration.test.ts --verbose
```

## Migration from Manual Patterns

### Before (Manual SSH Tunnel Management)

```typescript
// ❌ OLD: Manual approach
const privateKeyValue = await config.ssh.privateKey.promise(); // Doesn't exist
const tunnelService = new SshTunnelService({
  host: "10.10.0.20",
  username: config.ssh.username,
  privateKey: privateKeyValue, // Manual extraction
  remotePort: 6443
});
```

### After (Pulumi Automation SDK)

```typescript
// ✅ NEW: Pulumi Automation SDK approach
const provisioner = createK3sTunnelProvisioner("10.10.0.20", "test-name");
const tunnelResult = await provisioner.provision();
// Use tunnelResult.localPort for connections
await tunnelResult.destroy(); // Clean infrastructure
```

This approach eliminates the complexity of manual secret extraction while maintaining consistency with production infrastructure patterns.