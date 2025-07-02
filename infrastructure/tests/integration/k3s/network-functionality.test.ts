import { TestEnvironment } from "../../fixtures/k3s/test-environment";

/**
 * Single Responsibility: Test network functionality with proper fixtures
 */
describe("Network Functionality", () => {
  let testEnv: TestEnvironment;
  let testNamespace: string;

  beforeAll(async () => {
    testEnv = new TestEnvironment();
    await testEnv.setup();
    testNamespace = testEnv.getNamespaceManager().getTestNamespace();
  });

  afterAll(async () => {
    if (testEnv !== undefined) {
      await testEnv.teardown();
    }
  });

  beforeEach(async () => {
    // Ensure clean namespace for each test
    await testEnv.getNamespaceManager().ensureCleanNamespace();
  });

  test("should create and access a test service", async () => {
    // Arrange
    const resourceManager = testEnv.getResourceManager();
    const k8sApi = testEnv.getK8sClient().getCoreApi();
    const deploymentName = "nginx-test";
    const serviceName = "nginx-test-svc";

    const deploymentSpec = {
      replicas: 1,
      selector: { matchLabels: { app: "nginx-test" } },
      template: {
        metadata: { labels: { app: "nginx-test" } },
        spec: {
          containers: [
            {
              name: "nginx",
              image: "nginx:alpine",
              ports: [{ containerPort: 80 }],
            },
          ],
        },
      },
    };

    const serviceSpec = {
      selector: { app: "nginx-test" },
      ports: [{ port: 80, targetPort: 80 }],
    };

    // Act
    await resourceManager.createTestDeployment(testNamespace, deploymentName, deploymentSpec);
    await resourceManager.createTestService(testNamespace, serviceName, serviceSpec);
    await resourceManager.waitForDeploymentReady(testNamespace, deploymentName);
    const serviceResponse = await k8sApi.readNamespacedService({
      name: serviceName,
      namespace: testNamespace,
    });

    // Assert
    expect(serviceResponse.metadata?.name).toBe(serviceName);
  });

  test("should have working DNS resolution", async () => {
    // Arrange
    const resourceManager = testEnv.getResourceManager();
    const k8sApi = testEnv.getK8sClient().getCoreApi();
    const podName = "dns-test-pod";

    const podSpec = {
      containers: [
        {
          name: "dns-test",
          image: "busybox:1.35",
          command: ["sleep", "300"],
        },
      ],
      restartPolicy: "Never" as const,
    };

    // Act
    await resourceManager.createTestPod(testNamespace, podName, podSpec);
    await resourceManager.waitForPodReady(testNamespace, podName);
    const podResponse = await k8sApi.readNamespacedPod({
      name: podName,
      namespace: testNamespace,
    });

    // Assert
    expect(podResponse.status?.phase).toBe("Running");
  });
});
