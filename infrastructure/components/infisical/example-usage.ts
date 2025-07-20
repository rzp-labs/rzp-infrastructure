/**
 * Example usage of the Infisical component
 *
 * This example demonstrates how to deploy Infisical with PostgreSQL and Redis
 * in a homelab Kubernetes environment.
 */

import * as pulumi from "@pulumi/pulumi";

import { InfisicalComponent } from "./component-infisical";

// Get configuration from Pulumi config
const config = new pulumi.Config();

// Example 1: Full deployment with PostgreSQL and Redis
const infisicalWithRedis = new InfisicalComponent("infisical-prod", {
  namespace: "infisical",
  environment: "prd",
  domain: "secrets.homelab.local",

  // PostgreSQL configuration
  databaseConfig: {
    storageSize: "20Gi",
    storageClass: "longhorn", // Use Longhorn for persistent storage
    username: "infisical",
    password: config.requireSecret("infisical-db-password"),
    database: "infisical",
  },

  // Redis configuration for caching
  redisConfig: {
    storageSize: "2Gi",
    storageClass: "longhorn",
    password: config.requireSecret("infisical-redis-password"),
  },

  // Infisical application configuration
  infisicalConfig: {
    authSecret: config.requireSecret("infisical-auth-secret"),
    encryptionKey: config.requireSecret("infisical-encryption-key"),
    adminEmail: "admin@homelab.local",
    adminPassword: config.requireSecret("infisical-admin-password"),
    siteUrl: "https://secrets.homelab.local",
  },
});

// Example 2: Minimal deployment with just PostgreSQL (no Redis)
const infisicalMinimal = new InfisicalComponent("infisical-dev", {
  namespace: "infisical-dev",
  environment: "dev",
  domain: "secrets-dev.homelab.local",

  // PostgreSQL configuration
  databaseConfig: {
    storageSize: "5Gi",
    username: "infisical",
    password: config.requireSecret("infisical-dev-db-password"),
    database: "infisical",
  },

  // Infisical application configuration
  infisicalConfig: {
    authSecret: config.requireSecret("infisical-dev-auth-secret"),
    encryptionKey: config.requireSecret("infisical-dev-encryption-key"),
    adminEmail: "admin@homelab.local",
    adminPassword: config.requireSecret("infisical-dev-admin-password"),
    siteUrl: "https://secrets-dev.homelab.local",
  },
});

// Example 3: Custom chart versions
const infisicalCustomVersions = new InfisicalComponent("infisical-custom", {
  namespace: "infisical-custom",
  environment: "stg",
  domain: "secrets-staging.homelab.local",

  // Specify custom chart versions
  postgresqlChartVersion: "15.5.32",
  redisChartVersion: "19.6.4",

  databaseConfig: {
    storageSize: "10Gi",
    username: "infisical",
    password: config.requireSecret("infisical-staging-db-password"),
    database: "infisical",
  },

  infisicalConfig: {
    authSecret: config.requireSecret("infisical-staging-auth-secret"),
    encryptionKey: config.requireSecret("infisical-staging-encryption-key"),
    adminEmail: "admin@homelab.local",
    adminPassword: config.requireSecret("infisical-staging-admin-password"),
    siteUrl: "https://secrets-staging.homelab.local",
  },
});

// Export component outputs for reference
export const infisicalNamespace = infisicalWithRedis.namespace.metadata.name;
export const infisicalDomain = infisicalWithRedis.ingress.spec.rules[0].host;
export const infisicalHelmValues = infisicalWithRedis.helmValuesOutput;

// Export other examples for reference
export const infisicalMinimalExample = infisicalMinimal;
export const infisicalCustomVersionsExample = infisicalCustomVersions;

// Example Pulumi config commands to set up secrets:
/*
IMPORTANT: These secrets MUST be set BEFORE deployment!
Run these commands before executing 'pulumi up':

# Generate and set all secrets for production deployment
pulumi config set --secret infisical-db-password "$(openssl rand -base64 24)"
pulumi config set --secret infisical-redis-password "$(openssl rand -base64 24)"
pulumi config set --secret infisical-auth-secret "$(openssl rand -hex 32)"
pulumi config set --secret infisical-encryption-key "$(openssl rand -base64 32)"
pulumi config set --secret infisical-admin-password "$(openssl rand -base64 16)"

# CRITICAL: Backup your encryption key before deployment!
# If lost, encrypted secrets cannot be recovered!
pulumi config get --secret infisical-encryption-key > ~/.secrets/infisical-encryption-key.backup
chmod 600 ~/.secrets/infisical-encryption-key.backup

# Alternative: Use the deployment script below
*/

// Deployment script for easier setup:
/*
#!/bin/bash
# deploy-infisical.sh
set -e

echo "🔐 Setting up Infisical secrets..."

# Generate secrets if they don't exist
if ! pulumi config get infisical-db-password &>/dev/null; then
    pulumi config set --secret infisical-db-password "$(openssl rand -base64 24)"
fi

if ! pulumi config get infisical-redis-password &>/dev/null; then
    pulumi config set --secret infisical-redis-password "$(openssl rand -base64 24)"
fi

if ! pulumi config get infisical-auth-secret &>/dev/null; then
    pulumi config set --secret infisical-auth-secret "$(openssl rand -hex 32)"
fi

if ! pulumi config get infisical-encryption-key &>/dev/null; then
    ENCRYPTION_KEY=$(openssl rand -base64 32)
    pulumi config set --secret infisical-encryption-key "$ENCRYPTION_KEY"
    
    # Auto-backup encryption key
    mkdir -p ~/.secrets
    echo "$ENCRYPTION_KEY" > ~/.secrets/infisical-encryption-key.backup
    chmod 600 ~/.secrets/infisical-encryption-key.backup
    echo "✅ Encryption key backed up to ~/.secrets/infisical-encryption-key.backup"
fi

if ! pulumi config get infisical-admin-password &>/dev/null; then
    pulumi config set --secret infisical-admin-password "$(openssl rand -base64 16)"
fi

echo "🚀 Deploying Infisical..."
pulumi up
*/
