import * as pulumi from "@pulumi/pulumi";
import * as proxmoxve from "@muhlba91/pulumi-proxmoxve";

/* ──────────────────  STACK CONFIG  ────────────────── */

const cfg = new pulumi.Config();

// Proxmox connection settings (secrets automatically masked)
const proxmoxEndpoint = cfg.require("proxmoxEndpoint"); // e.g. "https://pve.dev.lan:8006"
const proxmoxUsername = cfg.requireSecret("proxmoxUsername"); // Automatically encrypted & masked
const proxmoxPassword = cfg.requireSecret("proxmoxPassword"); // Automatically encrypted & masked
const proxmoxInsecure = cfg.getBoolean("proxmoxInsecure") ?? false;

// SSH key from secure config (NEVER hardcode!)
const sshPublicKey = cfg.requireSecret("sshPublicKey"); // Automatically encrypted & masked

// Node & datastore names in your Proxmox cluster
const node = cfg.get("proxmoxNode") ?? "rzp-net";
const isoStore = cfg.get("isoStore") ?? "local";
const vmStore = cfg.get("vmStore") ?? "local-zfs";
const bridge = cfg.get("bridge") ?? "vmbr0";

// Counts & resource sizes
const masterCount = cfg.getNumber("masterCount") ?? 1;
const workerCount = cfg.getNumber("workerCount") ?? 1;
const vmidBase = cfg.getNumber("vmidBase") ?? 120;
const ipHostBase = cfg.getNumber("ipHostBase") ?? 20;

// Network settings
const net4Prefix = cfg.get("net4Prefix") ?? "10.10.0.";
const net6Prefix = cfg.get("net6Prefix") ?? "fd00:10:10::";
const gw4 = cfg.get("gateway4") ?? "10.10.0.1";
const gw6 = cfg.get("gateway6") ?? "fd00:10:10::1";

/* ──────────────────  PROVIDER  ────────────────── */

const provider = new proxmoxve.Provider("proxmoxve", {
  endpoint: proxmoxEndpoint,
  username: proxmoxUsername,
  password: proxmoxPassword,
  insecure: proxmoxInsecure,
});

/* ──────────────────  CLOUD IMAGE  ────────────────── */

const debianImg = new proxmoxve.download.File(
  "debian12Img",
  {
    nodeName: node,
    datastoreId: isoStore,
    contentType: "iso",
    fileName: "debian-12-generic-amd64-20250428-2096.img",
    url: "https://cloud.debian.org/images/cloud/bookworm/20250428-2096/debian-12-generic-amd64-20250428-2096.raw",
    checksumAlgorithm: "sha512",
    checksum:
      "53d34fab622d38b63d0bdc7447d621b6d643415ce20f2cfdfeea06629c0b5401096be4947c09496e3389739eee50ca2f63163ba5971547555df863376f898c7b",
    overwrite: false,
  },
  { provider },
);

/* ──────────────────  CLOUD-INIT SNIPPETS  ────────────────── */

const metaCi = new proxmoxve.storage.File(
  "metaCi",
  {
    nodeName: node,
    datastoreId: isoStore,
    contentType: "snippets",
    sourceRaw: {
      fileName: "k3s-metadata-cloud-init.yaml",
      data: pulumi.interpolate`#cloud-config
local-hostname: ${vmidBase}`,
    },
  },
  { provider },
);

const userCi = new proxmoxve.storage.File(
  "userCi",
  {
    nodeName: node,
    datastoreId: isoStore,
    contentType: "snippets",
    sourceRaw: {
      fileName: "k3s-user-data-cloud-init.yaml",
      data: pulumi.interpolate`#cloud-config
users:
  - name: "admin_ops"
    groups: sudo
    sudo: ALL=(ALL) NOPASSWD:ALL
    shell: /bin/bash
    ssh_authorized_keys:
      - "${sshPublicKey}"

apt:
  sources:
    main.list:
      source: "deb http://deb.debian.org/debian $RELEASE main contrib non-free"
    updates.list:
      source: "deb http://deb.debian.org/debian $RELEASE-updates main contrib non-free"
  preserve_sources_list: true

package_upgrade: true
package_update: true
packages:
  - qemu-guest-agent
  - zfsutils-linux
  - zfs-dkms
  - linux-headers-amd64
  - build-essential
  - curl
  - wget
  - python3
  - python3-pip

write_files:
  - path: /etc/sysctl.d/99-base-vm.conf
    content: |
      vm.swappiness=0
      net.ipv4.ip_forward=1
      net.ipv6.conf.all.forwarding=1
      fs.inotify.max_user_watches=1048576
      fs.inotify.max_user_instances=512

runcmd:
  - [ systemctl, enable, --now, qemu-guest-agent ]
  - [ sysctl, -p, /etc/sysctl.d/99-base-vm.conf ]
  - [ swapoff, -a ]
  - [ sed, -i, '/ swap / s/^/#/', /etc/fstab ]
  - [ systemctl, enable, --now, systemd-resolved ]
  - [ rm, -f, /etc/resolv.conf ]
  - [ ln, -sf, /run/systemd/resolve/stub-resolv.conf, /etc/resolv.conf ]
  - [ sh, -c, "systemctl disable --now ufw || true" ]
`,
    },
  },
  { provider },
);

/* ──────────────────  HELPER TO BUILD A VM  ────────────────── */

function createVm(idx: number, name: string) {
  const ip4 = `${net4Prefix}${ipHostBase + idx}`;
  const ip6 = `${net6Prefix}${ipHostBase + idx}`;
  return new proxmoxve.vm.VirtualMachine(
    name,
    {
      nodeName: node,
      vmId: vmidBase + idx,
      started: true,
      onBoot: true,
      tags: ["stg", "k3s", name.includes("master") ? "master" : "worker"],
      description: `K3s ${name.includes("master") ? "Master" : "Worker"} Node`,
      machine: "q35",
      bios: "seabios",
      scsiHardware: "virtio-scsi-single",
      tabletDevice: false,
      bootOrders: ["scsi0", "ide2"],
      startup: {
        order: name.includes("master") ? 1 : 2,
        upDelay: name.includes("master") ? 30 : 10,
      },
      operatingSystem: { type: "l26" },
      agent: { enabled: true, trim: true, type: "virtio", timeout: "15m" },
      cpu: { type: "host", cores: 2 },
      memory: { dedicated: 2048 },
      disks: [
        {
          datastoreId: vmStore,
          interface: "scsi0",
          size: 20,
          ssd: true,
          cache: "writeback",
          discard: "on",
          fileFormat: "raw",
          fileId: debianImg.id,
          aio: "io_uring",
        },
        {
          datastoreId: vmStore,
          interface: "scsi1",
          size: 60,
          ssd: true,
          cache: "writeback",
          discard: "on",
        },
      ],
      networkDevices: [{ bridge, model: "virtio" }],
      initialization: {
        datastoreId: vmStore,
        interface: "ide2",
        userDataFileId: userCi.id,
        metaDataFileId: metaCi.id,
        dns: { servers: ["1.1.1.1"], domain: "local" },
        ipConfigs: [
          {
            ipv4: { address: `${ip4}/24`, gateway: gw4 },
            ipv6: { address: `${ip6}/64`, gateway: gw6 },
          },
        ],
      },
    },
    { provider },
  );
}

/* ──────────────────  CREATE MASTERS & WORKERS  ────────────────── */

const masters = Array.from({ length: masterCount }, (_, i) =>
  createVm(i, masterCount > 1 && i > 0 ? `stg-k3s-node-master-${i + 1}` : "stg-k3s-node-master"),
);

const workers = Array.from({ length: workerCount }, (_, i) =>
  createVm(masterCount + i, `stg-k3s-node-worker-${i + 1}`),
);

/* ──────────────────  OUTPUTS  ────────────────── */

export const masterIps = masters.reduce(
  (o, _, i) => {
    const vmName = masterCount > 1 && i > 0 ? `stg-k3s-node-master-${i + 1}` : "stg-k3s-node-master";
    o[vmName] = `${net4Prefix}${ipHostBase + i}`;
    return o;
  },
  {} as Record<string, string>,
);

export const workerIps = workers.reduce(
  (o, _, i) => {
    const vmName = `stg-k3s-node-worker-${i + 1}`;
    o[vmName] = `${net4Prefix}${ipHostBase + masterCount + i}`;
    return o;
  },
  {} as Record<string, string>,
);

export const allNodes = {
  masters: masters.map((_, i) => ({
    name: masterCount > 1 && i > 0 ? `stg-k3s-node-master-${i + 1}` : "stg-k3s-node-master",
    ip: `${net4Prefix}${ipHostBase + i}`,
    ipv6: `${net6Prefix}${ipHostBase + i}`,
    cores: 2,
    memory: 2048,
    osDisk: 20,
    dataDisk: 60,
  })),
  workers: workers.map((_, i) => ({
    name: `stg-k3s-node-worker-${i + 1}`,
    ip: `${net4Prefix}${ipHostBase + masterCount + i}`,
    ipv6: `${net6Prefix}${ipHostBase + masterCount + i}`,
    cores: 2,
    memory: 2048,
    osDisk: 20,
    dataDisk: 60,
  })),
};