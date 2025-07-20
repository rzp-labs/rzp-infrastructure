import { getInlineCloudInitConfig } from "../../../resources/storage/cloud-init";

describe("Cloud-init Configuration", () => {
  const testSshKey = "ssh-rsa AAAAB3NzaC1yc2EAAAADAQABAAABgQC... test@example.com";

  describe("getInlineCloudInitConfig", () => {
    it("should generate complete cloud-init configuration", () => {
      const config = getInlineCloudInitConfig(testSshKey);

      expect(config).toContain("#cloud-config");
      expect(config).toContain("users:");
      expect(config).toContain("admin_ops");
      expect(config).toContain(testSshKey);
    });

    it("should include disk setup configuration", () => {
      const config = getInlineCloudInitConfig(testSshKey);

      // Verify disk setup section
      expect(config).toContain("disk_setup:");
      expect(config).toContain("/dev/sdb:");
      expect(config).toContain("table_type: gpt");
      expect(config).toContain("overwrite: true");
    });

    it("should include filesystem setup", () => {
      const config = getInlineCloudInitConfig(testSshKey);

      // Verify filesystem setup
      expect(config).toContain("fs_setup:");
      expect(config).toContain("label: longhorn-data");
      expect(config).toContain("filesystem: ext4");
      expect(config).toContain("device: /dev/sdb1");
    });

    it("should include mount configuration", () => {
      const config = getInlineCloudInitConfig(testSshKey);

      // Verify mount configuration
      expect(config).toContain("mounts:");
      expect(config).toContain("/dev/sdb1");
      expect(config).toContain("/var/lib/longhorn");
      expect(config).toContain("ext4");
      expect(config).toContain("defaults,noatime");
    });

    it("should include bootcmd for directory creation", () => {
      const config = getInlineCloudInitConfig(testSshKey);

      // Verify bootcmd section
      expect(config).toContain("bootcmd:");
      expect(config).toContain("mkdir, -p, /var/lib/longhorn");
      expect(config).toContain("chown, -R, root:root, /var/lib/longhorn");
      expect(config).toContain("chmod, 755, /var/lib/longhorn");
    });

    it("should include data disk validation commands", () => {
      const config = getInlineCloudInitConfig(testSshKey);

      // Verify data disk validation
      expect(config).toContain("mount | grep -q '/var/lib/longhorn'");
      expect(config).toContain("df -h /var/lib/longhorn | grep -q 'sdb1'");
      expect(config).toContain("SUCCESS: Longhorn data directory ready");
    });

    it("should include required packages for storage", () => {
      const config = getInlineCloudInitConfig(testSshKey);

      // Verify storage-related packages
      expect(config).toContain("packages:");
      expect(config).toContain("- zfsutils-linux");
      expect(config).toContain("- zfs-dkms");
      expect(config).toContain("- linux-headers-amd64");
    });

    it("should include kernel modules for Kubernetes", () => {
      const config = getInlineCloudInitConfig(testSshKey);

      // Verify kernel modules
      expect(config).toContain("br_netfilter");
      expect(config).toContain("overlay");
      expect(config).toContain("ip_vs");
      expect(config).toContain("nf_conntrack");
    });

    it("should include system configuration files", () => {
      const config = getInlineCloudInitConfig(testSshKey);

      // Verify system files
      expect(config).toContain("write_files:");
      expect(config).toContain("/etc/sysctl.d/99-kubernetes.conf");
      expect(config).toContain("/etc/modules-load.d/kubernetes.conf");
    });

    it("should include runtime commands", () => {
      const config = getInlineCloudInitConfig(testSshKey);

      // Verify runtime commands
      expect(config).toContain("runcmd:");
      expect(config).toContain("systemctl, enable, --now, qemu-guest-agent");
      expect(config).toContain("modprobe, br_netfilter");
      expect(config).toContain("swapoff, -a");
    });
  });
});
