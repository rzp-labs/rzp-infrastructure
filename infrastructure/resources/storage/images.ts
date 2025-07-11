/**
 * Debian cloud image download and management
 *
 * This component handles downloading Debian cloud images for VM creation.
 * It automatically skips download if the image already exists on the Proxmox node.
 *
 * The image file is retained on deletion (retainOnDelete: true) to avoid
 * re-downloading on subsequent deployments, as cloud images are typically large
 * and don't change frequently. The actual file remains on Proxmox storage.
 */

import * as proxmoxve from "@muhlba91/pulumi-proxmoxve";

import { DEBIAN_IMAGE } from "../../shared/constants";
import type { IProxmoxConfig } from "../../shared/types";

export class DebianCloudImage {
  public readonly resource: proxmoxve.download.File;

  constructor(name: string, config: IProxmoxConfig, provider: proxmoxve.Provider) {
    // The proxmoxve.download.File resource automatically checks if the file exists
    // and skips download when overwrite: false. This provides the desired behavior
    // of only downloading if the image doesn't already exist.
    this.resource = new proxmoxve.download.File(
      name,
      {
        nodeName: config.node,
        datastoreId: config.isoStore,
        contentType: "iso",
        fileName: DEBIAN_IMAGE.FILE_NAME,
        url: DEBIAN_IMAGE.URL,
        checksumAlgorithm: DEBIAN_IMAGE.CHECKSUM_ALGORITHM,
        checksum: DEBIAN_IMAGE.CHECKSUM,
        overwrite: false, // Skip download if file already exists
      },
      {
        provider,
        retainOnDelete: true, // Keep the image file when destroying the stack
      },
    );
  }

  get id() {
    return this.resource.id;
  }
}
