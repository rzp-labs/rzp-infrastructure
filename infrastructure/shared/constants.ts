/**
 * Shared constants for the infrastructure project
 */

export const VM_ID_RANGES = {
  TEMPLATES: { START: 9000, END: 9099 },
  MASTERS: { OFFSET: 0, SIZE: 10 },
  WORKERS: { OFFSET: 10, SIZE: 10 },
} as const;

export const DEFAULT_VM_RESOURCES = {
  CORES: 2,
  MEMORY: 2048,
  OS_DISK_SIZE: 20,
  DATA_DISK_SIZE: 60,
} as const;

export const DEBIAN_IMAGE = {
  FILE_NAME: "debian-12-generic-amd64-20250428-2096.img",
  URL: "https://cloud.debian.org/images/cloud/bookworm/20250428-2096/debian-12-generic-amd64-20250428-2096.raw",
  CHECKSUM:
    "53d34fab622d38b63d0bdc7447d621b6d643415ce20f2cfdfeea06629c0b5401096be4947c09496e3389739eee50ca2f63163ba5971547555df863376f898c7b",
  CHECKSUM_ALGORITHM: "sha512",
} as const;

export const CLOUD_INIT = {
  METADATA_FILE: "k3s-metadata-cloud-init.yaml",
  USERDATA_FILE: "k3s-user-data-cloud-init.yaml",
} as const;

export const VM_DEFAULTS = {
  MACHINE: "q35",
  BIOS: "seabios",
  SCSI_HARDWARE: "virtio-scsi-single",
  BOOT_ORDERS: ["scsi0", "ide2"],
  OS_TYPE: "l26",
  DISK_CACHE: "writeback",
  DISK_DISCARD: "on",
  DISK_AIO: "io_uring",
  NETWORK_MODEL: "virtio",
} as const;

export const K3S_INSTALLATION = {
  DOWNLOAD_URL: "https://get.k3s.io",
  SERVER_FLAGS: "--cluster-init --disable traefik --disable servicelb --disable local-storage",
  ADDITIONAL_SERVER_FLAGS: "--disable traefik --disable servicelb --disable local-storage",
  TOKEN_FILE_PATH: "/var/lib/rancher/k3s/server/node-token",
  KUBECONFIG_PATH: "/etc/rancher/k3s/k3s.yaml",
  SERVER_PORT: "6443",
  UNINSTALL_SERVER_CMD: "sudo systemctl stop k3s && sudo /usr/local/bin/k3s-uninstall.sh",
  UNINSTALL_AGENT_CMD: "sudo systemctl stop k3s-agent && sudo /usr/local/bin/k3s-agent-uninstall.sh",
  LOCALHOST_IP: "127.0.0.1",
} as const;

// ArgoCD Constants
export const ARGOCD_DEFAULTS = {
  CHART_NAME: "argo-cd",
  CHART_REPO: "https://argoproj.github.io/argo-helm",
  CHART_VERSION: "5.51.6", // Keep current stable version
  NAMESPACE: "argocd",
  DEFAULT_DOMAIN: "argocd.local",
  SERVICE_TYPE: "ClusterIP",
} as const;

// Traefik Constants
export const TRAEFIK_DEFAULTS = {
  CHART_NAME: "traefik",
  CHART_REPO: "https://traefik.github.io/charts",
  CHART_VERSION: "28.3.0", // Keep current stable version
  NAMESPACE: "traefik-system",
  REPLICAS: 1,
  SERVICE_TYPE: "LoadBalancer",
  WEB_PORT: 8000,
  WEBSECURE_PORT: 8443,
  DASHBOARD_PORT: 9000,
} as const;

// MetalLB Constants
export const METALLB_DEFAULTS = {
  CHART_NAME: "metallb",
  CHART_REPO: "https://metallb.github.io/metallb",
  CHART_VERSION: "0.15.2", // Updated from 0.14.8 to latest stable
  NAMESPACE: "metallb-system",
  // IP range allocation: 200-205 staging, 206-210 production
  STAGING_IP_RANGE: "10.10.0.200-10.10.0.205",
  PRODUCTION_IP_RANGE: "10.10.0.206-10.10.0.210",
} as const;

// cert-manager Constants
export const CERT_MANAGER_DEFAULTS = {
  CHART_NAME: "cert-manager",
  CHART_REPO: "https://charts.jetstack.io",
  CHART_VERSION: "v1.18.2", // Updated from v1.15.3 to latest stable
  NAMESPACE: "cert-manager",
} as const;

// Let's Encrypt Constants
export const LETSENCRYPT = {
  PROD_SERVER: "https://acme-v02.api.letsencrypt.org/directory",
  STAGING_SERVER: "https://acme-staging-v02.api.letsencrypt.org/directory",
} as const;
