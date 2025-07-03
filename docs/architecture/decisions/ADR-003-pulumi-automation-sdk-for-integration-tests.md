# ADR-003: Use Pulumi Automation SDK for Integration Test SSH Connectivity

## Status

Accepted

## Context

Integration tests for K3s infrastructure require SSH tunnel connectivity to access cluster APIs that are bound to localhost for security. The initial implementation attempted to manually extract SSH credentials from Pulumi secrets and create SSH tunnels using the ssh2 library directly in Jest test environments.

This approach encountered several architectural and operational issues:

**Secret Extraction Complexity**:
- Manual extraction from Pulumi `Output<string>` types required complex async handling
- Required `PULUMI_CONFIG_PASSPHRASE` environment variable in test environments
- Attempted workarounds with `.promise()` method that doesn't exist on Pulumi outputs

**Architectural Inconsistency**:
- Created duplicate SSH connection logic outside of Pulumi's established patterns
- Violated single source of truth principle for SSH credentials
- Diverged from existing K3sMaster/K3sWorker SSH connection patterns used throughout codebase

**Industry Research**:
Research revealed this is a common requirement for Infrastructure as Code (IaC) tools. Pulumi provides established patterns through:
- [pulumi-automation-sdk-ssh-tunnel](https://github.com/clstokes/pulumi-automation-sdk-ssh-tunnel) project demonstrating bastion host connectivity
- Official Pulumi integration testing documentation recommending Automation SDK for infrastructure testing
- `@pulumi/command` remote.Command patterns used throughout the existing codebase

## Decision

**Use Pulumi Automation SDK to handle SSH tunnel provisioning for integration tests instead of manual secret extraction and direct ssh2 library usage.**

Integration tests will use Pulumi's LocalWorkspace to provision SSH tunnels as infrastructure, then run Jest tests against the provisioned connectivity.

## Implementation Pattern

```typescript
// BEFORE: Manual approach with secret extraction
const config = getProxmoxConfig();
const privateKeyValue = await config.ssh.privateKey.promise(); // ❌ Doesn't exist
const tunnelService = new SshTunnelService({
  host: "10.10.0.20",
  username: config.ssh.username,
  privateKey: privateKeyValue, // ❌ Manual extraction
  remotePort: 6443
});

// AFTER: Pulumi Automation SDK approach
const stack = await LocalWorkspace.createStack({
  stackName: "integration-test-tunnel",
  program: async () => {
    // Use existing Pulumi SSH patterns
    const tunnel = new command.remote.Command("ssh-tunnel", {
      connection: {
        host: "10.10.0.20",
        user: config.proxmox.ssh!.username!,
        privateKey: config.proxmox.ssh!.privateKey!, // ✅ Native Pulumi handling
      },
      create: "ssh -L 6443:localhost:6443 -N -f ${host}",
      delete: "pkill -f 'ssh -L 6443:localhost:6443'"
    });
  }
});

await stack.up(); // ✅ Provisions tunnel using Pulumi's native capabilities
// Run Jest tests against localhost:6443
await stack.destroy(); // ✅ Clean up infrastructure
```

## Rationale

**Leverages Native Pulumi Capabilities**:
- Reuses proven SSH connection patterns from K3sMaster/K3sWorker components
- Eliminates manual secret handling through Pulumi's built-in secret resolution
- Maintains consistency with existing `@pulumi/command` remote.Command usage

**Industry Standard Pattern**:
- Aligns with established IaC integration testing practices
- Follows Pulumi's official recommendations for infrastructure testing
- Leverages existing open-source examples and community patterns

**Architectural Consistency**:
- Maintains single source of truth for SSH credentials in Pulumi configuration
- Uses same connection objects and patterns as production infrastructure
- Ensures integration tests validate the actual infrastructure connectivity patterns

**Operational Benefits**:
- Proper infrastructure lifecycle management (provision → test → destroy)
- Clear dependency on Pulumi configuration (fails fast if environment not properly set up)
- Eliminates complex secret extraction and manual tunnel management

## Consequences

**Positive**:
- ✅ Eliminates SSH secret extraction complexity
- ✅ Maintains architectural consistency with existing patterns
- ✅ Provides proper infrastructure lifecycle management
- ✅ Enforces correct Pulumi environment setup for tests
- ✅ Follows industry best practices for IaC testing

**Considerations**:
- Integration tests require Pulumi Automation SDK dependency
- Tests become "infrastructure tests" that provision real resources
- Slight increase in test execution time due to infrastructure provisioning
- Tests explicitly require proper Pulumi configuration (which is desired behavior)

## References

- [Pulumi Automation SDK SSH Tunnel Example](https://github.com/clstokes/pulumi-automation-sdk-ssh-tunnel)
- [Pulumi Integration Testing Documentation](https://www.pulumi.com/docs/iac/concepts/testing/integration/)
- [Pulumi Command Remote Documentation](https://www.pulumi.com/registry/packages/command/api-docs/remote/command/)
- Existing codebase patterns: `infrastructure/components/k3s/k3s-master.ts`, `k3s-worker.ts`, `k3s-credentials.ts`

## Decision Date

2025-01-03