/** @type {import('jest').Config} */
module.exports = {
  preset: "ts-jest",
  testEnvironment: "node",
  roots: ["<rootDir>/tests"],
  testMatch: ["**/__tests__/**/*.test.ts", "**/?(*.)+(spec|test).ts"],
  transform: {
    "^.+\\.ts$": "ts-jest",
  },
  collectCoverageFrom: ["components/**/*.ts", "shared/**/*.ts", "!**/*.d.ts"],
  setupFilesAfterEnv: ["<rootDir>/tests/setup.ts"],
  testTimeout: 30000, // K8s operations can be slow
  verbose: true,
  moduleNameMapper: {
    "^@kubernetes/client-node$": "<rootDir>/tests/__mocks__/@kubernetes/client-node.ts",
  },
};
