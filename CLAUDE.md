# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Important Information

- The year is 2025, not 2024. This is relevant when searching the web.

## Mandatory Initialization Requirements

- You **MUST** complete the checklist below before responding to **ANY** user request:

[SESSION START CHECKLIST]
□ 1. Activate the project in `serena`
□ 2. Read all files from `@.agent/rules/`
□ 3. Read all the files from `@docs/`
□ 4. Retreive context from `openmemory` for the last 30 minutes
□ 5. Read the last 5 created memories in `.serena/memories/`

**DO NOT ADD A MEMORY FOR COMPLETING THE SESSION START CHECKLIST**

## Agent Rules and Communication

### [ALWAYS]

- ALWAYS follow [SOLID guidelines](/Users/stephen/Projects/rzp-labs/rzp-infra/.agent/rules/SOLID-guidelines.md)
- ALWAYS use `repomix` when searching the codebase (is it far more efficient)
- ALWAYS consider the impact on other components before making changes
- ALWAYS check for existing utilities/helpers before creating new ones
- ALWAYS read all lines when viewing or editing files
- ALWAYS form your tool use using the XML format specified for each tool
- ALWAYS use <thinking> tags for every tool call or response
- ALWAYS remove temporary files when no longer needed
- ALWAYS include Actions/Expected/Actual in EVERY `openmemory` log entry

### [NEVER]

**- NEVER include changes outside of the scope of your task unless you request permission from the user first**

- NEVER sacrifice accuracy
- NEVER bypass linting or type checking requirements
- NEVER use _any_ - types should **always** be defined
- NEVER begin editing a file when the user only asks a question
- NEVER ask the user to perform an action that you are capable of
- NEVER ask the user for information before searching
- NEVER deviate from existing project standards and patterns
- NEVER make architectural decisions without explicit approval

## Testing Architecture (ADR-003)

The testing infrastructure uses **Pulumi Automation SDK** for SSH tunnel provisioning, following ADR-003 for infrastructure-as-code testing patterns.

### Testing Evolution

- **Start with unit tests** - Individual component validation first
- **Progress to integration tests** - Component interaction workflows using Pulumi tunnel provisioning
- **Test realistic infrastructure patterns** - Complete workflows that mirror production deployment
- **Validate component interaction** - Ensure components work together using actual SSH connections

### Pulumi Automation SDK Integration

- **Tunnel Provisioning**: Use `PulumiTunnelProvisioner` for SSH connectivity in integration tests
- **Infrastructure Lifecycle**: Provision → Test → Destroy pattern for proper resource management
- **Consistent SSH Patterns**: Reuse same connection logic as K3sMaster/K3sWorker components
- **No Manual Secret Extraction**: Native Pulumi secret resolution eliminates complex credential handling

### Test Quality Standards

- **Clear test naming** - `test_component_does_specific_behavior`
- **Comprehensive documentation** - Explain what infrastructure behavior is being validated
- **Arrange/Act/Assert structure** - Clear test organization with infrastructure setup
- **Single assertion focus** - Each test validates one specific behavior
- **Proper async handling** - Use proper async/await for Pulumi operations

### Architecture Validation

- **Test intended architecture** - K3sMaster/K3sWorker → SSH → K3s API, not direct connections
- **Validate infrastructure contracts** - Test correct SSH connections, tunnel creation, API access
- **Mock at the right level** - Mock infrastructure components, not Pulumi core functionality
- **Maintain architectural boundaries** - Don't test implementation details across component layers

### Common Anti-Patterns to Avoid

- **Testing mocks instead of behavior** - Mocking unimplemented functionality
- **Testing implementation details** - Focus on interface contracts, not internal structure
- **Ignoring test failures** - All tests should pass; failing tests indicate missing implementation
- **Architectural confusion** - Testing wrong endpoints/APIs for the intended architecture

### Test Coverage Evolution

- **Foundation first** - Interface compliance and basic behavior
- **Core functionality** - Primary methods (generate, complete_chat)
- **Advanced features** - Session management, streaming, forking
- **Edge cases** - URL normalization, error handling, empty inputs
- **Integration scenarios** - Multi-method workflows and realistic usage

## Important Constraints

- Maintain interface contracts for all abstractions
- Use dependency injection for all components
- Implement new phases as plugins, not modifications
- Security scanning with Trivy after dependency changes

### File Naming Standards

**Standardized kebab-case naming** for all TypeScript files:

- ✅ `k3s-cluster.ts`, `proxmox-node.ts`, `vm-config.ts`
- ✅ `provider-config.ts`, `network-config.ts`
- ❌ ~~`K3sCluster.ts`, `ProxmoxNode.ts`~~ (old inconsistent pattern)

This ensures consistent imports and improved readability across the codebase.

### Listen to the Guardrails

**Key Principle**: SOLID principles and type checking are guides us toward better design, not hindrances to bypass.

**What This Means:**

- When linting rules warn "method could be static" → Consider if the method truly needs instance state
- When type checker complains about `None` values → Fix the types at the source, don't mask with workarounds
- When exceptions feel awkward → Use Python's natural exception handling, don't create artificial `NoReturn` helpers
- When code feels complex → Simplify the design rather than adding annotations to work around complexity

**Anti-patterns to Avoid:**

- Adding artificial instance variables just to avoid "could be static" warnings
- Using `NoReturn` annotations to bypass proper exception handling
- Creating helper methods that only exist to satisfy linting rules
- Fighting the type system instead of listening to what it's telling us

**Successful Pattern:**

- Let SOLID principles emerge naturally from good design choices
- Listen to what tools are telling us about our design
- Fix root causes rather than symptoms
- Work with the language and tools, not against them

### Directory Structure Guidelines

**Clear separation of concerns** across the infrastructure codebase:

#### **`/shared`** - Centralized Definitions

- **`shared/types.ts`** - All shared TypeScript interfaces and types
- **`shared/constants.ts`** - All shared constants (versions, URLs, defaults)
- **`shared/utils.ts`** - Simple, pure utilities with **wide applicability across domains**
  - String manipulation (`capitalize`)
  - Boolean validation (`isTruthy`)
  - Type guards and simple calculations
  - **Characteristics:** Small, no dependencies, general-purpose

#### **`/helpers`** - Domain-Specific Builders

- **`helpers/domain/`** - Complex, **domain-specific** builders/factories/orchestrators
  - `helpers/vm/vm-configuration-builder.ts` - Multi-step VM composition
  - `helpers/k3s/k8s-test-client-factory.ts` - Test infrastructure factories
  - **Characteristics:** Complex logic, multiple imports, domain-specific orchestration

#### **`/config`** - Configuration Retrieval

- Simple functions that read from external sources (Pulumi config, environment variables)
- **Pattern:** `getXxxConfig()` functions using `pulumi.Config()`

#### **`/resources`** - Resource Creation

- Actual Pulumi/cloud resource creators organized by provider
- `resources/kubernetes/` - K8s resource creators
- `resources/storage/` - Storage resource creators

#### **`/components`** - Business Logic Orchestration

- High-level components that orchestrate resources, configs, and helpers
- **Pattern:** Pulumi `ComponentResource` classes that compose multiple resources

**Key Principle:** Simple, reusable utilities belong in `/shared/utils.ts`. Complex, domain-specific logic belongs in `/helpers/domain/`. This maintains clean architecture while ensuring shared definitions remain truly general-purpose.

### OpenMemory Integration

**Workspace ID:** `/Users/stephen/Projects/rzp-infra`

**OpenMemory Logging Requirements** - Every `openmemory` log entry MUST include:

1. **Actions Performed**: Detailed description of what was done
2. **Expected Result**: What outcome was anticipated
3. **Actual Result**: What actually happened

**Tool Usage Protocol:**

- Explain intent before calling file operations
- Place ALL MCP tool calls at the very END of response messages
- Wait for results before proceeding with dependent actions

## Project Overview

rzp Infrastructure is a GitOps-managed homelab infrastructure repository that powers 100+ services using Infrastructure as Code (IaC) principles with Pulumi and TypeScript.

### Purpose

Manage complete homelab infrastructure through code with automated deployment, scaling, full observability, and disaster recovery capabilities.

### Technology Stack

- **Infrastructure as Code**: Pulumi (TypeScript) with strict type safety
- **Container Orchestration**: K3s (lightweight Kubernetes)
- **GitOps**: ArgoCD watches `/kubernetes` directory for changes
- **Observability**: Vector → OpenObserve with Netdata
- **Secrets Management**: Infisical + External Secrets Operator
- **CI/CD**: Harness pipelines
- **Package Manager**: pnpm
- **Node.js Version**: 18+
- **Runtime**: TypeScript with Node.js

### Architecture Principles

1. **GitOps Workflow**: TypeScript (Pulumi) → YAML → Git → ArgoCD → K3s
2. **Purpose-Driven Taxonomy**: Services organized by function, not technology
3. **5-Level Directory Limit**: Prevents complexity and performance issues
4. **Clear Separation**: Configuration in Git, runtime data backed up separately
5. **Standards by Default**: Every service gets monitoring, backups, and network policies
6. **Strict SOLID Principles**: Enforced through linting and code review

### Service Organization

Services are categorized by purpose across 100+ applications:

- `media/` - Media services (streaming, acquisition, management)
- `home-automation/` - Home automation and IoT
- `dev-tools/` - Development and CI/CD tools
- `ai/` - AI/ML services and inference
- `platform/` - Shared platform services (databases, observability)

## Development Commands

### Environment Setup

```bash
# Navigate to infrastructure directory
cd infrastructure/

# Install dependencies
pnpm install

# Install pre-commit hooks (from project root)
cd ../ && pre-commit install
```

### Code Quality

```bash
# Navigate to infrastructure directory
cd infrastructure/

# Format code
pnpm run format

# Lint code
pnpm run lint

# Lint with auto-fix (import sorting, formatting)
npx eslint . --fix

# Type checking
pnpm run type-check

# Run all quality checks
pnpm run lint && pnpm run format && pnpm run type-check

# Run full quality check with auto-fixes
npx eslint . --fix && pnpm run format && pnpm run type-check
```

### Infrastructure Operations

```bash
# Navigate to infrastructure directory
cd infrastructure/

# Preview infrastructure changes
pulumi preview

# Deploy infrastructure changes
pulumi up

# Destroy infrastructure
pulumi destroy

# View stack configuration
pulumi config
```

### Testing

```bash
# Navigate to infrastructure directory
cd infrastructure/

# Run all tests
pnpm test

# Run specific test categories
pnpm run test:unit          # Unit tests only
pnpm run test:integration   # Integration tests only

# Run component-specific tests
pnpm run test:k3s           # All K3s tests (unit + integration)
pnpm run test:k3s:unit      # K3s unit tests only
pnpm run test:k3s:integration # K3s integration tests only
pnpm run test:proxmox       # All Proxmox tests
pnpm run test:cluster       # Cluster-level integration tests

# Run with coverage
pnpm run test:coverage

# Development testing
pnpm run test:watch         # Watch mode for development
pnpm run test:ci            # CI-optimized test run
```

### SSH Tunnel Integration Tests

Integration tests use Pulumi Automation SDK for SSH tunnel provisioning:

```bash
# Prerequisites: Pulumi stack with SSH configuration
pulumi config set proxmox:sshUsername "admin_ops"
pulumi config set --secret proxmox:sshPrivateKey "$(cat ~/.ssh/proxmox_key)"
export PULUMI_CONFIG_PASSPHRASE="your-passphrase"

# Run SSH tunnel integration tests
pnpm test tests/integration/k3s/ssh-tunnel-integration.test.ts

# Debug tunnel provisioning
export PULUMI_LOG_LEVEL=debug
pnpm test tests/integration/k3s/ssh-tunnel-integration.test.ts --verbose
```

## Configuration

- `infrastructure/package.json`: Main project configuration with TypeScript dependencies
- `infrastructure/tsconfig.json`: TypeScript compiler configuration with strict type checking
- `infrastructure/eslint.config.cjs`: ESLint configuration for code quality
- Node.js 18+ required
- Package manager: pnpm
- Line length: 120 characters (Prettier and ESLint)
- Strict TypeScript configuration enabled
