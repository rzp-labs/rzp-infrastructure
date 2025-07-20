# Shared Kubernetes Configurations

This directory contains common configurations that are shared across multiple namespaces to reduce duplication and ensure consistency.

## Available Shared Resources

### 🔐 **Authentication Middleware**
- **File**: `zitadel-auth-middleware.yaml`
- **Purpose**: Zitadel forward auth middleware for all UI services
- **Namespaces**: argocd, longhorn-system, observability, traefik

### 🛡️ **Security Headers Middleware**
- **File**: `traefik-common-middleware.yaml`  
- **Purpose**: Standard HTTPS and security headers for all ingresses
- **Namespaces**: argocd, longhorn-system, observability, traefik, zitadel

## Standard Ingress Patterns

### **📱 Standard HTTPS Service**
```yaml
apiVersion: networking.k8s.io/v1
kind: Ingress
metadata:
  name: my-service-ingress
  namespace: my-namespace
  annotations:
    # Standard HTTPS with security headers
    traefik.ingress.kubernetes.io/router.entrypoints: websecure
    traefik.ingress.kubernetes.io/router.tls: "true"
    traefik.ingress.kubernetes.io/router.middlewares: "my-namespace-default-headers@kubernetescrd"
    
    # Standard TLS certificate
    cert-manager.io/cluster-issuer: cloudflare-issuer
spec:
  ingressClassName: traefik
  tls:
  - hosts: [my-service.stg.rzp.one]
    secretName: my-service-tls
  rules:
  - host: my-service.stg.rzp.one
    http:
      paths:
      - path: /
        pathType: Prefix
        backend:
          service: {name: my-service, port: {number: 80}}
```

### **🔐 Protected HTTPS Service**
```yaml
apiVersion: networking.k8s.io/v1
kind: Ingress
metadata:
  name: my-protected-service-ingress
  namespace: my-namespace
  annotations:
    # Standard HTTPS with security headers + authentication
    traefik.ingress.kubernetes.io/router.entrypoints: websecure
    traefik.ingress.kubernetes.io/router.tls: "true"
    traefik.ingress.kubernetes.io/router.middlewares: "my-namespace-default-headers@kubernetescrd,my-namespace-zitadel-auth@kubernetescrd"
    
    # Standard TLS certificate
    cert-manager.io/cluster-issuer: cloudflare-issuer
spec:
  ingressClassName: traefik
  tls:
  - hosts: [my-protected-service.stg.rzp.one]
    secretName: my-protected-service-tls
  rules:
  - host: my-protected-service.stg.rzp.one
    http:
      paths:
      - path: /
        pathType: Prefix
        backend:
          service: {name: my-protected-service, port: {number: 80}}
```

## Benefits

### **🔄 Consistency**
- All services use the same security headers
- Standardized TLS and HTTPS handling
- Unified authentication across platform

### **🛠️ Maintainability** 
- Update security policies in one place
- Change auth proxy settings globally
- Consistent certificate management

### **📊 Security**
- Default security headers on all services
- Standard HTTPS redirect behavior
- Centralized authentication middleware

## Adding New Namespaces

When adding shared configurations to new namespaces:

1. **Add namespace** to relevant shared config YAML files
2. **Update documentation** with the new namespace
3. **Test middleware references** work correctly
4. **Follow naming convention**: `NAMESPACE-MIDDLEWARE-NAME@kubernetescrd`