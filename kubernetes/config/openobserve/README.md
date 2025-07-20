# OpenObserve - Modern Observability Platform

OpenObserve is a cloud-native observability platform for logs, metrics, and traces with built-in analytics and dashboards.

## Components

### **PostgreSQL Database**

- **Chart**: Bitnami PostgreSQL 15.5.32
- **Storage**: 10Gi on Longhorn
- **Resources**: 500m CPU, 1Gi memory (requests)
- **Metrics**: Enabled with ServiceMonitor

### **OpenObserve Application**

- **Image**: public.ecr.aws/zinclabs/openobserve:v0.10.9
- **Replicas**: 2 StatefulSet for high availability
- **Storage**: 50Gi per replica for data persistence
- **External Domain**: `openobserve.stg.rzp.one`

## Configuration Placeholders

Replace these values before deployment:

### **Database Credentials**

- `OPENOBSERVE_DB_PASSWORD_PLACEHOLDER` - Database user password
- `OPENOBSERVE_POSTGRES_PASSWORD_PLACEHOLDER` - PostgreSQL admin password

### **Application Security**

- `admin@rzp.one` - Root user email
- `OPENOBSERVE_ROOT_PASSWORD_PLACEHOLDER` - Root user password
- `OPENOBSERVE_JWT_SECRET_PLACEHOLDER` - JWT signing secret (32+ chars)
- `OPENOBSERVE_AUTH_HASH_PLACEHOLDER` - Bcrypt hash for basic auth

### **Storage (Optional)**

- `OPENOBSERVE_S3_ACCESS_KEY_PLACEHOLDER` - S3 access key for object storage
- `OPENOBSERVE_S3_SECRET_KEY_PLACEHOLDER` - S3 secret key

### **Domain**

- `rzp.one` - Your domain (e.g., `example.com`)

## Features Configured

### **🔐 Security**

- **Read-only root filesystem** with tmp volume mounts
- **Non-root user** execution (UID 10001)
- **Basic auth middleware** via Traefik for additional protection
- **Network policies** for service isolation
- **Security contexts** with dropped capabilities

### **📊 Data Management**

- **PostgreSQL metadata** storage for scalability
- **Local disk storage** with persistent volumes
- **Data lifecycle** management (30-day retention)
- **Compaction** enabled for optimization
- **Memory circuit breaker** at 80% threshold

### **🌐 Networking**

- **Traefik ingress** with TLS termination
- **HTTP/2 support** on port 5080
- **gRPC support** on port 5081 for high-performance ingestion
- **LoadBalancer** ready for external access

### **📈 Performance**

- **StatefulSet deployment** with persistent storage
- **Resource limits** and requests configured
- **Health checks** on `/healthz` endpoint
- **Horizontal scaling** ready (increase replicas)

## Data Ingestion

### **Vector Integration**

OpenObserve receives data from Vector via HTTP API:

```yaml
# Logs endpoint
POST /api/default/default/_json

# Metrics endpoint
POST /api/default/metrics/_json
```

### **Direct API Usage**

```bash
# Ingest logs
curl -X POST \
  -H "Content-Type: application/json" \
  -u "admin@rzp.one:password" \
  "https://openobserve.stg.rzp.one/api/default/default/_json" \
  -d '[{"timestamp":"2024-01-01T00:00:00Z","level":"info","message":"test log"}]'

# Ingest metrics
curl -X POST \
  -H "Content-Type: application/json" \
  -u "admin@rzp.one:password" \
  "https://openobserve.stg.rzp.one/api/default/metrics/_json" \
  -d '[{"timestamp":"2024-01-01T00:00:00Z","metric":"cpu_usage","value":75.5}]'
```

## Post-Deployment Setup

After OpenObserve is deployed:

1. **Access UI**: Navigate to `https://openobserve.stg.rzp.one`
2. **Login**: Use root credentials configured in secrets
3. **Create Organizations**: Set up organizations for different teams
4. **Configure Streams**: Define log and metric streams
5. **Set up Dashboards**: Create visualization dashboards
6. **Configure Alerts**: Set up alerting rules

### **Common Dashboard Queries**

```sql
-- Recent error logs
SELECT * FROM default
WHERE log_level = 'error'
AND timestamp >= now() - interval '1 hour'
ORDER BY timestamp DESC

-- CPU usage over time
SELECT timestamp, avg(value) as avg_cpu
FROM metrics
WHERE metric = 'cpu_usage'
AND timestamp >= now() - interval '24 hours'
GROUP BY timestamp
ORDER BY timestamp
```

## Monitoring & Alerting

### **Health Monitoring**

```bash
# Check OpenObserve health
kubectl get pods -n observability -l app=openobserve
kubectl logs -n observability -l app=openobserve

# Check database connectivity
kubectl exec -n observability deployment/openobserve -- \
  curl -f http://localhost:5080/healthz
```

### **Resource Monitoring**

- **Disk Usage**: Monitor `/data` volume usage per replica
- **Memory Usage**: Watch for memory circuit breaker triggers
- **Database Connections**: Monitor PostgreSQL connection pool

### **Performance Tuning**

- **Compaction Interval**: Adjust `ZO_COMPACT_INTERVAL` for your ingestion rate
- **Memory Threshold**: Tune `ZO_MEMORY_CIRCUIT_BREAKER_THRESHOLD`
- **Retention Policy**: Configure `ZO_DATA_LIFECYCLE_DAYS`

## Backup Strategy

### **Database Backups**

- PostgreSQL contains metadata and configuration
- Consider Velero or pg_dump for regular backups

### **Data Backups**

- Primary data stored in StatefulSet persistent volumes
- Configure S3 backend for automatic data tiering
- Snapshot persistent volumes regularly

## Troubleshooting

### **Common Issues**

**Pod Not Starting:**

```bash
kubectl describe pod -n observability -l app=openobserve
kubectl logs -n observability -l app=openobserve --previous
```

**Database Connection Issues:**

```bash
kubectl get pods -n observability -l app.kubernetes.io/name=postgresql
kubectl logs -n observability -l app.kubernetes.io/name=postgresql
```

**Ingestion Problems:**

```bash
# Check Vector connectivity
kubectl logs -n observability -l app.kubernetes.io/name=vector

# Test API endpoint
kubectl port-forward -n observability svc/openobserve 5080:5080
curl http://localhost:5080/healthz
```

**High Memory Usage:**

- Check `ZO_MEMORY_CIRCUIT_BREAKER_THRESHOLD` setting
- Increase resource limits or add more replicas
- Review data retention and compaction settings

## Scaling

### **Horizontal Scaling**

```bash
# Scale OpenObserve replicas
kubectl scale statefulset -n observability openobserve --replicas=3

# Scale PostgreSQL (if using HA setup)
kubectl scale deployment -n observability openobserve-postgres-postgresql --replicas=2
```

### **Vertical Scaling**

- Increase CPU/memory limits in the deployment
- Expand persistent volume size as needed
- Monitor performance metrics to determine scaling needs
