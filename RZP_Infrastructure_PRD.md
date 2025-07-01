<context>
# Overview  
RZP Infrastructure is a GitOps-managed homelab infrastructure platform that automates the complete lifecycle of 100+ services through Infrastructure-as-Code. It solves the problem of manual, fragmented homelab management by providing a unified Pulumi Python codebase that generates Kubernetes manifests for ArgoCD deployment, with enterprise-grade monitoring, backup, and security policies enforced automatically for every service.

The platform is for infrastructure engineers and homelab enthusiasts who want to manage complex multi-service
environments at scale without manual operations. It's valuable because it transforms homelab infrastructure from a
collection of manually-managed services into a code-driven, self-healing, enterprise-grade platform that can scale from
10 to 100+ services while maintaining reliability and operational visibility.

# Core Features

**Unified Infrastructure-as-Code Engine**

- What it does: Single Pulumi Python program manages entire stack from VMs to applications
- Why it's important: Eliminates tool fragmentation and provides type-safe infrastructure definitions
- How it works: Pydantic models + Pulumi providers generate Kubernetes manifests to `/kubernetes` directory

**Automatic Standards Enforcement**

- What it does: Every service automatically gets monitoring, backup, and network security policies
- Why it's important: Ensures enterprise-grade reliability without manual configuration per service
- How it works: BaseService component applies standard configurations through resource transformations

**Intelligent Resource Management**

- What it does: Hierarchical naming with collision detection, environment-aware resource allocation
- Why it's important: Prevents conflicts and resource contention when scaling to 100+ services
- How it works: Enhanced naming system with tier-based patterns and automatic collision resolution

**GitOps Deployment Pipeline**

- What it does: All infrastructure changes flow through Git → CI/CD → ArgoCD → Production
- Why it's important: Provides audit trails, rollback capabilities, and eliminates manual deployments
- How it works: Pulumi generates manifests, ArgoCD watches `/kubernetes` directory for automatic deployment

# User Experience

**Primary User Persona: Infrastructure Engineer**

- Manages homelab infrastructure design and implementation
- Wants reliable, scalable infrastructure with minimal manual operations
- Success metric: Zero manual deployments, <5 minute infrastructure changes

**Key User Flow: Deploy New Service**

1. Create Python class extending BaseService with configuration
2. Run `pulumi up` to generate Kubernetes YAML manifests
3. Git commit triggers ArgoCD sync and automatic deployment
4. Service automatically gets monitoring, backups, network policies
5. Verify service health via integrated observability dashboards

**UI/UX Considerations**

- CLI-first experience for automation compatibility
- ArgoCD web UI for deployment status visualization
- Integrated monitoring dashboards for operational visibility
- Clear error messages with actionable remediation steps </context> <PRD>

# Technical Architecture

**System Components**

- BaseComponent framework with inheritance hierarchy: BaseComponent → KubernetesComponent → ServiceComponent
- Provider integration layer: Proxmox (VMs), Kubernetes (workloads), Cloudflare (DNS), Infisical (secrets)
- GitOps pipeline: Pulumi → YAML generation → ArgoCD → Kubernetes deployment
- Observability stack: Vector → OpenObserve pipeline with automatic ServiceMonitor creation
- Backup system: Velero integration with configurable policies and retention

**Data Models**

- ServiceConfig: Pydantic model defining service specifications (image, replicas, resources, monitoring)
- ResourceNamingConfig: Hierarchical naming with collision detection and environment awareness
- BackupConfig: Velero backup policies with retention and scheduling configuration
- NetworkPolicyConfig: Default-deny with explicit allow rules for service communication

**APIs and Integrations**

- Proxmox VE API for VM lifecycle management and template provisioning
- Kubernetes API for workload deployment and status monitoring
- Cloudflare API for DNS record management and SSL certificate automation
- Infisical API for secret retrieval integrated with External Secrets Operator

**Infrastructure Requirements**

- Proxmox cluster: 3x VMs with 32GB RAM, 1TB storage each for worker nodes
- Network: /24 subnet for MetalLB load balancer pool, Cloudflare zone delegation
- Storage: Ceph/NFS for persistent volumes, S3-compatible for Velero backups

# Development Roadmap

**MVP Phase: Core Framework Completion**

- Complete testing infrastructure to achieve 80%+ coverage
- Finish Proxmox provider integration for VM lifecycle management
- Implement cross-service dependency management and startup ordering
- Deploy core platform services: monitoring, backup, secrets, ingress
- Add multi-environment support for dev/staging/prod configurations
- Build CI/CD pipeline with Harness integration
- Validate with 10-15 core services deployed via GitOps

**Expansion Phase: Service Ecosystem**

- Media services: Sonarr, Radarr, Prowlarr, Plex, Kavita, Overseerr
- Home automation: Home Assistant, Node-RED, Mosquitto, Zigbee2MQTT
- Development platform: Harbor, Backstage, Portainer
- Create service template library for common application patterns
- Implement advanced networking with service mesh integration
- Add resource utilization analysis and cost optimization features

**Scale Phase: Advanced Services**

- AI/ML platform: Ollama, Langfuse, Jupyter, MLflow with GPU support
- Data pipeline: Apache Airflow, analytics workloads, data lake storage
- Advanced deployment strategies: blue-green deployments, canary releases
- Chaos engineering: automated resilience testing and failure injection
- Reach 100+ services across all major application domains

**Enterprise Phase: Production Hardening**

- Multi-cluster management and federation capabilities
- Advanced RBAC with fine-grained access control and audit logging
- Compliance automation with security scanning and reporting
- SRE practices: SLI/SLO monitoring, error budgets, incident response
- Performance optimization with auto-scaling and resource right-sizing

# Logical Dependency Chain

**Foundation First (Critical Path)**

1. Testing Framework - Must achieve 80% coverage before any production deployment
2. Proxmox Provider - Required for VM provisioning, blocks infrastructure layer
3. Service Dependencies - Needed before deploying multiple interconnected services
4. Platform Services - Core infrastructure (monitoring, backup) must exist before applications

**Rapid Path to Usable Frontend**

1. Complete BaseService with monitoring integration → Immediate visibility
2. Deploy ArgoCD with GitOps pipeline → Visual deployment status
3. Add 3-5 core services (monitoring, backup, ingress) → Functional infrastructure
4. Deploy first application service with full stack → End-to-end validation

**Atomic Feature Development**

- Each service implementation is self-contained and independently testable
- Standards (monitoring, backup, security) added as progressive layers
- Service templates created after patterns emerge from 3-5 similar services
- Environment support added after core framework proves stable

**Build-Upon Strategy**

- BaseService foundation enables all future services to inherit capabilities
- Provider abstraction allows infrastructure changes without affecting services
- Configuration models support environment-specific overrides without code duplication
- Template library accelerates onboarding as common patterns are identified

# Risks and Mitigations

**Technical Challenges**

- Risk: Proxmox cluster, Harness CI/CD, or Infisical secret management unavailable
- Mitigation: Validate all external dependencies before development, implement provider abstraction for alternative
  backends, create local development environment

- Risk: Scale complexity at 100+ services reveals performance issues or management overhead
- Mitigation: Implement testing at each milestone (10, 25, 50, 100 services), use resource quotas and monitoring,
  automated cleanup for unused resources

**MVP Definition and Scope**

- Risk: Scope creep preventing delivery of working foundation
- Mitigation: Strictly limit MVP to 10-15 core services, focus on complete GitOps pipeline over feature breadth,
  validate with real deployments before expanding

- Risk: Perfect being enemy of good, over-engineering foundation before validation
- Mitigation: Deploy first working service as quickly as possible, iterate on standards based on operational experience,
  build templates after patterns emerge

**Resource Constraints**

- Risk: Development time for 15 remaining critical tasks
- Mitigation: Prioritize tasks that unblock others, implement service templates to accelerate application onboarding,
  focus on automated testing to reduce manual validation

- Risk: Insufficient hardware capacity for 100+ service target
- Mitigation: Resource monitoring and alerting from day one, auto-scaling policies for non-critical services, plan for
  horizontal scaling with additional nodes

# Appendix

**Research Findings**

- Current state: 11/28 tasks completed, 35.89% test coverage, 213 existing tests provide good foundation
- Architecture validation: SOLID principles enforced, type safety with mypy, clean component hierarchy supports
  extensibility
- Technology stack proven: Pulumi Python mature, ArgoCD production-ready, Vector/OpenObserve cost-effective for homelab
  scale

**Technical Specifications**

- Performance requirements: <10 minutes deployment time, <5 minutes infrastructure changes, <30 minutes disaster
  recovery
- Security requirements: Default-deny network policies, zero plaintext secrets, RBAC access control, complete audit
  trails
- Reliability requirements: 99%+ uptime, RPO <4 hours, 100% monitoring coverage, monthly backup restore testing </PRD>
