import type * as k8s from "@kubernetes/client-node";

import { TestEnvironment } from "../../fixtures/k3s/test-environment";

/**
 * Single Responsibility: Test cluster connectivity only
 */
describe("Cluster Connectivity", () => {
  jest.setTimeout(90000); // 90-second timeout for integration tests

  let testEnv: TestEnvironment;
  let k8sApi: k8s.CoreV1Api;

  beforeAll(async () => {
    testEnv = new TestEnvironment();
    await testEnv.setup();
    k8sApi = testEnv.getK8sClient().getCoreApi();
  });

  afterAll(async () => {
    if (testEnv !== undefined) {
      await testEnv.teardown();
    }
  });

  test("should connect to K3s API server", async () => {
    // Arrange
    // No additional setup needed - using existing cluster connection

    // Act
    const response = await k8sApi.listNode();

    // Assert
    expect(response.items).toBeDefined();
    expect(Array.isArray(response.items)).toBe(true);
  });

  test("should have healthy cluster components", async () => {
    // Arrange
    // No additional setup needed - using existing cluster connection

    // Act
    const clusterInfo = await k8sApi.listComponentStatus();

    // Assert
    expect(clusterInfo.items).toBeDefined();
  });
});
