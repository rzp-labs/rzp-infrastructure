# Deployment Sequence Diagram

## Quick Reference: Component Dependencies

```mermaid
sequenceDiagram
    participant VM as VMs
    participant VMH as VM Health
    participant K3sM as K3s Master
    participant K3sH as K3s Health
    participant K3sW as K3s Workers
    participant MLB as MetalLB
    participant MLBH as MetalLB Health
    participant TFK as Traefik
    participant ACD as ArgoCD

    Note over VM,ACD: Deployment Sequence with Health Checks

    VM->>VMH: 1. VM created
    VMH->>VMH: cloud-init + kernels
    VMH->>K3sM: ✅ VM ready

    K3sM->>K3sH: 2. K3s installed
    K3sH->>K3sH: API server health
    K3sH->>K3sW: ✅ Master ready

    K3sW->>VMH: 3. Worker VMs check
    VMH->>K3sW: ✅ VMs ready
    K3sW->>K3sH: Workers installed
    K3sH->>MLB: ✅ Cluster ready

    MLB->>MLBH: 4. MetalLB deployed
    MLBH->>MLBH: Webhook ready
    MLBH->>TFK: ✅ IP pool ready

    TFK->>ACD: 5. Traefik ready
    ACD->>ACD: ✅ GitOps active
```

## Health Check Retry Logic

```
┌─────────────────┐    ┌──────────────────┐    ┌─────────────────┐
│   VM Health     │    │   K3s Health     │    │ MetalLB Health  │
│                 │    │                  │    │                 │
│ Max: 30 retries │    │ Max: 30 retries  │    │ Max: Pulumi     │
│ Interval: 10s   │    │ Interval: 10s    │    │ Annotations     │
│ Timeout: 5min   │    │ Timeout: 10min   │    │ Timeout: 5min   │
└─────────────────┘    └──────────────────┘    └─────────────────┘
```

## Dependency Tree

```
rzp-infra-staging/
├── k3s-cluster/
│   ├── master-vms → vm-health → k3s-install → k3s-health
│   └── worker-vms → vm-health → k3s-install → k3s-health
├── metallb/
│   ├── depends: [worker-health]
│   └── outputs: ipAddressPool
├── traefik/
│   ├── depends: [metallb.ipAddressPool] ← Fixed dependency
│   └── outputs: loadBalancer
└── argocd/
    ├── depends: [traefik]
    └── outputs: gitops-ready
```
