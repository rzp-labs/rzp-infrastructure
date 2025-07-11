# GitOps Mono Repo Strategy

## Overview

This document defines the GitOps mono repository strategy for managing 100+ services in the homelab infrastructure. It
establishes clear boundaries between version-controlled configuration and runtime data, defines backup strategies, and
provides a scalable directory structure.

## Separation of Concerns

**Version Control (Git)**

- Static configuration files only
- Desired state definitions
- Infrastructure as Code in TypeScript
- Deployment manifests

**Runtime Data (Not in Git)**

- Application databases
- User-generated content
- Metrics and logs
- Cache files
- Session data

## Scaling Considerations

The structure must support:

- 10 → 100+ services without refactoring
- Multiple environments (staging/production)
- Multi-tenancy (future)
- Self-service deployment
- Automated updates

## Success Metrics

- Deploy service #101 in under 10 minutes
- No manual command execution
- Full observability by default
- Automated backups for all stateful services
- Complete disaster recovery possible

## Repository Structure

```text
/Users/stephen/Projects/rzp-infra/
    ↓ git push
git platform
    ↓ GitOps sync
orchestration cluster
```

## Directory Structure

- Purpose-driven architecture: categorize by the job each service performs, not merely its technical capabilities.
- Follow the 5-Level Rule: directories should not exceed 5 levels deep to avoid complexity and index degradation.

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
│   │   ├── K3sCluster.ts                  # Complete cluster component
│   │   └── ProxmoxNode.ts                 # Individual VM component
│   ├── resources/                         # Resource-specific modules
│   │   └── storage/                       # Storage resources
│   │       ├── images.ts                  # Debian cloud images
│   │       └── cloud-init.ts              # Cloud-init snippets
│   ├── environments/                      # Environment deployments
│   │   └── staging/                       # Staging environment
│   │       └── index.ts                   # Staging deployment
│   └── tests/                             # Infrastructure tests
│       ├── unit/                          # Component unit tests
│       ├── integration/                   # Integration tests
│       ├── test_type_validation.ts        # Leverage TypeScript's type system
│       ├── test_service_dependencies.ts   # Startup ordering
│       ├── test_naming_conventions.ts     # Enforce standards
│       └── test_networking.ts             # Subnet calculations
│
├── bootstrap/                             # Tier 0: Manual bootstrap
│   └── argocd/                            # ArgoCD bootstrap
│       ├── gotk-sync.yaml                 # Points to Harness instance
│       ├── namespace.yaml                 # ArgoCD namespace
│       └── README.md                      # Recovery instructions
├── kubernetes/
│   ├── core/                              # Essential cluster services
│   │   ├── namespaces/                    # Namespace definitions
│   │   ├── metallb/                       # LoadBalancer (10.10.0.200-210)
│   │   ├── cert-manager/                  # TLS certificate management
│   │   ├── external-secrets/              # Infisical integration
│   │   ├── longhorn/                      # Distributed storage
│   │   └── traefik/                       # Ingress controller
│   │
│   ├── platform/                          # Shared platform services
│   │   ├── observability/                 # Observability stack
│   │   │   ├── vector/                    # Vector configuration
│   │   │   ├── openobserve/               # OpenObserve configuration
│   │   │   ├── netdata/                   # Netdata configuration
│   │   │   └── posthog/                   # PostHog configuration
│   │   ├── backup/                        # Backup services
│   │   │   ├── velero/                    # Velero configuration
│   │   │   └── minio/                     # MinIO configuration
│   │   ├── databases/                     # Database services
│   │   │   ├── postgresql/
│   │   │   └── redis/
│   │   └── security/                      # Security services
│   │       └── zitadel/
│   │
│   ├── apps/                              # Application configurations
│   │   ├── media/                         # Media services
│   │   │   ├── acquisition/               # Prowlarr, NzbHydra2, etc.
│   │   │   │   ├── prowlarr               # Indexer management
│   │   │   │   ├── sonarr                 # TV management
│   │   │   │   ├── radarr                 # Movie management
│   │   │   │   ├── nzbhydra2              # NZB indexer management and search
│   │   │   │   ├── sabnzbd                # NZB download
│   │   │   │   ├── qbittorrent            # Torrent download
│   │   │   ├── streaming/                 # Plex, Kavita, etc.
│   │   │   │   ├── plex
│   │   │   │   ├── kavita
│   │   │   └── management/                # Organizr, Tautulli, etc.
│   │   │   │   ├── tautulli               # Plex monitoring
│   │   │   │   ├── organizr               # Organizr
│   │   │   │
│   │   ├── home-automation/               # Home automation
│   │   │   ├── home-assistant             # Home automation
│   │   │   ├── mosquitto                  # MQTT broker
│   │   │   └── node-red                   # Flow automation
│   │   │
│   │   ├── dev-tools/                     # Development tools
│   │   │   ├── harness                    # Git server & CI/CD
│   │   │   ├── backstage                  # Developer portal
│   │   │   ├── harbor                     # Container registry
│   │   │   └── portainer                  # Container management
│   │   │
│   │   ├── ai/                            # AI/ML services
│   │   │   ├── ollama                     # LLM inference
│   │   │   ├── langfuse                   # LLM observability
│   │   │   └── jupyter                    # Notebooks
│   │   │
│   │   └── [more categories]/             # 70+ more services
│   │
│   └── shared-config/                     # Shared configurations
│       ├── ingress-routes/                # Traefik routes
│       ├── network-policies/              # Security policies
│       ├── backup-policies/               # Velero backup specs
│       └── secrets/                       # Sealed secrets
├── docs/                                  # The missing knowledge layer
│   ├── architecture/
│   │   ├── decisions/                     # ADRs (numbered, immutable)
│   │   │   ├── ADR-001-purpose-driven-taxonomy.md
│   │   │   ├── ADR-002-five-level-directory-limit.md
│   │   │   └── ADR-003-typescript-infrastructure.md
│   │   │
│   │   ├── patterns/                      # Reusable architectural patterns
│   │   │   ├── service-deployment-pattern.md
│   │   │   ├── database-backup-strategy.md
│   │   │   ├── ingress-configuration-standard.md
│   │   │   └── pulumi-component-guidelines.md
│   │   │
│   │   └── diagrams/                      # C4, data flow, dependency maps
│   │       ├── c4-context.puml
│   │       ├── network-topology.svg
│   │       └── data-flow.mermaid
│   │
│   ├── operations/
│   │   ├── runbooks/                      # When things break at 3 AM
│   │   │   ├── cluster-recovery.md
│   │   │   ├── media-stack-troubleshooting.md
│   │   │   ├── certificate-renewal-failure.md
│   │   │   └── argocd-desync-resolution.md
│   │   │
│   │   ├── guides/                        # How to do common tasks
│   │   │   ├── adding-new-service.md
│   │   │   ├── updating-dependencies.md
│   │   │   ├── gitops-deployment-flow.md
│   │   │   └── monitoring-integration.md
│   │   │
│   │   └── maintenance/                   # Preventive care procedures
│   │   │   ├── daily-checks.md
│   │   │   ├── weekly-tasks.md
│   │   │   └── monthly-maintenance.md
│   │   │
│   │   └── reference/
│   │       ├── service-catalog/           # What runs where and why
│   │       ├── network-topology/          # VLAN, subnet documentation
│   │       ├── port-registry.md           # Service port mappings
│   │       └── backup-inventory/          # What gets backed up, how, where
├── .pre-commit-config.yaml                # Pre-commit hooks (TypeScript focus)
├── .gitignore                             # Ignore generated files
├── README.md                              # Repository overview
└── Makefile                               # Common operations
```

## Configuration vs Runtime Data Examples

### Example: Media Server

**Version Controlled (Git)**

- Infrastructure as Code in TypeScript
- Desired state definitions
- Deployment manifests

**Runtime Data (Backed Up, Not in Git)**

- User accounts and watch history
- Media metadata and artwork
- Transcoding cache
- Library scan results

## Infrastructure Deployment Flow

```
1. Pulumi (TypeScript) → Provisions Proxmox VMs + K3s cluster
2. ArgoCD watches kubernetes/ directory
3. GitOps deploys applications to K3s cluster
4. Applications run as containers on worker nodes
```

## Best Practices

1. **Use established templates** when available.

2. Use **namespaces** to organize services by functional domain

   ```md
   # Core Infrastructure

   infrastructure-system platform-monitoring platform-logging platform-databases
   ```

   ```md
   # Application Namespaces

   media-streaming media-downloads home-automation dev-tools ai-inference web-public web-internal
   ```

3. **Every service gets**:

   - Monitoring
   - Persistence requirements
   - Ingress rules
   - Backup annotations
   - Resource limits
   - Network policy

4. **Standardize configurations**

   - Consistent naming
   - Common labels
   - Shared secrets via External Secrets Operator

5. **Infrastructure as Code Standards**
   - TypeScript with strict type checking
   - Component-based architecture
   - Environment-specific configurations
   - Comprehensive testing

---

Last Updated: 2025-07-01
