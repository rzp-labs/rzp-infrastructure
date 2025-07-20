# Zitadel Identity Platform Configuration

Zitadel provides modern identity and access management for all your applications with OIDC, SAML, and OAuth2 support.

## Components

### **PostgreSQL Database**
- **Chart**: Bitnami PostgreSQL 15.5.32
- **Storage**: 5Gi on Longhorn
- **Resources**: 250m CPU, 512Mi memory (requests)

### **Zitadel Application** 
- **Chart**: Official Zitadel Helm chart 8.5.1
- **Replicas**: 2 for high availability
- **External Domain**: `zitadel.stg.rzp.one`
- **TLS**: Let's Encrypt via cert-manager + Traefik

## Configuration Placeholders

Replace these values before deployment:

### **Database Credentials**
- `ZITADEL_DB_PASSWORD_PLACEHOLDER` - Database user password
- `ZITADEL_POSTGRES_PASSWORD_PLACEHOLDER` - PostgreSQL admin password

### **Application Security**
- `ZITADEL_MASTER_KEY_PLACEHOLDER` - Master encryption key (32+ chars)
- `ZITADEL_AUTH_PROXY_CLIENT_ID_PLACEHOLDER` - OIDC client ID for auth proxy
- `ZITADEL_AUTH_PROXY_CLIENT_SECRET_PLACEHOLDER` - OIDC client secret for auth proxy  
- `ZITADEL_AUTH_PROXY_SECRET_PLACEHOLDER` - Auth proxy session secret (32+ chars)

## Features Configured

### **🔐 Security**
- **Read-only root filesystem** for container security
- **Non-root user** execution (UID 1000)
- **Network policies** restricting ingress/egress
- **Security contexts** with dropped capabilities

### **🌐 Networking**
- **Traefik ingress** with TLS termination
- **HTTP/2 support** for modern performance
- **Network policies** for service isolation

### **📊 Monitoring**
- **Prometheus metrics** endpoint on `:9090/debug/metrics`
- **ServiceMonitor** for automatic Prometheus discovery  
- **Grafana dashboard** for identity platform monitoring
- **Health checks** on `/debug/ready` and `/debug/healthz`

### **🚀 High Availability**
- **2 replicas** with pod anti-affinity
- **External PostgreSQL** database
- **Persistent volumes** for data durability

## Post-Deployment Configuration

After Zitadel is deployed, access the admin console:

1. **Navigate to**: `https://zitadel.stg.rzp.one`
2. **Complete setup wizard** for initial organization
3. **Create projects** for your applications
4. **Configure applications** with OIDC/OAuth2 clients

### **Common Application Integration**

For applications requiring authentication:

```yaml
# Example application with Zitadel OIDC
env:
- name: OIDC_ISSUER
  value: "https://zitadel.stg.rzp.one"
- name: OIDC_CLIENT_ID
  valueFrom:
    secretKeyRef:
      name: app-oidc-credentials
      key: client-id
- name: OIDC_CLIENT_SECRET
  valueFrom:
    secretKeyRef:
      name: app-oidc-credentials
      key: client-secret
```

## Backup Strategy

### **Database Backups**
- PostgreSQL configured with persistent storage
- Consider adding Velero or custom backup jobs
- Database contains all identity data and configurations

### **Configuration Backup**
- Export Zitadel configuration periodically
- Store OIDC client configurations externally
- Document custom authentication flows

## Troubleshooting

### **Common Issues**

**Database Connection Issues:**
```bash
kubectl logs -n zitadel deployment/zitadel
kubectl get pods -n zitadel -l app.kubernetes.io/name=postgresql
```

**TLS Certificate Issues:**
```bash
kubectl describe certificate -n zitadel zitadel-tls
kubectl logs -n cert-manager deployment/cert-manager
```

**Ingress Connectivity:**
```bash
kubectl describe ingress -n zitadel
kubectl logs -n traefik deployment/traefik
```

### **Monitoring**

Check Zitadel health endpoints:
```bash
kubectl port-forward -n zitadel svc/zitadel 8080:8080
curl http://localhost:8080/debug/ready
curl http://localhost:8080/debug/healthz
```

View metrics:
```bash
curl http://localhost:8080/debug/metrics
```

## Security Considerations

- **Master Key**: Use a cryptographically secure key (32+ characters)
- **Database Passwords**: Use strong, unique passwords
- **Network Policies**: Configured to restrict access
- **TLS**: All communication encrypted in transit
- **RBAC**: Configure appropriate Kubernetes RBAC for the namespace