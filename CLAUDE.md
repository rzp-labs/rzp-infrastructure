# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Important Information

- The year is 2025, not 2024. This is relevant when searching the web.

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
- ALWAYS include Actions/Expected/Actual in EVERY `openmemory` log entry

### [NEVER]

**- NEVER include changes outside of the scope of your task unless you request permission from the user first**

- NEVER sacrifice accuracy
- NEVER bypass linting or type checking requirements
- NEVER begin editing a file when the user only asks a question
- NEVER ask the user to perform an action that you are capable of
- NEVER ask the user for information before searching
- NEVER deviate from existing project standards and patterns
- NEVER make architectural decisions without explicit approval

## Spec Workflow

This project uses the automated Spec workflow for feature development, based on spec-driven methodology. The workflow follows a structured approach: Requirements → Design → Tasks → Implementation.

### Workflow Philosophy

You are an AI assistant that specializes in spec-driven development. Your role is to guide users through a systematic approach to feature development that ensures quality, maintainability, and completeness.

### Core Principles

- **Structured Development**: Follow the sequential phases without skipping steps
- **User Approval Required**: Each phase must be explicitly approved before proceeding
- **Atomic Implementation**: Execute one task at a time during implementation
- **Requirement Traceability**: All tasks must reference specific requirements
- **Test-Driven Focus**: Prioritize testing and validation throughout

### Available Commands

| Command                       | Purpose                                | Usage                                   |
| ----------------------------- | -------------------------------------- | --------------------------------------- |
| `/spec-create <feature-name>` | Create a new feature spec              | `/spec-create user-auth "Login system"` |
| `/spec-requirements`          | Generate requirements document         | `/spec-requirements`                    |
| `/spec-design`                | Generate design document               | `/spec-design`                          |
| `/spec-tasks`                 | Generate implementation tasks          | `/spec-tasks`                           |
| `/spec-execute <task-id>`     | Execute specific task                  | `/spec-execute 1`                       |
| `/{spec-name}-task-{id}`      | Execute specific task (auto-generated) | `/user-auth-task-1`                     |
| `/spec-status`                | Show current spec status               | `/spec-status user-auth`                |
| `/spec-list`                  | List all specs                         | `/spec-list`                            |

### Workflow Sequence

**CRITICAL**: Follow this exact sequence - do NOT skip steps or run scripts early:

1. **Requirements Phase** (`/spec-create`)

   - Create requirements.md
   - Get user approval
   - **DO NOT** run any scripts
   - Proceed to design phase

2. **Design Phase** (`/spec-design`)

   - Create design.md
   - Get user approval
   - **DO NOT** run any scripts
   - Proceed to tasks phase

3. **Tasks Phase** (`/spec-tasks`)

   - Create tasks.md
   - Get user approval
   - **ONLY THEN** run: `node .claude/scripts/generate-commands.js {spec-name}`

4. **Implementation Phase** (`/spec-execute` or generated commands)
   - Use generated task commands or traditional /spec-execute

### Detailed Workflow Process

#### Phase 1: Requirements Gathering (`/spec-requirements`)

**Your Role**: Generate comprehensive requirements based on user input

**Process**:

1. Parse the feature description provided by the user
2. Create user stories in format: "As a [role], I want [feature], so that [benefit]"
3. Generate acceptance criteria using EARS format:
   - WHEN [event] THEN [system] SHALL [response]
   - IF [condition] THEN [system] SHALL [response]
4. Consider edge cases, error scenarios, and non-functional requirements
5. Present complete requirements document
6. Ask: "Do the requirements look good? If so, we can move on to the design."
7. **CRITICAL**: Wait for explicit approval before proceeding
8. **NEXT PHASE**: Proceed to `/spec-design` (DO NOT run scripts yet)

**Requirements Format**:

```markdown
### Requirements

#### Requirement 1

**User Story:** As a [role], I want [feature], so that [benefit]

##### Acceptance Criteria

1. WHEN [event] THEN [system] SHALL [response]
2. IF [condition] THEN [system] SHALL [response]
```

#### Phase 2: Design Creation (`/spec-design`)

**Your Role**: Create technical architecture and design

**Process**:

1. Research existing codebase patterns and architecture
2. Create comprehensive design document including:
   - System overview and architecture
   - Component specifications and interfaces
   - Data models and validation rules
   - Error handling strategies
   - Testing approach
3. Include Mermaid diagrams for visual representation
4. Present complete design document
5. Ask: "Does the design look good? If so, we can move on to the implementation plan."
6. **CRITICAL**: Wait for explicit approval before proceeding

**Design Sections Required**:

- Overview
- Architecture (with Mermaid diagrams)
- Components and Interfaces
- Data Models
- Error Handling
- Testing Strategy

#### Phase 3: Task Planning (`/spec-tasks`)

**Your Role**: Break design into executable implementation tasks

**Process**:

1. Convert design into atomic, executable coding tasks
2. Ensure each task:
   - Has a clear, actionable objective
   - References specific requirements using _Requirements: X.Y_ format
   - Builds incrementally on previous tasks
   - Focuses on coding activities only
3. Use checkbox format with hierarchical numbering
4. Present complete task list
5. Ask: "Do the tasks look good?"
6. **CRITICAL**: Wait for explicit approval before proceeding
7. **AFTER APPROVAL**: Execute `node .claude/scripts/generate-commands.js {feature-name}`
8. **IMPORTANT**: Do NOT edit the script - run it exactly as provided

**Task Format**:

```markdown
- [ ] 1. Task description
  - Specific implementation details
  - Files to create/modify
  - _Requirements: 1.1, 2.3_
```

**Excluded Task Types**:

- User acceptance testing
- Production deployment
- Performance metrics gathering
- User training or documentation
- Business process changes

#### Phase 4: Implementation (`/spec-execute` or auto-generated commands)

**Your Role**: Execute tasks systematically with validation

**Two Ways to Execute Tasks**:

1. **Traditional**: `/spec-execute 1 feature-name`
2. **Auto-generated**: `/feature-name-task-1` (created automatically)

**Process**:

1. Load requirements.md, design.md, and tasks.md for context
2. Execute ONLY the specified task (never multiple tasks)
3. Implement following existing code patterns and conventions
4. Validate implementation against referenced requirements
5. Run tests and checks if applicable
6. **CRITICAL**: Mark task as complete by changing [ ] to [x] in tasks.md
7. Confirm task completion status to user
8. **CRITICAL**: Stop and wait for user review before proceeding

**Implementation Rules**:

- Execute ONE task at a time
- **CRITICAL**: Mark completed tasks as [x] in tasks.md
- Always stop after completing a task
- Wait for user approval before continuing
- Never skip tasks or jump ahead
- Validate against requirements
- Follow existing code patterns
- Confirm task completion status to user

### CRITICAL: Script Usage Rules

**DO NOT EDIT THE SCRIPT**: The script at `.claude/scripts/generate-commands.js` is complete and functional.

- **DO NOT** modify the script content
- **DO NOT** try to "improve" or "customize" the script
- **JUST RUN IT**: `node .claude/scripts/generate-commands.js {spec-name}`
- **TIMING**: Only run after tasks.md is approved

### Critical Workflow Rules

#### Approval Workflow

- **NEVER** proceed to the next phase without explicit user approval
- Accept only clear affirmative responses: "yes", "approved", "looks good", etc.
- If user provides feedback, make revisions and ask for approval again
- Continue revision cycle until explicit approval is received

#### Task Execution

- **ONLY** execute one task at a time during implementation
- **CRITICAL**: Mark completed tasks as [x] in tasks.md before stopping
- **ALWAYS** stop after completing a task
- **NEVER** automatically proceed to the next task
- **MUST** wait for user to request next task execution
- **CONFIRM** task completion status to user

#### Task Completion Protocol

When completing any task during `/spec-execute`:

1. **Update tasks.md**: Change task status from `- [ ]` to `- [x]`
2. **Confirm to user**: State clearly "Task X has been marked as complete"
3. **Stop execution**: Do not proceed to next task automatically
4. **Wait for instruction**: Let user decide next steps

#### Requirement References

- **ALL** tasks must reference specific requirements using _Requirements: X.Y_ format
- **ENSURE** traceability from requirements through design to implementation
- **VALIDATE** implementations against referenced requirements

#### Phase Sequence

- **MUST** follow Requirements → Design → Tasks → Implementation order
- **CANNOT** skip phases or combine phases
- **MUST** complete each phase before proceeding

### File Structure Management

The workflow automatically creates and manages:

```
.claude/
├── specs/
│   └── {feature-name}/
│       ├── requirements.md    # User stories and acceptance criteria
│       ├── design.md         # Technical architecture and design
│       └── tasks.md          # Implementation task breakdown
├── commands/
│   ├── spec-*.md            # Main workflow commands
│   └── {feature-name}/      # Auto-generated task commands (NEW!)
│       ├── task-1.md
│       ├── task-2.md
│       └── task-2.1.md
├── scripts/                 # Command generation scripts (NEW!)
│   └── generate-commands.js
├── templates/
│   └── *-template.md        # Document templates
└── spec-config.json         # Workflow configuration
```

### Auto-Generated Task Commands

The workflow automatically creates individual commands for each task:

**Benefits**:

- **Easier execution**: Type `/user-auth-task-1` instead of `/spec-execute 1 user-authentication`
- **Better organization**: Commands grouped by spec in separate folders
- **Auto-completion**: Claude Code can suggest spec-specific commands
- **Clear purpose**: Each command shows exactly what task it executes

**Generation Process**:

1. **Requirements Phase**: Create requirements.md (NO scripts)
2. **Design Phase**: Create design.md (NO scripts)
3. **Tasks Phase**: Create tasks.md (NO scripts)
4. **ONLY AFTER tasks approval**: Execute `node .claude/scripts/generate-commands.js {spec-name}`

**When to Run the Script**:

- **ONLY** after tasks are approved in `/spec-tasks`
- **NOT** during requirements or design phases
- **Command**: `node .claude/scripts/generate-commands.js {spec-name}`
- **IMPORTANT**: Do NOT edit the script - run it as-is

### Error Handling

If issues arise during the workflow:

- **Requirements unclear**: Ask targeted questions to clarify
- **Design too complex**: Suggest breaking into smaller components
- **Tasks too broad**: Break into smaller, more atomic tasks
- **Implementation blocked**: Document the blocker and suggest alternatives

### Success Criteria

A successful spec workflow completion includes:

- ✅ Complete requirements with user stories and acceptance criteria
- ✅ Comprehensive design with architecture and components
- ✅ Detailed task breakdown with requirement references
- ✅ Working implementation validated against requirements
- ✅ All phases explicitly approved by user
- ✅ All tasks completed and integrated

### Getting Started

1. **Initialize**: `/spec-create <feature-name> "Description of feature"`
2. **Requirements**: Follow the automated requirements generation process
3. **Design**: Review and approve the technical design
4. **Tasks**: Review and approve the implementation plan
5. **Implementation**: Execute tasks one by one with `/spec-execute <task-id>`
6. **Validation**: Ensure each task meets requirements before proceeding

Remember: The workflow ensures systematic feature development with proper documentation, validation, and quality control at each step.

## Testing Architecture (ADR-003)

### Testing Evolution

- **Start with unit tests** - Individual component validation first
- **Progress to integration tests** - Component interaction workflows using Pulumi tunnel provisioning
- **Test realistic infrastructure patterns** - Complete workflows that mirror production deployment
- **Validate component interaction** - Ensure components work together using actual SSH connections

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

### Service Organization

Services are categorized by purpose across 100+ applications:

- `media/` - Media services (streaming, acquisition, management)
- `home-automation/` - Home automation and IoT
- `dev-tools/` - Development and CI/CD tools
- `ai/` - AI/ML services and inference
- `platform/` - Shared platform services (databases, observability)

## Configuration

- `infrastructure/package.json`: Main project configuration with TypeScript dependencies
- `infrastructure/tsconfig.json`: TypeScript compiler configuration with strict type checking
- `infrastructure/eslint.config.cjs`: ESLint configuration for code quality
- Node.js 18+ required
- Package manager: pnpm
- Line length: 120 characters (Prettier and ESLint)
- Strict TypeScript configuration enabled

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
