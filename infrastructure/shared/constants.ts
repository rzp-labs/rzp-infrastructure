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
