#!/bin/bash
set -euo pipefail

echo "Starting Longhorn prerequisite validation..."

# Environment variables (set by Kubernetes Job)
NAMESPACE="${NAMESPACE:-longhorn-system}"
COMPONENT_NAME="${COMPONENT_NAME:-longhorn}"
TIMEOUT_SECONDS="${TIMEOUT_SECONDS:-600}"

# Function to log with timestamp
log() {
  echo "[$(date '+%Y-%m-%d %H:%M:%S')] $*"
}

# Function to check if a command exists
command_exists() {
  command -v "$1" >/dev/null 2>&1
}

# Main validation execution
main() {
  log "Starting comprehensive prerequisite validation for Longhorn..."

  # Validate kubectl is available
  if ! command_exists "kubectl"; then
    log "ERROR: kubectl is not available"
    exit 1
  fi

  # Validate cluster connectivity
  if ! kubectl get nodes >/dev/null 2>&1; then
    log "ERROR: Cannot connect to Kubernetes cluster"
    exit 1
  fi

  # Check if Longhorn is already running successfully
  log "Checking if Longhorn is already deployed and working..."

  # Check for healthy running pods (not just status.phase=Running which includes crashing pods)
  local healthy_pods
  healthy_pods=$(kubectl get pods -n "$NAMESPACE" -l app=longhorn-manager --field-selector=status.phase=Running -o jsonpath='{.items[?(@.status.containerStatuses[0].ready==true)].metadata.name}' 2>/dev/null || echo "")

  if [ -n "$healthy_pods" ]; then
    log "✓ Healthy Longhorn manager pods found: $healthy_pods"
    log "✓ Prerequisite validation completed successfully (existing deployment)"
    exit 0
  else
    log "⚠ Found Longhorn manager pods but they are not healthy - proceeding with prerequisite validation"
  fi

  log "No existing Longhorn deployment found - proceeding with prerequisite validation"

  # Install open-iscsi on all nodes using a simple approach
  log "Installing open-iscsi on all nodes..."

  # Get all nodes
  local nodes
  nodes=$(kubectl get nodes -o jsonpath='{.items[*].metadata.name}')

  for node in $nodes; do
    log "Installing open-iscsi on node: $node"

    # Create a temporary pod on each node to install open-iscsi
    kubectl debug node/"$node" --image=busybox --restart=Never --rm -i -- sh -c "
      echo 'Installing open-iscsi on $(hostname)...'
      # Check if already installed
      if chroot /host which iscsiadm >/dev/null 2>&1; then
        echo "✓ open-iscsi already installed"
        exit 0
      fi

      # Install based on detected OS
      if chroot /host test -f /etc/debian_version; then
        echo "Detected Debian/Ubuntu - installing open-iscsi"
        chroot /host apt-get update
        chroot /host apt-get install -y open-iscsi
        chroot /host systemctl enable iscsid
        chroot /host systemctl start iscsid
        echo "✓ open-iscsi installed and started"
      else
        echo "⚠ Unsupported OS - manual installation may be required"
        exit 1
      fi
    " || {
      log "ERROR: Failed to install open-iscsi on node $node"
      exit 1
    }
  done

  log "✓ Prerequisite validation completed successfully"
  log "open-iscsi installed on all nodes - Longhorn deployment can proceed"
}

# Execute main function
main
