# ArgoCD Bootstrap

This directory contains the minimal manifests required to bootstrap ArgoCD in the K3s cluster.

## Recovery Instructions

In case of complete cluster failure:

1. Provision new K3s cluster using Pulumi
2. Apply these bootstrap manifests:

   ```bash
   kubectl apply -f namespace.yaml
   kubectl apply -f gotk-sync.yaml
   ```

3. ArgoCD will sync remaining applications from Git

## Contents

- `namespace.yaml` - Creates the argocd namespace
- `gotk-sync.yaml` - Points ArgoCD to the Forgejo Git repository
