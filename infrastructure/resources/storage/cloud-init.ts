/**
 * Cloud-init configuration helper
 */

/**
 * Generate user configuration section
 */
function getUserConfig(sshPublicKey: string): string {
  return `users:
  - name: "admin_ops"
    groups: sudo
    sudo: ALL=(ALL) NOPASSWD:ALL
    shell: /bin/bash
    ssh_authorized_keys:
      - "${sshPublicKey}"`;
}

/**
 * Generate APT sources configuration
 */
function getAptSources(): string {
  return `apt:
  sources:
    main.list:
      source: "deb http://deb.debian.org/debian $RELEASE main contrib non-free"
    updates.list:
      source: "deb http://deb.debian.org/debian $RELEASE-updates main contrib non-free"
  preserve_sources_list: true`;
}

/**
 * Generate package installation configuration
 */
function getPackages(): string {
  return `package_upgrade: true
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
  # Longhorn storage prerequisites
  - open-iscsi
  - nfs-common
  - util-linux`;
}

/**
 * Generate system configuration files
 */
/**
 * Generate sysctl configuration for Kubernetes
 */
function getSysctlConfig(): string {
  return `      # Basic VM settings
      vm.swappiness=0
      fs.inotify.max_user_watches=1048576
      fs.inotify.max_user_instances=512

      # Kubernetes networking requirements
      net.ipv4.ip_forward=1
      net.ipv6.conf.all.forwarding=1
      net.bridge.bridge-nf-call-iptables=1
      net.bridge.bridge-nf-call-ip6tables=1
      net.netfilter.nf_conntrack_max=131072`;
}

/**
 * Generate kernel modules for Kubernetes
 */
function getKernelModules(): string {
  return `      br_netfilter
      overlay
      ip_vs
      ip_vs_rr
      ip_vs_wrr
      ip_vs_sh
      nf_conntrack`;
}

function getSystemFiles(): string {
  return `write_files:
  - path: /etc/sysctl.d/99-kubernetes.conf
    content: |
${getSysctlConfig()}

  - path: /etc/modules-load.d/kubernetes.conf
    content: |
${getKernelModules()}`;
}

/**
 * Generate runtime commands section
 */
/**
 * Generate system service commands
 */
function getSystemServiceCommands(): string {
  return `  # System services
  - [ systemctl, enable, --now, qemu-guest-agent ]
  - [ systemctl, enable, --now, systemd-resolved ]
  # Longhorn storage prerequisites
  - [ systemctl, enable, --now, iscsid ]
  - [ systemctl, enable, --now, open-iscsi ]`;
}

/**
 * Generate kernel module loading commands
 */
function getKernelModuleCommands(): string {
  return `
  # Load Kubernetes kernel modules immediately
  - [ modprobe, br_netfilter ]
  - [ modprobe, overlay ]
  - [ modprobe, ip_vs ]
  - [ modprobe, ip_vs_rr ]
  - [ modprobe, ip_vs_wrr ]
  - [ modprobe, ip_vs_sh ]
  - [ modprobe, nf_conntrack ]`;
}

/**
 * Generate networking configuration commands
 */
function getNetworkingCommands(): string {
  return `
  # Apply Kubernetes networking sysctl settings
  - [ sysctl, -p, /etc/sysctl.d/99-kubernetes.conf ]`;
}

/**
 * Generate swap disable commands
 */
function getSwapDisableCommands(): string {
  return `
  # Disable swap for Kubernetes
  - [ swapoff, -a ]
  - [ sed, -i, '/ swap / s/^/#/', /etc/fstab ]`;
}

/**
 * Generate DNS configuration commands
 */
function getDnsCommands(): string {
  return `
  # Configure DNS resolution
  - [ rm, -f, /etc/resolv.conf ]
  - [ ln, -sf, /run/systemd/resolve/stub-resolv.conf, /etc/resolv.conf ]`;
}

/**
 * Generate firewall configuration commands
 */
function getFirewallCommands(): string {
  return `
  # Disable local firewall (router firewall handles perimeter security)
  - [ sh, -c, "systemctl disable --now ufw || true" ]`;
}

/**
 * Generate disk setup configuration for the 60GB data disk
 */
function getDiskSetup(): string {
  return `disk_setup:
  /dev/sdb:
    table_type: gpt
    layout: true
    overwrite: true

fs_setup:
  - label: longhorn-data
    filesystem: ext4
    device: /dev/sdb1
    overwrite: true

mounts:
  - [ "/dev/sdb1", "/var/lib/longhorn", "ext4", "defaults,noatime", "0", "2" ]

bootcmd:
  # Create longhorn directory with proper permissions
  - [ mkdir, -p, /var/lib/longhorn ]
  - [ chown, -R, root:root, /var/lib/longhorn ]
  - [ chmod, 755, /var/lib/longhorn ]`;
}

/**
 * Generate data disk validation and mounting commands
 */
function getRunCommands(): string {
  return `runcmd:
${getSystemServiceCommands()}
${getKernelModuleCommands()}
${getNetworkingCommands()}
${getSwapDisableCommands()}
${getDnsCommands()}
${getFirewallCommands()}
${getDataDiskCommands()}`;
}

/**
 * Generate cloud-init configuration with full system setup
 * Used for vendorData files in the hybrid inline approach
 */
export function getInlineCloudInitConfig(sshPublicKey: string): string {
  return `#cloud-config
${getUserConfig(sshPublicKey)}

${getAptSources()}

${getPackages()}

${getDiskSetup()}

${getSystemFiles()}

${getRunCommands()}
`;
}

/**
 * Generate data disk validation and mounting commands
 */
function getDataDiskCommands(): string {
  return `
  # Verify data disk is properly mounted and accessible
  - [ sh, -c, "mount | grep -q '/var/lib/longhorn' || (echo 'ERROR: Data disk not mounted' && exit 1)" ]
  - [ sh, -c, "df -h /var/lib/longhorn | grep -q 'sdb1' || (echo 'ERROR: Data disk not accessible' && exit 1)" ]
  - [ sh, -c, "test -d /var/lib/longhorn && echo 'SUCCESS: Longhorn data directory ready'" ]`;
}
