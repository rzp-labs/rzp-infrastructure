# rzp-infra Architecture Documentation

## Overview

This directory contains comprehensive documentation about the rzp-infra architecture, deployment patterns, and design decisions.

## 📊 Deployment Flow & Dependencies

### 🆕 [Deployment Flow with Health Checks](./deployment-flow-with-health-checks.md)
**Complete visualization of the deployment pipeline including health checks, dependencies, and timing.**

- Mermaid diagram showing component relationships
- Health check implementation details  
- Dependency matrix with timeouts
- Critical dependency fixes (Traefik → MetalLB)
- Failure recovery strategies

### 🆕 [Deployment Sequence](./deployment-sequence.md)
**Quick reference sequence diagram and dependency tree.**

- Simplified sequence diagram
- Health check retry logic
- Component dependency tree

## 🏗️ Architecture Documents

### [Infrastructure Stack](./infrastructure-stack.md)
Core infrastructure components and their relationships.

### [GitOps Mono-Repo Strategy](./gitops-mono-repo-strategy.md)
GitOps workflow and repository organization strategy.

### [Pulumi Native Refactor](./pulumi-native-refactor.md)
Migration to native Pulumi patterns and component resources.

### [Architectural Plan](./architectural_plan.md)
High-level architectural decisions and roadmap.

## 📋 Architecture Decision Records (ADRs)

### [ADR Patterns](./patterns/)
Reusable architectural patterns and best practices.

### [ADR Decisions](./decisions/)
Formal architecture decision records with rationale.

## 🔍 Key Architecture Features

### Health Check Integration ✅
- **VM Health Checks**: Cloud-init completion, kernel modules, networking
- **K3s Health Checks**: API server readiness, node status validation  
- **MetalLB Health Checks**: Webhook service readiness validation
- **Retry Logic**: 30 attempts × 10s intervals with configurable timeouts

### Dependency Management ✅  
- **Fixed Traefik Dependencies**: Now waits for MetalLB IPAddressPool vs just Helm chart
- **Component Resource Pattern**: Native Pulumi ComponentResource usage
- **Proper Resource Ordering**: Prevents timing issues and deployment failures

### Infrastructure as Code ✅
- **Pulumi TypeScript**: Strict typing and SOLID principles
- **Modular Components**: Reusable, testable infrastructure components
- **Configuration Management**: Environment-specific configs with defaults

## 🚀 Quick Start

1. **Understand the flow**: Start with [Deployment Flow](./deployment-flow-with-health-checks.md)
2. **Review dependencies**: Check [Deployment Sequence](./deployment-sequence.md) 
3. **Explore components**: Read component-specific docs in `/docs/components/`

## 🔧 Recent Improvements

### Phase 1: Health Check Integration (Completed)
- ✅ VM and K3s health check utilities implemented
- ✅ Integrated into K3s master and worker components  
- ✅ Function length compliance (≤20 lines per SOLID guidelines)
- ✅ Fixed Traefik → MetalLB dependency timing

### Next Phase: Systematic Health Checks
- 🔄 Expand health checks to all infrastructure components
- 🔄 Add monitoring integration and alerting
- 🔄 Implement infrastructure testing with Pulumi Automation SDK

## 📈 Monitoring & Observability

The architecture includes comprehensive observability:

- **Deployment Monitoring**: Real-time health check status during `pulumi up`
- **Infrastructure Monitoring**: Component readiness and dependency validation
- **GitOps Monitoring**: ArgoCD tracks Kubernetes resource health
- **Application Monitoring**: Vector → OpenObserve observability stack

---

**Last Updated**: January 2025  
**Status**: Production Ready with Health Check Integration