/**
 * Debian cloud image download and management
 */

import * as proxmoxve from "@muhlba91/pulumi-proxmoxve";
import type { IProxmoxConfig } from "../../shared/types";
import { DEBIAN_IMAGE } from "../../shared/constants";

export class DebianCloudImage {
  public readonly resource: proxmoxve.download.File;

  constructor(name: string, config: IProxmoxConfig, provider: proxmoxve.Provider) {
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
        overwrite: false,
      },
      { provider },
    );
  }

  get id() {
    return this.resource.id;
  }
}
