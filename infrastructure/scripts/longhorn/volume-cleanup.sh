#!/bin/bash
set -euo pipefail

# Longhorn Volume Cleanup Script
# Based on Longhorn's own cleanup patterns and Kubernetes best practices

NAMESPACE="${NAMESPACE:-longhorn-system}"
ENVIRONMENT="${ENVIRONMENT:-staging}"
MAX_AGE_HOURS="${MAX_AGE_HOURS:-24}"

log() {
    echo "$(date '+%Y-%m-%d %H:%M:%S') - $1"
}

cleanup_faulted_volumes() {
    log "Checking for faulted volumes in $NAMESPACE..."

    # Check if Longhorn CRDs exist before proceeding
    if ! kubectl get crd volumes.longhorn.io >/dev/null 2>&1; then
        log "Longhorn CRDs not found. Skipping volume cleanup."
        return 0
    fi

    kubectl get volumes.longhorn.io -n "$NAMESPACE" -o json | \
        jq -r '.items[] | select(.status.robustness == "faulted") | .metadata.name' | \
        while read -r volume; do
            if [[ -n "$volume" ]]; then
                log "Deleting faulted volume: $volume"
                kubectl delete volume "$volume" -n "$NAMESPACE" --timeout=60s || \
                    log "Failed to delete volume: $volume"
            fi
        done
}

cleanup_released_pvs() {
    log "Checking for released PVs with longhorn storage class..."

    # Check if kubectl can access cluster
    if ! kubectl get pv >/dev/null 2>&1; then
        log "Cannot access PVs. Check RBAC permissions."
        return 1
    fi

    kubectl get pv -o json | \
        jq -r '.items[] | select(.status.phase == "Released" and .spec.storageClassName == "longhorn") | .metadata.name' | \
        while read -r pv; do
            if [[ -n "$pv" ]]; then
                log "Deleting released PV: $pv"
                kubectl delete pv "$pv" --timeout=60s || \
                    log "Failed to delete PV: $pv"
            fi
        done
}

main() {
    log "Starting Longhorn volume cleanup for $ENVIRONMENT environment"

    if [[ "$ENVIRONMENT" == "staging" || "$ENVIRONMENT" == "stg" ]]; then
        cleanup_faulted_volumes || log "Faulted volume cleanup failed but continuing"
        cleanup_released_pvs || log "Released PV cleanup failed but continuing"
        log "Staging cleanup completed"
    else
        log "Volume cleanup only runs in staging environments"
    fi

    log "Volume cleanup job completed successfully"
}

main "$@"
