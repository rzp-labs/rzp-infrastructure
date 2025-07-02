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
  - python3-pip`;
}

/**
 * Generate system configuration files
 */
function getSystemFiles(): string {
  return `write_files:
  - path: /etc/sysctl.d/99-base-vm.conf
    content: |
      vm.swappiness=0
      net.ipv4.ip_forward=1
      net.ipv6.conf.all.forwarding=1
      fs.inotify.max_user_watches=1048576
      fs.inotify.max_user_instances=512`;
}

/**
 * Generate runtime commands section
 */
function getRunCommands(): string {
  return `runcmd:
  - [ systemctl, enable, --now, qemu-guest-agent ]
  - [ sysctl, -p, /etc/sysctl.d/99-base-vm.conf ]
  - [ swapoff, -a ]
  - [ sed, -i, '/ swap / s/^/#/', /etc/fstab ]
  - [ systemctl, enable, --now, systemd-resolved ]
  - [ rm, -f, /etc/resolv.conf ]
  - [ ln, -sf, /run/systemd/resolve/stub-resolv.conf, /etc/resolv.conf ]
  - [ sh, -c, "systemctl disable --now ufw || true" ]`;
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

${getSystemFiles()}

${getRunCommands()}
`;
}
