/**
 * Staging environment deployment with proper provider architecture
 */
import * as proxmoxve from "@muhlba91/pulumi-proxmoxve";
import * as command from "@pulumi/command";
// import * as k8s from "@pulumi/kubernetes";

import * as Components from "../../components";
import { getStagingConfig } from "../../config/staging";
import type { IK3sNodeConfig } from "../../shared/types";
import { getVmRole } from "../../shared/utils";

// Get staging configuration
const config = getStagingConfig();

export const proxmoxProvider = new proxmoxve.Provider("proxmox", {
  endpoint: config.proxmox.endpoint,
  username: config.proxmox.username,
  password: config.proxmox.password,
  insecure: config.proxmox.insecure,
  ssh: config.proxmox.ssh,
});

// // Get Cloudflare configuration directly
// const cloudflareConfig = new pulumi.Config("cloudflare");

// const domain = cloudflareConfig.require("domain");
// const email = cloudflareConfig.require("email");
// const apiToken = cloudflareConfig.requireSecret("apiToken");

// // Get Longhorn configuration
// const projectConfig = new pulumi.Config("rzp-infra");
// const longhornPassword = projectConfig.requireSecret("longhornPassword");

// // Get Infisical configuration
// const infisicalDbPassword = projectConfig.requireSecret("infisical-db-password");
// const infisicalRedisPassword = projectConfig.requireSecret("infisical-redis-password");
// const infisicalAuthSecret = projectConfig.requireSecret("infisical-auth-secret");
// const infisicalEncryptionKey = projectConfig.requireSecret("infisical-encryption-key");
// const infisicalAdminPassword = projectConfig.requireSecret("infisical-admin-password");

// =============================================================================
// INFRASTRUCTURE DEPLOYMENT
// =============================================================================

// Deploy K3s cluster infrastructure (VMs only)
export const cluster = new Components.K3sCluster(
  "stg-k3s",
  {
    config,
  },
  { provider: proxmoxProvider },
);

// Install K3s masters with dynamic addition pattern
// First master (always present, creates the cluster)
export const firstMaster = new Components.K3sMaster(
  "stg-k3s-master",
  {
    node: cluster.masters[0].config,
    sshUsername: config.proxmox.ssh!.username!,
    sshPrivateKey: config.proxmox.ssh!.privateKey!,
    isFirstMaster: true,
  },
  {
    parent: cluster.masters[0], // Make K3sMaster a child of its VM
  },
);

// Retrieve K3s credentials
export const credentials = new Components.K3sCredentials(
  "k3s-credentials",
  {
    masterNode: cluster.masters[0].config,
    sshUsername: config.proxmox.ssh!.username!,
    sshPrivateKey: config.proxmox.ssh!.privateKey!,
  },
  {
    parent: cluster.masters[0], // Make credentials a child of the first master VM
    dependsOn: [firstMaster],
  },
);

// Additional masters (only when masterCount > 1)
export const additionalMasters = cluster.masters.slice(1).map(
  (master, index) =>
    new Components.K3sMaster(
      `stg-k3s-master-${index + 1}`,
      {
        node: master.config,
        sshUsername: config.proxmox.ssh!.username!,
        sshPrivateKey: config.proxmox.ssh!.privateKey!,
        isFirstMaster: false,
        serverEndpoint: `https://${cluster.masters[0].config.ip4}:6443`,
        token: credentials.result.token,
      },
      {
        parent: master, // Make K3sMaster a child of its VM
        dependsOn: [firstMaster, credentials],
      },
    ),
);

// All masters for dependency management
export const allMasters = [firstMaster, ...additionalMasters];

// Install K3s workers
export const workerInstalls = cluster.workers.map(
  (worker, index) =>
    new Components.K3sWorker(
      `stg-k3s-worker-${index}`,
      {
        node: worker.config,
        sshUsername: config.proxmox.ssh!.username!,
        sshPrivateKey: config.proxmox.ssh!.privateKey!,
        token: credentials.result.token,
        masterEndpoint: cluster.masters[0].config.ip4,
      },
      {
        parent: worker, // Make K3sWorker a child of its VM
        dependsOn: [credentials],
      },
    ),
);

// // Kubernetes provider for all K8s resources (created after components are ready)
// const stagingK8sProvider = new k8s.Provider(
//   "stg-k8s-provider",
//   { kubeconfig: credentials.result.kubeconfig },
//   {
//     dependsOn: [firstMaster.k3sHealthCheck, ...additionalMasters.map((m) => m.k3sHealthCheck), ...workerInstalls],
//   },
// );

// // =============================================================================
// // BOOTSTRAP PHASE: ArgoCD Deployment
// // =============================================================================
// After K3s cluster is ready, bootstrap ArgoCD
export const argoCdBootstrap = new command.remote.Command(
  "argocd-bootstrap",
  {
    connection: {
      host: cluster.masters[0].config.ip4,
      user: config.proxmox.ssh!.username!,
      privateKey: config.proxmox.ssh!.privateKey!,
    },
    create: `
      # Add ArgoCD Helm repository
      helm repo add argo https://argoproj.github.io/argo-helm
      helm repo update

      # Add Infisical Helm repository
      helm repo add infisical-helm https://dl.cloudsmith.io/public/infisical/helm-charts/helm/charts/
      helm repo update

      # Install Infisical Secrets Operator first
      helm install infisical-secrets-operator infisical-helm/infisical-secrets-operator \
        --namespace infisical-secrets-system \
        --create-namespace \
        --values - <<INFISICAL_VALUES
installCRDs: true
controllerManager:
  replicas: 1
  resources:
    requests:
      cpu: 100m
      memory: 128Mi
    limits:
      cpu: 200m
      memory: 256Mi
INFISICAL_VALUES

      # Wait for Infisical Operator to be ready
      kubectl wait --for=condition=available --timeout=300s deployment/infisical-secrets-operator-controller-manager -n infisical-secrets-system

      # Create Infisical Cloud authentication secret (bootstrap credentials)
      kubectl create secret generic infisical-cloud-universal-auth \
        --namespace infisical-secrets-system \
        --from-literal=clientId="\${INFISICAL_CLOUD_CLIENT_ID}" \
        --from-literal=clientSecret="\${INFISICAL_CLOUD_CLIENT_SECRET}" \
        --dry-run=client -o yaml | kubectl apply -f -

      # Install ArgoCD
      helm install argocd argo/argo-cd \
        --namespace argocd \
        --create-namespace \
        --values - <<HELM_VALUES
server:
  service:
    type: ClusterIP
  extraArgs:
    - --insecure
  config:
    repositories: \|
      - url: https://github.com/rzp-labs/rzp-infrastructure.git
        name: rzp-infrastructure
        type: git
HELM_VALUES

      # Wait for ArgoCD to be ready
      kubectl wait --for=condition=available --timeout=300s deployment/argocd-server -n argocd

      # Apply root app-of-apps with server-side apply
      kubectl apply --server-side -f - <<EOF
apiVersion: argoproj.io/v1alpha1
kind: Application
metadata:
  name: platform-core
  namespace: argocd
spec:
  source:
    repoURL: https://github.com/rzp-labs/rzp-infrastructure.git
    path: kubernetes/core
    targetRevision: main
  destination:
    server: https://kubernetes.default.svc
  syncPolicy:
    automated:
      prune: true
      selfHeal: true
EOF
    `,
  },
  {
    dependsOn: [firstMaster, ...additionalMasters, ...workerInstalls], // Wait for K3s installation to complete
  },
);
// // =============================================================================
// // BOOTSTRAP PHASE: Direct Pulumi Deployment
// // =============================================================================

// // 1. Deploy MetalLB for LoadBalancer support
// export const metallbBootstrap = new Components.MetalLBComponent(
//   "metallb",
//   {
//     namespace: "stg-metallb",
//     chartVersion: "0.15.2",
//     environment: "stg",
//     ipRange: "10.10.0.200-10.10.0.201",
//   },
//   {
//     dependsOn: workerInstalls,
//     provider: stagingK8sProvider,
//   },
// );

// // 2. Deploy cert-manager for TLS certificates
// export const certManagerBootstrap = new Components.CertManagerComponent(
//   "cert-manager",
//   {
//     namespace: "stg-cert-manager",
//     chartVersion: "v1.16.1",
//     environment: "stg",
//     cloudflareApiToken: apiToken,
//     email: email,
//   },
//   {
//     provider: stagingK8sProvider,
//   },
// );

// // 3. Deploy Traefik ingress controller first (provides CRDs for Longhorn middlewares)
// export const traefikBootstrap = new Components.TraefikComponent(
//   "traefik",
//   {
//     namespace: "stg-traefik",
//     chartVersion: "36.3.0",
//     environment: "stg",
//     httpsPort: 443,
//   },
//   {
//     dependsOn: [certManagerBootstrap],
//     provider: stagingK8sProvider,
//   },
// );

// // 4. Deploy Longhorn for distributed storage (can now create Traefik middlewares)
// export const longhornBootstrap = new Components.LonghornComponent(
//   "longhorn",
//   {
//     namespace: "stg-longhorn",
//     chartVersion: "1.7.2",
//     environment: "stg",
//     domain: `longhorn.stg.${domain}`,
//     defaultStorageClass: true,
//     replicaCount: 2,
//     adminPassword: longhornPassword,
//     enableUninstallerRbac: true,
//     uninstallerTimeoutSeconds: 900,
//     validatePrerequisites: true,
//     enableDeploymentMonitoring: false,
//     deploymentTimeoutSeconds: 2400,
//     maxRetries: 5,
//     enableStatusTracking: false,
//     // Enable disk provisioning automation
//     enableDiskProvisioning: true,
//     diskPath: "/var/lib/longhorn",
//     storageReservedGb: 6,
//     diskProvisioningTimeoutSeconds: 600,
//     diskProvisioningRetryAttempts: 3,
//     // Enable volume cleanup automation for staging
//     enableVolumeCleanup: true,
//     volumeCleanupIntervalMinutes: 15, // Clean up every 15 minutes in staging
//     maxVolumeAgeHours: 1, // Clean up volumes older than 1 hour
//   },
//   {
//     dependsOn: [traefikBootstrap], // Now depends on Traefik for CRDs
//     provider: stagingK8sProvider,
//   },
// );

// // 5. Deploy ArgoCD for GitOps
// export const argoCd = new Components.ArgoCdComponent(
//   "argocd",
//   {
//     namespace: "stg-argocd",
//     chartVersion: "5.51.6",
//     environment: "stg",
//     domain: `argocd.stg.${domain}`,
//   },
//   {
//     dependsOn: [longhornBootstrap],
//     provider: stagingK8sProvider,
//   },
// );

// // 7. Deploy Infisical for secrets management
// export const infisicalBootstrap = new Components.InfisicalComponent(
//   "infisical",
//   {
//     namespace: "stg-infisical",
//     environment: "stg",
//     domain: `infisical.stg.${domain}`,
//     postgresqlChartVersion: "15.5.32",
//     redisChartVersion: "19.6.4",
//     databaseConfig: {
//       // storageSize will be automatically set to 2Gi for staging environment
//       username: "infisical",
//       password: infisicalDbPassword,
//       database: "infisical",
//     },
//     redisConfig: {
//       // storageSize will be automatically set to 512Mi for staging environment
//       password: infisicalRedisPassword,
//     },
//     infisicalConfig: {
//       authSecret: infisicalAuthSecret,
//       encryptionKey: infisicalEncryptionKey,
//       adminEmail: "admin@homelab.local",
//       adminPassword: infisicalAdminPassword,
//       siteUrl: `https://infisical.stg.${domain}`,
//     },
//   },
//   {
//     dependsOn: [traefikBootstrap, longhornBootstrap, certManagerBootstrap],
//     provider: stagingK8sProvider,
//   },
// );

// =============================================================================
// EXPORTS
// =============================================================================

export const masterIps = cluster.masterIps;
export const workerIps = cluster.workerIps;
export const allNodes = cluster.allNodes;
export const kubeconfig = credentials.result.kubeconfig;
// export const argoCdUrl = argoCd.ingress.spec.rules[0].host.apply((host) => `https://${host}`);

// // Enhanced Longhorn exports for staging environment monitoring
// export const longhornUrl = longhornBootstrap.ingress.spec.rules[0].host.apply((host) => `https://${host}`);
// export const longhornUninstallerRbac = longhornBootstrap.uninstallerRbac;
// // These may be undefined when validatePrerequisites=false and enableDeploymentMonitoring=false
// export const longhornPrerequisiteValidation = longhornBootstrap.prerequisiteValidation;
// export const longhornDeploymentStatus = longhornBootstrap.statusConfigMap;
// export const longhornHelmValues = longhornBootstrap.helmValuesOutput;

// // Infisical exports for secrets management
// export const infisicalUrl = infisicalBootstrap.ingress.spec.rules[0].host.apply((host) => `https://${host}`);
// export const infisicalNamespace = infisicalBootstrap.namespace.metadata.name;
// export const infisicalServiceAccount = infisicalBootstrap.serviceAccount.metadata.name;
// export const infisicalHelmValues = infisicalBootstrap.helmValuesOutput;

// Utility function for role determination
export const getVmRoleFromId = (vmId: number): IK3sNodeConfig["role"] => {
  const role = getVmRole(vmId, config.k3s.masterVmidStart, config.k3s.workerVmidStart);
  if (role === null) {
    throw new Error(`VM ${vmId} is not a managed K3s node`);
  }
  return role;
};
