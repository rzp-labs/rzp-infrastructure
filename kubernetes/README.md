# Kubernetes GitOps Structure

This directory contains the complete Kubernetes application definitions managed by ArgoCD, organized by architectural layers.

## Architecture Layers

### 🏗️ **Core Infrastructure** (`/core/`)

**Bootstrap requirements for GitOps to function**

- **MetalLB** - LoadBalancer networking for bare metal
- **cert-manager** - TLS certificate management  
- **Traefik** - Ingress controller for external access
- **Longhorn** - Distributed storage for persistent volumes
- **Infisical Secrets Operator** - External secrets management

These components are essential for ArgoCD itself to function properly and be accessible.

### 🔧 **Platform Services** (`/platform/`)

**Capabilities and services that applications consume**

- **Longhorn** - Distributed storage for persistent volumes
- **Infisical** - Secrets management and injection
- **Zitadel** - Identity and access management (OIDC/OAuth2)
- **OpenObserve** - Observability platform (logs, metrics, traces)
- **Vector** - High-performance data pipeline
- **Databases** - PostgreSQL, Redis, etc.

These provide the platform capabilities that applications depend on.

### 📱 **Applications** (`/apps/`)

**Business applications and user-facing services**

- Custom applications
- Third-party applications
- Microservices

These are the actual workloads that deliver business value.

## Deployment Flow

```
Pulumi: VMs + K3s + Minimal ArgoCD
    ↓
ArgoCD: Core Infrastructure (sync-wave 0-5)
    ↓
ArgoCD: Platform Services (sync-wave 10+)
    ↓
ArgoCD: Applications (sync-wave 20+)
```

### Sync Wave Strategy

**Core Infrastructure (0-5):**

- Wave 0: Namespaces
- Wave 1: MetalLB
- Wave 2: MetalLB config, cert-manager
- Wave 3: cert-manager config, Traefik

**Platform Services (10+):**

- Wave 10: Platform namespaces
- Wave 11: Longhorn storage
- Wave 12: Longhorn config, Infisical databases
- Wave 13: Infisical application

**Applications (20+):**

- Wave 20+: Business applications

## Deployment Commands

### Deploy Everything (App of Apps)

```bash
# Deploy core infrastructure first
kubectl apply -f kubernetes/core/core.yaml

# Deploy platform services after core is ready
kubectl apply -f kubernetes/platform/platform.yaml

# Deploy applications after platform is ready
kubectl apply -f kubernetes/apps/apps.yaml
```

### Deploy Individual Layers

```bash
# Core only
kubectl apply -f kubernetes/core/

# Platform only (requires core)
kubectl apply -f kubernetes/platform/

# Apps only (requires platform)
kubectl apply -f kubernetes/apps/
```

## Operational Benefits

### **🔄 Clear Boundaries**

- **Infrastructure Team**: Manages `/core/` (rarely changes)
- **Platform Team**: Manages `/platform/` (moderate changes)
- **Development Teams**: Manage `/apps/` (frequent changes)

### **📊 Dependency Management**

- Core provides foundation for platform
- Platform provides capabilities for applications
- Clear dependency hierarchy prevents circular issues

### **🛠️ Operational Simplicity**

- Each layer can be updated independently
- Platform changes don't require infrastructure changes
- Application deployments don't affect platform stability

### **🔐 Security & Governance**

- Different RBAC policies per layer
- Platform services can be locked down
- Applications have restricted capabilities

## Migration Strategy

1. **Deploy Minimal ArgoCD** via Pulumi (NodePort, no ingress)
2. **Bootstrap Core** - Apply `kubernetes/core/core.yaml`
3. **Deploy Platform** - Apply `kubernetes/platform/platform.yaml`
4. **Migrate Applications** - Move apps to `kubernetes/apps/`
5. **Remove from Pulumi** - Clean up Pulumi-managed platform components

This architecture provides a clean separation of concerns while maintaining GitOps principles throughout the stack.
