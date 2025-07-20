# Unified Authentication with Zitadel

This platform uses Zitadel as the centralized identity provider for all services, providing modern OIDC/OAuth2 authentication instead of basic auth.

## Architecture

```
User → Traefik → Zitadel Auth Proxy → Zitadel → Protected Service
  ↓         ↓              ↓            ↓           ↓
Browser   Ingress    Forward Auth    Identity    Longhorn/OpenObserve
```

## Components

### **🔐 Zitadel Identity Platform**
- **Primary Service**: `https://zitadel.stg.rzp.one`
- **Purpose**: OIDC/OAuth2 identity provider
- **Features**: User management, multi-factor auth, RBAC

### **🔗 Zitadel Auth Proxy**
- **Service**: `https://auth.stg.rzp.one`
- **Purpose**: Traefik Forward Auth integration
- **Technology**: thomseddon/traefik-forward-auth

### **🛡️ Protected Services**
All platform services use the same authentication flow:
- **Longhorn UI**: `https://longhorn.stg.rzp.one`
- **OpenObserve**: `https://openobserve.stg.rzp.one`
- **Future services**: Automatically protected

## Authentication Flow

1. **User accesses** protected service (e.g., Longhorn UI)
2. **Traefik** intercepts request, applies `zitadel-auth` middleware
3. **Auth Proxy** checks for valid session cookie
4. **If not authenticated**: Redirect to Zitadel login
5. **User logs in** via Zitadel OIDC flow
6. **Auth Proxy** validates token, sets session cookie
7. **Request forwarded** to protected service with user headers

## Configuration Required

### **Zitadel Setup**
1. **Access Zitadel**: `https://zitadel.stg.rzp.one`
2. **Create Organization**: For your platform
3. **Create Project**: "Platform Services"
4. **Create Application**: OIDC Web application
   - **Name**: "Auth Proxy"
   - **Redirect URIs**: `https://auth.stg.rzp.one/_oauth`
   - **Post Logout URIs**: `https://auth.stg.rzp.one/_oauth/logout`
   - **Application Type**: Web
   - **Auth Method**: PKCE

### **Secret Configuration**
Replace these placeholders with values from Zitadel:

```yaml
# From Zitadel application configuration
ZITADEL_AUTH_PROXY_CLIENT_ID_PLACEHOLDER: "your-client-id"
ZITADEL_AUTH_PROXY_CLIENT_SECRET_PLACEHOLDER: "your-client-secret"

# Generate random 32+ character string
ZITADEL_AUTH_PROXY_SECRET_PLACEHOLDER: "your-session-secret"
```

## User Management

### **Add Users in Zitadel**
1. Navigate to **Users** in Zitadel admin
2. **Create user** with email and initial password
3. **Assign roles** as needed
4. User can **change password** on first login

### **Assign Application Access**
1. Go to **Projects** → "Platform Services"
2. Select **Authorizations**
3. **Grant** users/groups access to applications
4. Set appropriate **roles** (viewer, admin, etc.)

## Benefits

### **🔐 Security**
- **Modern OIDC/OAuth2** instead of basic auth
- **Multi-factor authentication** support
- **Session management** with secure cookies
- **Centralized user management**

### **🚀 User Experience**
- **Single Sign-On (SSO)** across all platform services
- **Modern login flows** with proper redirects
- **Consistent authentication** experience
- **Self-service password** reset and management

### **🛠️ Operations**
- **Centralized audit** logs for authentication
- **Role-based access** control (RBAC)
- **Easy user provisioning** and deprovisioning
- **Integration ready** for new services

## Adding New Services

To protect new services with Zitadel authentication:

1. **Add middleware** annotation to ingress:
   ```yaml
   annotations:
     traefik.ingress.kubernetes.io/router.middlewares: "NAMESPACE-zitadel-auth@kubernetescrd"
   ```

2. **Create middleware** in service namespace:
   ```yaml
   apiVersion: traefik.io/v1alpha1
   kind: Middleware
   metadata:
     name: zitadel-auth
     namespace: YOUR_NAMESPACE
   spec:
     forwardAuth:
       address: "http://zitadel-auth-proxy.zitadel.svc.cluster.local:4181/api/verify"
       authResponseHeaders:
         - "Remote-User"
         - "Remote-Name"
         - "Remote-Email"
         - "Remote-Groups"
       trustForwardHeader: true
   ```

3. **Register application** in Zitadel (if needed for direct OIDC integration)

## Troubleshooting

### **Authentication Loops**
- Check Zitadel application redirect URIs
- Verify auth proxy client credentials
- Check cookie domain configuration

### **Access Denied**
- Verify user has access to the application in Zitadel
- Check user roles and project authorizations
- Review Zitadel audit logs

### **Service Connectivity**
```bash
# Test auth proxy health
kubectl port-forward -n zitadel svc/zitadel-auth-proxy 4181:4181
curl http://localhost:4181/_health

# Check Zitadel connectivity
kubectl logs -n zitadel deployment/zitadel-auth-proxy
```

This unified authentication provides enterprise-grade security while maintaining excellent user experience across the entire platform.