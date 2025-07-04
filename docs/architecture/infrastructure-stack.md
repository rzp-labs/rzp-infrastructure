# Infrastructure Stack Architecture

## Technology Choices

### Infrastructure as Code: Pulumi + TypeScript

**Decision**: Use Pulumi with TypeScript for infrastructure management.

**Rationale**:

- **Type Safety**: Compile-time error checking prevents configuration mistakes
- **IDE Support**: Full autocomplete and refactoring for infrastructure code
- **Ecosystem**: Rich TypeScript ecosystem and tooling
- **Consistency**: Same language skills across infrastructure and application development
- **Pulumi Benefits**: Real programming language vs templating, state management, preview/apply workflow

### Directory Structure

```bash
/Users/stephen/Projects/rzp-infra/
├── infrastructure/                         # Infrastructure as Code (TypeScript)
│   ├── index.ts                           # Main entry point
│   ├── package.json                       # Node.js project metadata
│   ├── tsconfig.json                      # TypeScript configuration
│   ├── eslint.config.cjs                  # Code quality enforcement
│   ├── shared/                            # Foundation layer
│   │   ├── types.ts                       # Type definitions
│   │   ├── utils.ts                       # Helper functions
│   │   └── constants.ts                   # Shared constants
│   ├── config/                            # Configuration management
│   │   ├── base.ts                        # Base configuration functions
│   │   └── staging.ts                     # Environment-specific config
│   ├── components/                        # Reusable infrastructure components
│   │   ├── K3sCluster.ts                  # Complete K3s cluster orchestration
│   │   └── ProxmoxNode.ts                 # Individual VM management
│   ├── resources/                         # Resource-specific modules
│   │   └── storage/                       # Storage and image management
│   │       ├── images.ts                  # Debian cloud images
│   │       └── cloud-init.ts              # VM initialization
│   ├── environments/                      # Environment deployments
│   │   └── staging/                       # Staging environment
│   │       └── index.ts                   # Staging deployment entry
│   └── tests/                             # Infrastructure tests
├── kubernetes/                            # GitOps-managed K8s manifests
│   ├── core/                              # Essential cluster services
│   ├── platform/                          # Shared platform services
│   └── apps/                              # Application configurations
└── docs/                                  # Documentation
```

## Infrastructure Flow

```
1. Pulumi (TypeScript) → Provisions Proxmox VMs + K3s cluster
2. ArgoCD watches kubernetes/ directory
3. GitOps deploys applications to K3s cluster
4. Applications run as containers
```

## Component Architecture

### Hybrid Organization Pattern

We use a **hybrid pattern** combining:

- **Resource organization**: Storage, compute, networking
- **Environment separation**: Staging, production configs
- **Shared foundation**: Types, utils, constants

### Type-Safe Configuration

```typescript
// Strong typing prevents configuration errors
interface IK3sClusterConfig {
  readonly masterCount: number;
  readonly workerCount: number;
  readonly vmidBase: number;
}

// Environment-specific implementations
function getStagingConfig(): IEnvironmentConfig {
  return {
    name: "staging",
    k3s: {
      masterCount: 1, // Single master for staging
      workerCount: 2, // Two workers for testing
      vmidBase: 120, // VM ID range 120-139
    },
  };
}
```

### Component Reusability

```typescript
// Reusable K3s cluster component
export class K3sCluster extends ComponentResource {
  public readonly masters: readonly ProxmoxNode[];
  public readonly workers: readonly ProxmoxNode[];

  constructor(name: string, args: IK3sClusterArgs) {
    // Creates complete K3s cluster with proper networking,
    // cloud-init, and resource allocation
  }
}
```

## Deployment Commands

```bash
# Navigate to infrastructure
cd infrastructure/

# Configure secrets
pulumi config set --secret sshPublicKey "ssh-ed25519 ..."
pulumi config set --secret proxmoxUsername "root@pam"
pulumi config set --secret proxmoxPassword "password"

# Deploy infrastructure
pulumi up

# Verify deployment
pulumi stack output
```

## Benefits

1. **Type Safety**: Catch errors at compile-time
2. **Modularity**: Reusable components across environments
3. **Testability**: Unit test infrastructure components
4. **Maintainability**: Clear separation of concerns
5. **Scalability**: Easy to add new environments or VM types
6. **GitOps Ready**: Infrastructure creates the foundation for ArgoCD

---

Last Updated: 2025-01-01
