#!/bin/bash
set -euo pipefail

# Longhorn Disk Provisioning Script
# Automatically configures default disks on all Longhorn nodes when auto-creation fails

DISK_PATH="${DISK_PATH:-/var/lib/longhorn}"
STORAGE_RESERVED="${STORAGE_RESERVED:-6442450944}"  # 6GB in bytes
TIMEOUT_SECONDS="${TIMEOUT_SECONDS:-600}"
RETRY_ATTEMPTS="${RETRY_ATTEMPTS:-3}"
NAMESPACE="${NAMESPACE:-longhorn-system}"

log() {
    echo "$(date '+%Y-%m-%d %H:%M:%S') - $1"
}

# Function to wait for Longhorn nodes to be available
wait_for_longhorn_nodes() {
    local attempt=1
    while [ "${attempt}" -le "${RETRY_ATTEMPTS}" ]; do
        log "Attempt ${attempt}/${RETRY_ATTEMPTS}: Checking for Longhorn nodes..."

        if kubectl get nodes.longhorn.io -n "${NAMESPACE}" --no-headers 2>/dev/null | grep -q .; then
            log "Longhorn nodes found"
            return 0
        fi

        log "Longhorn nodes not ready, waiting 30 seconds..."
        sleep 30
        ((attempt++))
    done

    log "Failed to find Longhorn nodes after ${RETRY_ATTEMPTS} attempts"
    return 1
}

# Function to provision disk on a node
provision_node_disk() {
    local node_name=$1
    local disk_name="default-disk-${node_name}"

    log "Provisioning disk for node: ${node_name}"

    # Check if disk already exists and is properly configured
    if kubectl get node.longhorn.io "${node_name}" -n "${NAMESPACE}" -o jsonpath='{.spec.disks}' 2>/dev/null | grep -q "${disk_name}"; then
        local current_path
    current_path=$(kubectl get node.longhorn.io "${node_name}" -n "${NAMESPACE}" -o jsonpath="{.spec.disks.${disk_name}.path}")
        local current_scheduling
        current_scheduling=$(kubectl get node.longhorn.io "${node_name}" -n "${NAMESPACE}" -o jsonpath="{.spec.disks.${disk_name}.allowScheduling}")

        if [ "${current_path}" = "${DISK_PATH}" ] && [ "${current_scheduling}" = "true" ]; then
            log "Node ${node_name} already has properly configured disk"
            return 0
        fi
    fi

    # Create the disk configuration patch
    local patch="{
        \"spec\": {
            \"disks\": {
                \"${disk_name}\": {
                    \"allowScheduling\": true,
                    \"path\": \"${DISK_PATH}\",
                    \"storageReserved\": ${STORAGE_RESERVED}
                }
            }
        }
    }"

    log "Applying disk configuration patch to node ${node_name}..."
    if kubectl patch node.longhorn.io "${node_name}" -n "${NAMESPACE}" --type='merge' -p "${patch}"; then
        log "Successfully configured disk for node ${node_name}"
        return 0
    else
        log "Failed to configure disk for node ${node_name}"
        return 1
    fi
}

# Function to verify disk provisioning
verify_disk_provisioning() {
    log "Verifying disk provisioning..."
    local failed_nodes=()

    while IFS= read -r node_name; do
        local disk_name="default-disk-${node_name}"
        local path
        path=$(kubectl get node.longhorn.io "${node_name}" -n "${NAMESPACE}" -o jsonpath="{.spec.disks.${disk_name}.path}" 2>/dev/null || echo "")
        local scheduling
        scheduling=$(kubectl get node.longhorn.io "${node_name}" -n "${NAMESPACE}" -o jsonpath="{.spec.disks.${disk_name}.allowScheduling}" 2>/dev/null || echo "")

        if [ "${path}" != "${DISK_PATH}" ] || [ "${scheduling}" != "true" ]; then
            failed_nodes+=("${node_name}")
        fi
    done < <(kubectl get nodes.longhorn.io -n "${NAMESPACE}" --no-headers -o custom-columns="NAME:.metadata.name")

    if [ ${#failed_nodes[@]} -eq 0 ]; then
        log "All nodes have properly configured disks"
        return 0
    else
        log "Failed verification for nodes: ${failed_nodes[*]}"
        return 1
    fi
}

# Main execution
main() {
    local start_time
    start_time=$(date +%s)
    local end_time=$((start_time + TIMEOUT_SECONDS))

    log "Starting Longhorn disk provisioning automation..."
    log "Disk path: ${DISK_PATH}"
    log "Storage reserved: ${STORAGE_RESERVED} bytes"
    log "Timeout: ${TIMEOUT_SECONDS} seconds"
    log "Retry attempts: ${RETRY_ATTEMPTS}"

    # Wait for Longhorn nodes to be available
    if ! wait_for_longhorn_nodes; then
        log "Longhorn nodes not available, exiting"
        exit 1
    fi

    # Get all Longhorn nodes
    local nodes=()
    while IFS= read -r node_name; do
        nodes+=("${node_name}")
    done < <(kubectl get nodes.longhorn.io -n "${NAMESPACE}" --no-headers -o custom-columns="NAME:.metadata.name")

    if [ ${#nodes[@]} -eq 0 ]; then
        log "No Longhorn nodes found"
        exit 1
    fi

    log "Found ${#nodes[@]} Longhorn nodes: ${nodes[*]}"

    # Provision disks for all nodes
    local attempt=1
    while [ ${attempt} -le "${RETRY_ATTEMPTS}" ] && [ "$(date +%s)" -lt ${end_time} ]; do
        log "Provisioning attempt ${attempt}/${RETRY_ATTEMPTS}..."

        local success=true
        for node_name in "${nodes[@]}"; do
            if ! provision_node_disk "${node_name}"; then
                success=false
            fi
        done

        if ${success} && verify_disk_provisioning; then
            log "Disk provisioning completed successfully!"
            exit 0
        fi

        if [ ${attempt} -lt "${RETRY_ATTEMPTS}" ]; then
            log "Waiting 60 seconds before retry..."
            sleep 60
        fi

        ((attempt++))
    done

    log "Disk provisioning failed after ${RETRY_ATTEMPTS} attempts"
    exit 1
}

# Execute main function
main
