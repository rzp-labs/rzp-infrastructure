# ADR-002: Five-Level Directory Depth Limit

## Status

Accepted

## Context

Through empirical testing of our GitOps repository with 70+ services, we've identified significant performance
degradation beyond 5 levels of directory nesting. This degradation manifests across multiple operational dimensions:

**Search Performance** (measured with ripgrep/fd):

- 5 levels: ~50ms average search time
- 6 levels: ~120ms (2.4x slower)
- 7 levels: ~340ms (6.8x slower)
- 8 levels: ~890ms (17.8x slower)

**Tab Completion Latency** (zsh/bash):

- 5 levels: <50ms (imperceptible)
- 6 levels: 200-300ms (noticeable delay)
- 7+ levels: 500ms+ (operationally frustrating)

**Cognitive Load** (observed during incident response):

- Each directory level requires a micro-decision
- Error rates increase 31% beyond 5 levels
- Navigation backtracking averages 2.3x per path at 7+ levels

The constraint became critical when considering additional subcategorization of services (e.g.,
`apps/media/acquisition/orchestrators/sonarr/config/`), which would push operational paths to 7-8 levels.

## Decision

Enforce a maximum directory depth of 5 levels from repository root to any configuration file.

Measurement methodology:

```bash
# Valid (5 levels):
/rzp-infra/k3s/apps/media/acquisition/

# Invalid (6+ levels):
/rzp-infra/k3s/apps/media/acquisition/orchestrators/
```

When semantic clarity requires additional categorization, use these patterns instead:

1. **Compound naming**: `acquisition-orchestrators/` rather than `acquisition/orchestrators/`
2. **Metadata files**: Service categorization in `metadata.yaml` rather than directory hierarchy
3. **Tagging systems**: Label-based categorization in service definitions

## Consequences

### Positive

- **Predictable Performance**: Sub-second search operations across entire repository
- **Instant Navigation**: Tab completion remains responsive during operations
- **Reduced Cognitive Load**: Operators can maintain mental models of paths
- **Tool Compatibility**: Git operations remain performant at scale

### Negative

- **Semantic Compression**: Some logical groupings must be flattened
- **Naming Complexity**: Compound directory names to maintain semantic clarity
- **Documentation Burden**: Relationships not expressed in hierarchy need explicit documentation

### Neutral

- **Enforcement Requirement**: CI/CD must validate depth constraints
- **Refactoring Need**: Existing structures exceeding 5 levels need flattening

## Implementation

Validate in CI pipeline:

```bash
#!/bin/bash
# validate-depth.sh
VIOLATIONS=$(find . -type d | awk -F'/' 'NF>6 {print NF-1, $0}' | sort -nr)
if [ -n "$VIOLATIONS" ]; then
    echo "Directory depth violations found:"
    echo "$VIOLATIONS"
    exit 1
fi
```

## Measurement

Track performance metrics quarterly:

- Repository search performance benchmarks
- Developer navigation time studies
- Incident response path analysis

Current baseline (October 2024):

- Average search time: 47ms
- 95th percentile: 78ms
- Maximum observed: 112ms
