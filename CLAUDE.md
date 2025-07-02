# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Mandatory Initialization Requirements

- You **MUST** complete the checklist below before responding to **ANY** user request:

```text
[SESSION START CHECKLIST]
□ 1. Read all files from @.agent/rules and @docs/
□ 2. Retreive context from ConPort (if database exists):
   □ get_product_context
   □ get_active_context
   □ get_decisions (limit 5)
   □ get_progress (limit 5)
   □ get_recent_activity_summary
```

## Agent Rules and Communication

### [ALWAYS]

- ALWAYS follow [SOLID guidelines](/Users/stephen/Projects/rzp-labs/rzp-infra/.agent/rules/SOLID-guidelines.md)
- ALWAYS follow Test-Driven Development
- ALWAYS use `repomix` when searching the codebase (is it far more efficient)
- ALWAYS consider the impact on other components before making changes
- ALWAYS check for existing utilities/helpers before creating new ones
- ALWAYS read all lines when viewing or editing files
- ALWAYS form your tool use using the XML format specified for each tool
- ALWAYS use <thinking> tags for every tool call or response
- ALWAYS remove temporary files when no longer needed
- ALWAYS include Actions/Expected/Actual in EVERY `ConPort` log entry

### [NEVER]

- NEVER sacrifice accuracy
- NEVER use #noqa to bypass linting requirements
- NEVER begin editing a file when the user only asks a question
- NEVER ask the user to perform an action that you are capable of
- NEVER ask the user for information before searching
- NEVER deviate from existing project standards and patterns
- NEVER make architectural decisions without explicit approval
- NEVER use #noqa to bypass linting or type checking
- NEVER respond without a confidence score

## Test-Driven Development

**The TDD Cycle:**

1. **RED**: Write a failing test for one method's contract/intent
2. **GREEN**: Write minimal code to make the test pass
3. **REFACTOR**: Improve code while keeping tests green
4. **Repeat**: One method at a time, never skip phases

### RED Phase Excellence

- **Test interface compliance first** - Validate protocol implementation before behavior
- **Test what exists, not what's imagined** - Avoid testing non-existent HTTP functionality
- **Use meaningful stub implementations** - Return realistic data that satisfies test assertions
- **Start with basic contracts** - Type validation, non-empty responses, interface requirements
- **One failing test at a time** - Focus on single method's contract/intent

### GREEN Phase Progression

- **Implement minimal code to pass tests** - No more functionality than required
- **One method at a time** - Complete RED→GREEN→REFACTOR cycle before next method
- **Maintain test passing state** - Never break existing tests while implementing new features
- **Use proper HTTP mocking** - Mock external dependencies (httpx, aiohttp) for isolation
- **Test actual implementation behavior** - Validate real HTTP calls, endpoints, headers

### Integration Testing Evolution

- **Start with unit tests** - Individual method validation first
- **Progress to integration tests** - Method interaction workflows (create_session → use_session)
- **Test realistic user journeys** - Complete workflows users will actually perform
- **Validate method interaction** - Ensure methods work together correctly

### Test Quality Standards

- **Clear test naming** - `test_method_name_does_specific_thing`
- **Comprehensive documentation** - Explain what behavior is being validated
- **Arrange/Act/Assert structure** - Clear test organization
- **Single assertion focus** - Each test validates one specific behavior
- **Proper async handling** - Use pytest.mark.asyncio for async methods

### Architecture Validation

- **Test intended architecture** - HTTPLLMProvider → Wrapper Service, not direct API calls
- **Validate endpoint contracts** - Test correct URLs, headers, request/response formats
- **Mock at the right level** - Mock HTTP client, not business logic
- **Maintain architectural boundaries** - Don't test implementation details across layers

### Common Anti-Patterns to Avoid

- **Testing mocks instead of behavior** - Mocking unimplemented functionality
- **Jumping to GREEN phase** - Writing tests for complex HTTP behavior before basic contracts
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

- Listen to what tools are telling us about our design
- Fix root causes rather than symptoms
- Work with the language and tools, not against them
- Let SOLID principles emerge naturally from good design choices

### ConPort Integration

**Workspace ID:** `/Users/stephen/Projects/rzp-infra`

**ConPort Logging Requirements** - Every ConPort log entry MUST include:

1. **Actions Performed**: Detailed description of what was done
2. **Expected Result**: What outcome was anticipated
3. **Actual Result**: What actually happened

**Tool Usage Protocol:**

- Explain intent before calling file operations
- Place ALL MCP tool calls at the very END of response messages
- Wait for results before proceeding with dependent actions

## Project Overview

rzp Infrastructure is a GitOps-managed homelab infrastructure repository that powers 100+ services using Infrastructure
as Code (IaC) principles with Pulumi and Python.

### Purpose

Manage complete homelab infrastructure through code with automated deployment, scaling, full observability, and disaster
recovery capabilities.

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
7. **Test-Driven Development**: RED→GREEN→REFACTOR cycle mandatory

### Service Organization

Services are categorized by purpose across 100+ applications:

- `media/` - Media services (streaming, acquisition, management)
- `home-automation/` - Home automation and IoT
- `dev-tools/` - Development and CI/CD tools
- `ai/` - AI/ML services and inference
- `platform/` - Shared platform services (databases, observability)

### Current Status

Initial setup phase - documentation complete, ConPort initialized, infrastructure code to be implemented

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

# Run with coverage
pnpm run test:coverage
```

## Configuration

- `infrastructure/package.json`: Main project configuration with TypeScript dependencies
- `infrastructure/tsconfig.json`: TypeScript compiler configuration with strict type checking
- `infrastructure/eslint.config.cjs`: ESLint configuration for code quality
- Node.js 18+ required
- Package manager: pnpm
- Line length: 120 characters (Prettier and ESLint)
- Strict TypeScript configuration enabled
