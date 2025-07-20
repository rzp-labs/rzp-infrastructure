# Vector - High-Performance Data Pipeline

Vector is a high-performance observability data router that collects, transforms, and routes logs, metrics, and traces from across your infrastructure to OpenObserve.

## Components

### **Vector Aggregator**

- **Chart**: Official Vector Helm chart 0.34.0
- **Role**: Aggregator mode for centralized data processing
- **Replicas**: 2 for high availability with anti-affinity
- **Storage**: 10Gi persistent storage for buffering
- **Resources**: 200m CPU, 512Mi memory (requests)

## Data Flow Architecture

```
Kubernetes Cluster → Vector → OpenObserve
      ↓
├── Pod Logs (kubernetes_logs)
├── Host Metrics (host_metrics)
├── K8s Metrics (kubernetes_metrics)
└── Vector Metrics (internal_metrics)
      ↓
├── Parse & Enrich (transforms)
├── Add Metadata (cluster, timestamp)
└── Route to OpenObserve (sinks)
```

## Configuration Placeholders

Replace these values before deployment:

### **OpenObserve Integration**

- `admin@rzp.one` - OpenObserve username for authentication
- `OPENOBSERVE_ROOT_PASSWORD_PLACEHOLDER` - OpenObserve password for authentication

## Data Sources Configured

### **📋 Kubernetes Logs**

- **Source**: All pod logs cluster-wide
- **Enrichment**: Pod metadata, namespace labels, container info
- **Processing**: JSON parsing, log level normalization
- **Target**: OpenObserve logs stream

### **📊 Host Metrics**

- **Collectors**: CPU, disk, filesystem, load, memory, network
- **Frequency**: Real-time collection
- **Processing**: Add cluster and node metadata
- **Target**: OpenObserve metrics stream

### **🔧 Kubernetes Metrics**

- **Source**: Kubernetes API metrics endpoint
- **Authentication**: Service account token
- **TLS**: CA certificate validation
- **Target**: OpenObserve metrics stream

### **🔍 Vector Internal Metrics**

- **Source**: Vector's own performance metrics
- **Purpose**: Monitor the monitoring pipeline
- **Target**: OpenObserve metrics stream

## Data Transformations

### **Log Processing Pipeline**

```toml
# 1. Parse JSON logs automatically
parsed = parse_json(.message) ?? {}
. = merge(., parsed)

# 2. Add standard metadata
.timestamp = now()
.source_type = "kubernetes"
.cluster = "stg"

# 3. Normalize log levels
.log_level = downcase(string!(.log_level))
```

### **Metrics Processing Pipeline**

```toml
# Add cluster and source metadata
.timestamp = now()
.source_type = "host_metrics|kubernetes_metrics|vector_internal"
.cluster = "stg"
.node = .host  # For host metrics
```

## Performance Configuration

### **🚀 Buffering Strategy**

- **Logs**: Disk buffering (256MB) with blocking when full
- **Metrics**: Memory buffering (10K events) with drop newest
- **Compression**: Gzip for efficient transmission
- **Batching**: 1MB batches with 5-10s timeouts

### **🔄 Retry Logic**

- **Attempts**: 3 retries with exponential backoff
- **Initial Backoff**: 1-2 seconds
- **Max Duration**: 60-120 seconds
- **Timeout**: 30 seconds per request

### **📈 Resource Management**

- **CPU Limits**: 1000m for burst processing
- **Memory Limits**: 2Gi for large log volumes
- **Disk Buffer**: 10Gi persistent storage
- **Anti-affinity**: Spread replicas across nodes

## Security Configuration

### **🔐 RBAC Permissions**

Vector has cluster-wide read access to:

- Pods and pod logs
- Nodes and node metrics
- Services and endpoints
- Deployments, ReplicaSets, StatefulSets
- ConfigMaps and Secrets (for service discovery)

### **🛡️ Network Policies**

- **Ingress**: Only from metrics scrapers for monitoring
- **Egress**: Only to OpenObserve, Kubernetes API, and DNS
- **Internal**: Vector instances can communicate for clustering

### **🔒 Security Context**

- **Non-root user**: UID 1000
- **Read-only filesystem**: With writable tmp volumes
- **Dropped capabilities**: ALL capabilities removed
- **No privilege escalation**: Enforced

## Monitoring & Observability

### **📊 Built-in Metrics**

Vector exposes comprehensive metrics on `:8686/metrics`:

- `vector_component_sent_events_total` - Events processed per component
- `vector_component_received_events_total` - Events received per component
- `vector_component_errors_total` - Error rate per component
- `vector_buffer_byte_size` - Buffer utilization
- `vector_memory_used_bytes` - Memory usage

### **📈 Grafana Dashboard**

Pre-configured dashboard includes:

- **Throughput**: Events processed/received rates
- **Error Monitoring**: Component error rates
- **Performance**: Buffer usage, memory, CPU
- **Health**: Component status and connectivity

### **🔍 Health Checks**

```bash
# Check Vector API status
kubectl port-forward -n observability svc/vector 8686:8686
curl http://localhost:8686/health

# View Vector topology
curl http://localhost:8686/graph

# Check internal metrics
curl http://localhost:8686/metrics
```

## Operational Tasks

### **📋 Log Analysis**

```bash
# View Vector logs
kubectl logs -n observability -l app.kubernetes.io/name=vector

# Check specific component logs
kubectl logs -n observability -l app.kubernetes.io/name=vector | grep "kubernetes_logs"

# Monitor error rates
kubectl logs -n observability -l app.kubernetes.io/name=vector | grep ERROR
```

### **🔧 Configuration Changes**

Vector configuration is managed via Helm values. To update:

1. Modify the Vector Application manifest
2. Commit changes to Git
3. ArgoCD automatically syncs the new configuration
4. Vector pods restart with new config

### **📊 Performance Tuning**

**High Volume Environments:**

```yaml
# Increase resources
resources:
  requests:
    cpu: 500m
    memory: 1Gi
  limits:
    cpu: 2000m
    memory: 4Gi

# Larger buffers
batch:
  max_bytes: 10485760 # 10MB
  timeout_secs: 30

# More aggressive buffering
buffer:
  max_size: 1073741824 # 1GB
```

**Low Latency Requirements:**

```yaml
# Smaller batches, faster delivery
batch:
  max_bytes: 524288 # 512KB
  timeout_secs: 1

# Memory-only buffering
buffer:
  type: "memory"
  max_events: 50000
```

## Troubleshooting

### **🚨 Common Issues**

**High Memory Usage:**

```bash
# Check buffer utilization
kubectl exec -n observability deployment/vector -- \
  curl -s http://localhost:8686/metrics | grep vector_buffer

# Monitor memory metrics
kubectl top pods -n observability -l app.kubernetes.io/name=vector
```

**OpenObserve Connection Issues:**

```bash
# Test connectivity
kubectl exec -n observability deployment/vector -- \
  curl -v http://openobserve.observability.svc.cluster.local:5080/healthz

# Check authentication
kubectl get secret -n observability openobserve-secrets -o yaml
```

**Log Ingestion Problems:**

```bash
# Check Kubernetes logs source
kubectl logs -n observability -l app.kubernetes.io/name=vector | grep kubernetes_logs

# Verify RBAC permissions
kubectl auth can-i get pods --as=system:serviceaccount:observability:vector
kubectl auth can-i get pods/log --as=system:serviceaccount:observability:vector
```

**Buffer Overflow:**

```bash
# Check buffer metrics
curl http://vector-service:8686/metrics | grep buffer

# Monitor disk usage
kubectl exec -n observability deployment/vector -- df -h /vector-data-dir
```

### **🔄 Recovery Procedures**

**Restart Vector:**

```bash
kubectl rollout restart deployment -n observability vector
```

**Clear Buffer (if corrupted):**

```bash
kubectl scale deployment -n observability vector --replicas=0
kubectl delete pvc -n observability -l app.kubernetes.io/name=vector
kubectl scale deployment -n observability vector --replicas=2
```

**Emergency Bypass:**

```bash
# Temporarily disable problematic sink
kubectl patch configmap -n observability vector-config --patch='...'
kubectl rollout restart deployment -n observability vector
```

## Scaling Strategies

### **Horizontal Scaling**

```bash
# Scale Vector replicas
kubectl scale deployment -n observability vector --replicas=4

# Vector automatically load balances
# No additional configuration needed
```

### **Vertical Scaling**

- Increase CPU/memory limits for high-volume environments
- Expand persistent volume size for larger buffers
- Monitor metrics to determine optimal resource allocation

Vector is designed to handle high-throughput scenarios while maintaining low resource usage and high reliability.
