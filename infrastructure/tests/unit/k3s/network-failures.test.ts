/**
 * Network Failure Scenarios Test Suite - Native Pulumi Testing
 * Single Responsibility: Test only network failure conditions
 */

import { FailureSimulatorFactory } from "../../helpers/k3s/failure-simulator-factory";
import { MockK8sTestClient } from "../../helpers/k3s/mock-k8s-test-client";
import type { INetworkFailureSimulator } from "../../helpers/k3s/network-failure-simulator";
import { PodValidator } from "../../helpers/k3s/pod-validator";

describe("Network Failures", () => {
  let k8sClient: MockK8sTestClient;
  let networkSimulator: INetworkFailureSimulator;
  let podValidator: PodValidator;

  beforeEach(() => {
    k8sClient = new MockK8sTestClient();
    void k8sClient.initialize();

    const factory = new FailureSimulatorFactory(k8sClient);
    networkSimulator = factory.createNetworkFailureSimulator();
    podValidator = new PodValidator(k8sClient.getCoreApi());
  });

  afterEach(async () => {
    await networkSimulator.cleanup();
  });

  test("should handle Flannel CNI plugin failures", async () => {
    // Arrange
    const flannelHealthy = await networkSimulator.verifyFlannelHealth();
    expect(flannelHealthy).toBe(true);

    // Act - Simulate Flannel failure
    await networkSimulator.simulateFlannelFailure();

    // Assert
    const networkingDown = await networkSimulator.isNetworkingDown();
    expect(networkingDown).toBe(true);

    // Verify pod-to-pod communication fails
    const communicationResult = await networkSimulator.testPodToPodCommunication();
    expect(communicationResult.success).toBe(false);

    // Verify DNS resolution fails
    const dnsResult = await networkSimulator.testDNSResolution();
    expect(dnsResult.success).toBe(false);
  });

  test("should handle CNI configuration corruption", async () => {
    // Arrange
    const cniConfigValid = await networkSimulator.verifyCNIConfiguration();
    expect(cniConfigValid).toBe(true);

    // Act - Corrupt CNI configuration
    await networkSimulator.corruptCNIConfiguration();

    // Assert
    const configCorrupted = await networkSimulator.isCNIConfigurationCorrupted();
    expect(configCorrupted).toBe(true);

    // Verify new pods fail to start
    const podStartResult = await networkSimulator.attemptPodCreation();
    expect(podStartResult.success).toBe(false);
    expect(podStartResult.error).toContain("network");
  });

  test("should handle CoreDNS crashloop scenarios", async () => {
    // Arrange
    const coreDNSHealthy = await podValidator.validatePodsRunning("kube-system", "coredns");
    expect(coreDNSHealthy).toBe(true);

    // Act - Force CoreDNS into crashloop
    await networkSimulator.simulateCoreDNSCrashloop();

    // Assert
    const crashloopDetected = await networkSimulator.isPodInCrashloop("kube-system", "coredns");
    expect(crashloopDetected).toBe(true);

    // Verify DNS resolution fails cluster-wide
    const clusterDNSWorking = await networkSimulator.testClusterDNS();
    expect(clusterDNSWorking).toBe(false);

    // Verify service discovery fails
    const serviceDiscovery = await networkSimulator.testServiceDiscovery();
    expect(serviceDiscovery).toBe(false);
  });

  test("should handle metrics-server pod failures", async () => {
    // Arrange
    const metricsServerHealthy = await podValidator.validatePodsRunning("kube-system", "metrics-server");
    expect(metricsServerHealthy).toBe(true);

    // Act - Simulate metrics-server failure
    await networkSimulator.simulateMetricsServerFailure();

    // Assert
    const metricsDown = await networkSimulator.isMetricsServerDown();
    expect(metricsDown).toBe(true);

    // Verify HPA stops working
    const hpaWorking = await networkSimulator.testHorizontalPodAutoscaler();
    expect(hpaWorking).toBe(false);

    // Verify kubectl top commands fail
    const topCommandResult = await networkSimulator.testKubectlTopCommands();
    expect(topCommandResult.success).toBe(false);
  });
});
