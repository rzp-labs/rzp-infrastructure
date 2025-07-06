import { TRAEFIK_DEFAULTS } from "../shared/constants";
import type { ITraefikChartValues } from "../shared/types";

export function createTraefikChartValues(): ITraefikChartValues {
  return {
    deployment: { replicas: TRAEFIK_DEFAULTS.REPLICAS },
    service: { type: TRAEFIK_DEFAULTS.SERVICE_TYPE },
    ports: createPortsConfig(),
    ingressRoute: createIngressRouteConfig(),
    certificatesResolvers: createCertificateResolvers(),
    globalArguments: ["--global.checknewversion=false", "--global.sendanonymoususage=false"],
    additionalArguments: createAdditionalArguments(),
    kubernetesIngress: {
      enabled: true,
      publishedService: { enabled: true },
    },
  };
}

function createPortsConfig() {
  return {
    web: {
      port: TRAEFIK_DEFAULTS.WEB_PORT,
      expose: { default: false }, // Don't expose port 80 since ISP blocks it
      protocol: "TCP",
    },
    websecure: {
      port: TRAEFIK_DEFAULTS.WEBSECURE_PORT,
      expose: { default: true },
      exposedPort: 443,
      protocol: "TCP",
    },
  };
}

function createIngressRouteConfig() {
  return {
    dashboard: {
      enabled: false,
      annotations: { "kubernetes.io/ingress.class": "traefik" },
    },
  };
}

function createCertificateResolvers() {
  // cert-manager will handle certificates via DNS challenges
  // Remove built-in Traefik certificate resolvers
  return {};
}

function createAdditionalArguments(): string[] {
  return [
    "--log.level=INFO",
    "--accesslog=true",
    `--entrypoints.web.address=:${TRAEFIK_DEFAULTS.WEB_PORT}`,
    `--entrypoints.websecure.address=:${TRAEFIK_DEFAULTS.WEBSECURE_PORT}`,
  ];
}

export function isDashboardEnabled(): boolean {
  return true;
}
