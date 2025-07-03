     │ Native Pulumi Refactoring Plan                                                                                                                │
     │                                                                                                                                               │
     │ Overview                                                                                                                                      │
     │                                                                                                                                               │
     │ Transform the codebase from custom resource factory patterns to native Pulumi patterns, reducing complexity and leveraging built-in features. │
     │                                                                                                                                               │
     │ Phase 1: Resource Factory Elimination (High Priority)                                                                                         │
     │                                                                                                                                               │
     │ Problem: 25+ manual factory functions instead of native Pulumi patterns                                                                       │
     │ Impact: ~60% code reduction, simplified maintenance                                                                                           │
     │                                                                                                                                               │
     │ 1.1 Replace Kubernetes Resource Factories                                                                                                     │
     │                                                                                                                                               │
     │ - Remove: createArgoCdNamespace, createTraefikNamespace, createCertManagerNamespace                                                           │
     │ - Replace with: Component resources with built-in namespace creation                                                                          │
     │ - Pattern: Use pulumi.ComponentResource with automatic child resource management                                                              │
     │                                                                                                                                               │
     │ 1.2 Replace Chart Configuration Factories                                                                                                     │
     │                                                                                                                                               │
     │ - Remove: createArgoCdChartConfig, createTraefikChartConfig, createCertManagerChartConfig                                                     │
     │ - Replace with: Default transformations and resource options                                                                                  │
     │ - Pattern: Use transformations for common chart patterns                                                                                      │
     │                                                                                                                                               │
     │ 1.3 Replace Option Builders                                                                                                                   │
     │                                                                                                                                               │
     │ - Remove: createArgoCdChartOptions, createTraefikChartOptions, etc.                                                                           │
     │ - Replace with: Shared resource option objects                                                                                                │
     │ - Pattern: Define common options once, reuse via spread operator                                                                              │
     │                                                                                                                                               │
     │ Phase 2: VM Configuration Modernization (Medium Priority)                                                                                     │
     │                                                                                                                                               │
     │ Problem: Manual VM configuration composition instead of native resource patterns                                                              │
     │                                                                                                                                               │
     │ 2.1 Replace VM Configuration Builder                                                                                                          │
     │                                                                                                                                               │
     │ - Remove: buildVmConfiguration, composeVmConfiguration, helper functions                                                                      │
     │ - Replace with: Pulumi ComponentResource with property mapping                                                                                │
     │ - Pattern: Use resource transformations for VM defaults                                                                                       │
     │                                                                                                                                               │
     │ 2.2 Implement VM Transformations                                                                                                              │
     │                                                                                                                                               │
     │ - Create: Common VM transformations for tags, networking, storage                                                                             │
     │ - Pattern: Use pulumi.ResourceTransformationArgs for consistent VM config                                                                     │
     │                                                                                                                                               │
     │ Phase 3: Testing Infrastructure Modernization (Medium Priority)                                                                               │
     │                                                                                                                                               │
     │ Problem: Custom test infrastructure instead of native Pulumi testing framework                                                                │
     │                                                                                                                                               │
     │ 3.1 Replace Custom Test Setup                                                                                                                 │
     │                                                                                                                                               │
     │ - Remove: Custom PulumiTestSetup, createK3sTunnelProvisioner                                                                                  │
     │ - Replace with: @pulumi/pulumi/testing framework                                                                                              │
     │ - Pattern: Use native test infrastructure with automation API                                                                                 │
     │                                                                                                                                               │
     │ 3.2 Implement Native Test Patterns                                                                                                            │
     │                                                                                                                                               │
     │ - Create: Standard test utilities using Pulumi testing framework                                                                              │
     │ - Pattern: Use pulumi.runtime.setMocks() and automation API                                                                                   │
     │                                                                                                                                               │
     │ Phase 4: Remote Command Simplification (Low Priority)                                                                                         │
     │                                                                                                                                               │
     │ Problem: Manual SSH command management instead of automation API patterns                                                                     │
     │                                                                                                                                               │
     │ 4.1 Replace SSH Command Factories                                                                                                             │
     │                                                                                                                                               │
     │ - Modernize: K3s credential retrieval using automation API patterns                                                                           │
     │ - Pattern: Use dynamic providers for complex remote operations                                                                                │
     │                                                                                                                                               │
     │ Phase 5: String Interpolation Optimization (Low Priority)                                                                                     │
     │                                                                                                                                               │
     │ Problem: Mixed interpolation patterns instead of consistent native usage                                                                      │
     │                                                                                                                                               │
     │ 5.1 Standardize Interpolation                                                                                                                 │
     │                                                                                                                                               │
     │ - Standardize: All string interpolation to use pulumi.interpolate                                                                             │
     │ - Remove: Custom .apply() chains where native interpolation works                                                                             │
     │                                                                                                                                               │
     │ Implementation Strategy                                                                                                                       │
     │                                                                                                                                               │
     │ Step 1: Create Shared Transformations                                                                                                         │
     │                                                                                                                                               │
     │ // New: infrastructure/shared/transformations.ts                                                                                              │
     │ export const addCommonLabels: pulumi.ResourceTransformation = (args) => ({                                                                    │
     │   ...args,                                                                                                                                    │
     │   props: {                                                                                                                                    │
     │     ...args.props,                                                                                                                            │
     │     metadata: {                                                                                                                               │
     │       ...args.props.metadata,                                                                                                                 │
     │       labels: {                                                                                                                               │
     │         ...args.props.metadata?.labels,                                                                                                       │
     │         "managed-by": "pulumi",                                                                                                               │
     │         "environment": "staging"                                                                                                              │
     │       }                                                                                                                                       │
     │     }                                                                                                                                         │
     │   }                                                                                                                                           │
     │ });                                                                                                                                           │
     │                                                                                                                                               │
     │ Step 2: Replace Factory Functions with Component Resources                                                                                    │
     │                                                                                                                                               │
     │ // Before: Manual factory functions                                                                                                           │
     │ export function createTraefikChart(name, config, namespace, parent) { ... }                                                                   │
     │                                                                                                                                               │
     │ // After: Component resource with built-in patterns                                                                                           │
     │ export class TraefikChart extends pulumi.ComponentResource {                                                                                  │
     │   constructor(name: string, config: ITraefikConfig, opts?: pulumi.ComponentResourceOptions) {                                                 │
     │     super("rzp:traefik:Chart", name, {}, opts);                                                                                               │
     │                                                                                                                                               │
     │     this.chart = new k8s.helm.v3.Chart(name, {                                                                                                │
     │       chart: "traefik",                                                                                                                       │
     │       // ... config                                                                                                                           │
     │     }, {                                                                                                                                      │
     │       transformations: [addCommonLabels],                                                                                                     │
     │       ...opts                                                                                                                                 │
     │     });                                                                                                                                       │
     │   }                                                                                                                                           │
     │ }                                                                                                                                             │
     │                                                                                                                                               │
     │ Step 3: Implement Resource Options Pattern                                                                                                    │
     │                                                                                                                                               │
     │ // New: infrastructure/shared/resource-options.ts                                                                                             │
     │ export const kubernetesResourceOptions: pulumi.ResourceOptions = {                                                                            │
     │   transformations: [addCommonLabels],                                                                                                         │
     │   customTimeouts: { create: "5m", update: "2m", delete: "1m" }                                                                                │
     │ };                                                                                                                                            │
     │                                                                                                                                               │
     │ Benefits                                                                                                                                      │
     │                                                                                                                                               │
     │ - Code Reduction: ~40% fewer lines of code                                                                                                    │
     │ - Maintenance: Simpler patterns, less custom logic                                                                                            │
     │ - Performance: Native Pulumi optimizations                                                                                                    │
     │ - Testing: Built-in test infrastructure                                                                                                       │
     │ - Consistency: Standard Pulumi patterns throughout                                                                                            │
     │                                                                                                                                               │
     │ Risk Assessment                                                                                                                               │
     │                                                                                                                                               │
     │ - Low Risk: Changes are incremental and well-tested patterns                                                                                  │
     │ - Backward Compatible: Can implement gradually without breaking changes                                                                       │
     │ - Performance Improvement: Native patterns are more efficient                                                                                 │
     │                                                                                                                                               │
     │ Success Metrics                                                                                                                               │
     │                                                                                                                                               │
     │ - Eliminate 25+ factory functions                                                                                                             │
     │ - Reduce infrastructure/ codebase by ~40%                                                                                                     │
     │ - All tests passing with native test framework                                                                                                │
     │ - Zero custom resource orchestration patterns remaining

    - https://www.pulumi.com/docs/concepts/resources/components/
     - https://www.pulumi.com/docs/concepts/options/transformations/
     - https://www.pulumi.com/docs/concepts/options/
     - https://www.pulumi.com/docs/using-pulumi/testing/
     - https://www.pulumi.com/docs/using-pulumi/automation-api/
     - https://www.pulumi.com/docs/concepts/resources/dynamic-providers/
     - https://www.pulumi.com/docs/concepts/inputs-outputs/
