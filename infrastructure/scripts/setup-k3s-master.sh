#!/bin/bash
set -euo pipefail

# K3s Master Setup Script
# Handles K3s installation, kubeconfig setup, and Longhorn node labeling

# Default values
USERNAME=""
NODE_IP=""
IS_FIRST_MASTER="true"

# Parse command line arguments
while [[ $# -gt 0 ]]; do
  case $1 in
    --username)
      USERNAME="$2"
      shift 2
      ;;
    --node-ip)
      NODE_IP="$2"
      shift 2
      ;;
    --is-first-master)
      IS_FIRST_MASTER="$2"
      shift 2
      ;;
    *)
      echo "Unknown option $1"
      exit 1
      ;;
  esac
done

# Validate required parameters
if [[ -z "$USERNAME" || -z "$NODE_IP" ]]; then
  echo "ERROR: --username and --node-ip are required"
  echo "Usage: $0 --username <user> --node-ip <ip> [--is-first-master true|false]"
  exit 1
fi

echo "Starting K3s master setup for user: $USERNAME, node IP: $NODE_IP, first master: $IS_FIRST_MASTER"

# Install Helm for GitOps operations
echo "Installing Helm..."
curl -fsSL -o get_helm.sh https://raw.githubusercontent.com/helm/helm/main/scripts/get-helm-3
chmod 700 get_helm.sh
./get_helm.sh
rm get_helm.sh
echo "Helm installation completed"

# Set up kubeconfig for admin operations
echo "Setting up kubeconfig for user $USERNAME..."
mkdir -p "/home/$USERNAME/.kube"

# Wait for K3s kubeconfig to be created
echo "Waiting for K3s kubeconfig to be created..."
until [ -f /etc/rancher/k3s/k3s.yaml ]; do
  echo "Waiting for K3s kubeconfig to be created..."
  sleep 2
done

# Copy and configure kubeconfig (requires sudo for root-owned file)
sudo cp /etc/rancher/k3s/k3s.yaml "/home/$USERNAME/.kube/config"

# Fix server endpoint in kubeconfig for remote access
sed -i "s/127.0.0.1:6443/$NODE_IP:6443/g" "/home/$USERNAME/.kube/config"
sudo chown "$USERNAME:$USERNAME" "/home/$USERNAME/.kube/config"
sudo chmod 600 "/home/$USERNAME/.kube/config"

echo "Kubeconfig setup completed"

# Label node for Longhorn disk discovery (first master only)
if [ "$IS_FIRST_MASTER" = "true" ]; then
  echo "Configuring Longhorn disk discovery labels..."
  export KUBECONFIG="/home/$USERNAME/.kube/config"
  
  # Verify kubeconfig is accessible
  if [ ! -f "$KUBECONFIG" ]; then
    echo "ERROR: Kubeconfig not found at $KUBECONFIG"
    exit 1
  fi
  
  # Wait for API server to be ready with timeout
  echo "Waiting for Kubernetes API server to be ready..."
  TIMEOUT=300  # 5 minutes timeout
  ELAPSED=0
  until kubectl get nodes > /dev/null 2>&1; do
    if [ $ELAPSED -ge $TIMEOUT ]; then
      echo "ERROR: Timeout waiting for Kubernetes API server"
      exit 1
    fi
    echo "Waiting for Kubernetes API server... (${ELAPSED}s/${TIMEOUT}s)"
    sleep 5
    ELAPSED=$((ELAPSED + 5))
  done
  
  # Label all nodes for Longhorn disk discovery
  echo "Applying Longhorn disk discovery labels..."
  kubectl label nodes --all node.longhorn.io/create-default-disk=true --overwrite
  echo "Longhorn disk discovery labels applied successfully"
fi

echo "K3s master setup completed successfully"