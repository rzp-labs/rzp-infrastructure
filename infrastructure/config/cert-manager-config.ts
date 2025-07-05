import type { ICertManagerChartValues } from "../shared/types";

export function createCertManagerChartValues(): ICertManagerChartValues {
  return {
    installCRDs: true,
    global: {
      rbac: {
        create: true,
      },
    },
  };
}
