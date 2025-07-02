// TODO: Define proper IVmConfig interface in shared/types.ts
interface IVmConfig {
  cores: number;
  memory: number;
  ip4: string;
  gateway: string;
  storage: string;
  template: string;
}

/**
 * Single Responsibility: Create mock VM configurations for testing
 */
export class MockVmFactory {
  createVmConfig(): IVmConfig {
    return {
      cores: 2,
      memory: 2048,
      ip4: "10.10.0.100",
      gateway: "10.10.0.1",
      storage: "local-lvm",
      template: "debian-12-cloud",
    } as IVmConfig;
  }

  createHighResourceVmConfig(): IVmConfig {
    return {
      cores: 8,
      memory: 16384,
      ip4: "10.10.0.101",
      gateway: "10.10.0.1",
      storage: "nvme-storage",
      template: "debian-12-cloud",
    } as IVmConfig;
  }

  createLowResourceVmConfig(): IVmConfig {
    return {
      cores: 1,
      memory: 1024,
      ip4: "10.10.0.102",
      gateway: "10.10.0.1",
      storage: "local-lvm",
      template: "alpine-cloud",
    } as IVmConfig;
  }

  createCustomVmConfig(vmId: number, ip: string): IVmConfig {
    return {
      cores: 2,
      memory: 2048,
      ip4: ip,
      gateway: "10.10.0.1",
      storage: "local-lvm",
      template: "debian-12-cloud",
    } as IVmConfig;
  }
}
