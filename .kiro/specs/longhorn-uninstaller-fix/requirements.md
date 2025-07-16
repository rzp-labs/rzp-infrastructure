# Requirements Document

## Introduction

The Longhorn distributed storage component in the rzp-infra project is experiencing deployment failures specifically related to the uninstaller job. While the uninstaller is being created successfully, it is failing during execution, which prevents proper Longhorn deployment and management. This feature addresses the root cause of the uninstaller failure and implements a robust solution for Longhorn deployment lifecycle management.

## Requirements

### Requirement 1

**User Story:** As a DevOps engineer, I want the Longhorn uninstaller to execute successfully, so that I can deploy and manage Longhorn storage without deployment failures.

#### Acceptance Criteria

1. WHEN the Longhorn component is deployed THEN the uninstaller job SHALL complete successfully without errors
2. WHEN the uninstaller job runs THEN it SHALL have proper permissions to access required Kubernetes resources
3. WHEN the uninstaller encounters CRDs THEN it SHALL handle them appropriately without causing failures
4. WHEN the uninstaller completes THEN it SHALL leave the cluster in a clean state for subsequent operations

### Requirement 2

**User Story:** As a platform administrator, I want proper error handling and logging for Longhorn deployment issues, so that I can quickly diagnose and resolve problems.

#### Acceptance Criteria

1. WHEN the Longhorn deployment fails THEN the system SHALL provide clear error messages indicating the root cause
2. WHEN uninstaller jobs fail THEN the system SHALL log specific failure reasons and remediation steps
3. WHEN CRD conflicts occur THEN the system SHALL detect and report the conflicting resources
4. WHEN deployment dependencies are missing THEN the system SHALL validate and report missing prerequisites

### Requirement 3

**User Story:** As a Kubernetes cluster operator, I want the Longhorn component to handle upgrade and reinstallation scenarios gracefully, so that I can maintain the storage system without manual intervention.

#### Acceptance Criteria

1. WHEN upgrading Longhorn versions THEN the system SHALL properly handle existing CRDs and resources
2. WHEN reinstalling Longhorn THEN the system SHALL clean up previous installations completely
3. WHEN CRD versions conflict THEN the system SHALL resolve conflicts automatically or provide clear guidance
4. WHEN the deleting-confirmation-flag setting is required THEN it SHALL be properly configured before deployment

### Requirement 4

**User Story:** As a system reliability engineer, I want robust dependency management for Longhorn deployment, so that all prerequisites are met before installation begins.

#### Acceptance Criteria

1. WHEN deploying Longhorn THEN the system SHALL verify that open-iscsi is installed on all nodes
2. WHEN creating the uninstaller THEN it SHALL have proper RBAC permissions for all required operations
3. WHEN the namespace is created THEN it SHALL have appropriate security policies and labels
4. WHEN Helm charts are deployed THEN they SHALL wait for all dependencies to be ready
