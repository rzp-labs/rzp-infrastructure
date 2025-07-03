# Testing Troubleshooting Guide

## SSH Tunnel Integration Tests

### Common Issues and Solutions

#### 1. "Cannot find Pulumi stack"

**Error Message:**
```
Error: no stack named 'dev' found
```

**Solution:**
```bash
# Initialize Pulumi stack
cd infrastructure
pulumi stack init dev

# Configure required settings
pulumi config set proxmox:endpoint "https://your-proxmox:8006"
pulumi config set proxmox:username "api-user@pam"
pulumi config set --secret proxmox:password "your-password"
pulumi config set proxmox:node "proxmox-node1"
pulumi config set proxmox:sshUsername "admin_ops"
pulumi config set --secret proxmox:sshPrivateKey "$(cat ~/.ssh/proxmox_key)"
```

#### 2. "SSH connection refused"

**Error Message:**
```
Error: dial tcp 10.10.0.20:22: connect: connection refused
```

**Troubleshooting Steps:**
```bash
# 1. Verify network connectivity
ping 10.10.0.20

# 2. Check SSH service
nmap -p 22 10.10.0.20

# 3. Test SSH manually
ssh admin_ops@10.10.0.20

# 4. Verify SSH key format
file ~/.ssh/proxmox_key  # Should show "PEM RSA private key" or similar

# 5. Check SSH key permissions
chmod 600 ~/.ssh/proxmox_key
```

#### 3. "Tunnel provision timeout"

**Error Message:**
```
Error: tunnel provisioning timed out after 60s
```

**Troubleshooting Steps:**
```bash
# 1. Check Proxmox node availability
ssh admin_ops@10.10.0.20 'systemctl status k3s'

# 2. Verify Pulumi SSH configuration
pulumi config get proxmox:sshUsername
pulumi config get --show-secrets proxmox:sshPrivateKey

# 3. Test tunnel creation manually
ssh -L 6443:localhost:6443 -N -f admin_ops@10.10.0.20
curl -k https://localhost:6443/version  # Should return K3s version
pkill -f 'ssh.*-L 6443:localhost:6443'  # Clean up

# 4. Enable debug logging
export PULUMI_LOG_LEVEL=debug
pnpm test tests/integration/k3s/ssh-tunnel-integration.test.ts --verbose
```

#### 4. "PULUMI_CONFIG_PASSPHRASE required"

**Error Message:**
```
Error: passphrase required for decrypting config value
```

**Solution:**
```bash
# Set the passphrase environment variable
export PULUMI_CONFIG_PASSPHRASE="your-passphrase"

# Or use Pulumi login for service-managed encryption
pulumi login
export PULUMI_ACCESS_TOKEN="your-access-token"
```

#### 5. "K3s API not accessible"

**Error Message:**
```
Error: connect ECONNREFUSED 127.0.0.1:6443
```

**Troubleshooting Steps:**
```bash
# 1. Verify K3s is running on target node
ssh admin_ops@10.10.0.20 'sudo systemctl status k3s'

# 2. Check K3s API binding
ssh admin_ops@10.10.0.20 'sudo netstat -tlnp | grep 6443'

# 3. Verify kubeconfig accessibility
ssh admin_ops@10.10.0.20 'sudo cat /etc/rancher/k3s/k3s.yaml | head -10'

# 4. Test direct API access on remote node
ssh admin_ops@10.10.0.20 'curl -k https://localhost:6443/version'
```

## Unit Test Issues

#### 1. "Cannot find module '@pulumi/automation'"

**Error Message:**
```
Error: Cannot find module '@pulumi/automation'
```

**Solution:**
```bash
# Install dependencies
cd infrastructure
pnpm install

# Verify Pulumi installation
pulumi version
```

#### 2. "Type errors in test files"

**Error Message:**
```
Property 'proxmox' does not exist on type 'IProxmoxConfig'
```

**Solution:**
- The SSH configuration is at the root level of `IProxmoxConfig`, not under a `proxmox` property
- Use `config.ssh.username` instead of `config.proxmox.ssh.username`
- Check `infrastructure/shared/types.ts` for the correct interface structure

## Environment Setup Issues

#### 1. "Node.js version incompatibility"

**Error Message:**
```
error typescript@5.8.3: The engine "node" is incompatible
```

**Solution:**
```bash
# Check Node.js version
node --version  # Should be 18.x or higher

# Install correct version using nvm
nvm install 18
nvm use 18

# Or update using your package manager
brew install node@18  # macOS
```

#### 2. "pnpm command not found"

**Solution:**
```bash
# Install pnpm globally
npm install -g pnpm

# Or using corepack (Node.js 16+)
corepack enable
corepack prepare pnpm@latest --activate
```

## CI/CD Integration Issues

#### 1. "Tests fail in CI but pass locally"

**Common Causes:**
- Missing environment variables in CI
- Different Node.js versions
- Network connectivity restrictions
- Missing Pulumi configuration

**Solution:**
```yaml
# GitHub Actions example
env:
  PULUMI_CONFIG_PASSPHRASE: ${{ secrets.PULUMI_CONFIG_PASSPHRASE }}
  PULUMI_ACCESS_TOKEN: ${{ secrets.PULUMI_ACCESS_TOKEN }}
  NODE_VERSION: '18'

steps:
  - uses: actions/setup-node@v3
    with:
      node-version: ${{ env.NODE_VERSION }}
      
  - run: corepack enable
  - run: pnpm install
  - run: pnpm run test:unit  # Skip integration tests in CI
```

#### 2. "Pulumi state access issues in CI"

**Solutions:**
- Use Pulumi service for state management in CI
- Configure service account tokens
- Store encrypted secrets in CI environment variables

## Performance Issues

#### 1. "Tests run slowly"

**Optimization Strategies:**
```bash
# Run only unit tests for development
pnpm run test:unit

# Use watch mode for active development
pnpm run test:watch

# Run specific test files
pnpm test tests/unit/k3s/k3s-master.test.ts

# Parallelize test execution
pnpm test --maxWorkers=4
```

#### 2. "Integration tests timeout"

**Solutions:**
- Increase Jest timeout for integration tests
- Check network latency to Proxmox infrastructure
- Verify SSH key exchange is working efficiently
- Consider using local K3s cluster for faster testing

```typescript
// Increase timeout for specific tests
test("should connect via tunnel", async () => {
  // Test implementation
}, 30000); // 30 second timeout
```

## Debug Mode

### Enable Verbose Logging

```bash
# Pulumi debug logging
export PULUMI_LOG_LEVEL=debug

# Jest verbose output
pnpm test --verbose

# Combine both for maximum debugging
export PULUMI_LOG_LEVEL=debug
pnpm test tests/integration/k3s/ssh-tunnel-integration.test.ts --verbose
```

### Inspect Infrastructure State

```bash
# Check Pulumi stack state
pulumi stack ls
pulumi config
pulumi stack output

# Check running tunnel processes
ps aux | grep ssh
lsof -i :6443  # Check if tunnel port is in use
```

## Getting Help

### Log Analysis

When reporting issues, include:

1. **Error message** (full stack trace)
2. **Environment information**:
   ```bash
   node --version
   pnpm --version
   pulumi version
   ```
3. **Configuration status**:
   ```bash
   pulumi config
   pulumi stack ls
   ```
4. **Network connectivity**:
   ```bash
   ping 10.10.0.20
   ssh admin_ops@10.10.0.20 'echo "SSH working"'
   ```

### Common Commands for Issue Diagnosis

```bash
# Full diagnostic script
cd infrastructure

echo "=== Environment ==="
node --version
pnpm --version
pulumi version

echo "=== Pulumi Configuration ==="
pulumi config
pulumi stack ls

echo "=== Network Connectivity ==="
ping -c 3 10.10.0.20
nmap -p 22,6443 10.10.0.20

echo "=== SSH Test ==="
ssh -o ConnectTimeout=5 admin_ops@10.10.0.20 'echo "SSH working"'

echo "=== Test Execution ==="
pnpm run test:unit
```

This diagnostic information helps identify the root cause of testing issues quickly.