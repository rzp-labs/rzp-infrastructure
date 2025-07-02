import { execSync } from "child_process";
import { writeFileSync } from "fs";
import { join } from "path";

/**
 * Helper to extract kubeconfig from Pulumi outputs for testing
 */
export class KubeconfigExtractor {
  private static readonly CONFIG_PATH = join(process.cwd(), ".test-kubeconfig");

  /**
   * Extract kubeconfig from Pulumi stack output
   */
  static async extractKubeconfig(): Promise<string> {
    try {
      // Extract kubeconfig from Pulumi stack
      const kubeconfigYaml = execSync("pulumi stack output kubeconfig --show-secrets", {
        cwd: join(__dirname, "../../"),
        encoding: "utf-8",
      });

      // Write to temporary file for kubectl/K8s client
      writeFileSync(this.CONFIG_PATH, kubeconfigYaml);

      return this.CONFIG_PATH;
    } catch (_error) {
      void _error; // Error not needed
      throw new Error(`Failed to extract kubeconfig: ${_error}`);
    }
  }

  /**
   * Get cluster endpoint from Pulumi outputs
   */
  static async getClusterEndpoint(): Promise<string> {
    try {
      const masterIps = execSync("pulumi stack output masterIps --json", {
        cwd: join(__dirname, "../../"),
        encoding: "utf-8",
      });

      const ips = JSON.parse(masterIps) as Record<string, string>;
      const masterIp = Object.values(ips)[0] as string;

      return `https://${masterIp}:6443`;
    } catch (_error) {
      void _error; // Error not needed
      throw new Error(`Failed to get cluster endpoint: ${_error}`);
    }
  }

  /**
   * Verify cluster connectivity before running tests
   */
  static async verifyConnectivity(): Promise<boolean> {
    try {
      const configPath = await this.extractKubeconfig();

      execSync(`kubectl --kubeconfig=${configPath} cluster-info`, {
        stdio: "pipe",
      });

      return true;
    } catch (_error) {
      void _error; // Error not needed
      // Cluster connectivity check failed
      return false;
    }
  }

  /**
   * Clean up temporary kubeconfig file
   */
  static cleanup(): void {
    try {
      // eslint-disable-next-line @typescript-eslint/consistent-type-imports
      const fs = require("fs") as typeof import("fs");
      if (fs.existsSync(this.CONFIG_PATH)) {
        fs.unlinkSync(this.CONFIG_PATH);
      }
    } catch (_error) {
      void _error; // Error not needed
      // Failed to cleanup kubeconfig file
    }
  }
}
