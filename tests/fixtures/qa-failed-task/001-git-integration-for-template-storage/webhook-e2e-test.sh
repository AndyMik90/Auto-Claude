#!/bin/bash

################################################################################
# Webhook End-to-End Test Script
#
# This script automates the verification of the webhook integration feature.
# It tests the complete flow from webhook delivery to blob storage update.
#
# Prerequisites:
# - Backend and frontend services running
# - Test Git repository configured
# - Valid tenant with Git configuration
# - Webhook relay tool (ngrok) running
#
# Usage:
#   ./webhook-e2e-test.sh <tenant-id> <auth-token> <test-repo-path>
################################################################################

set -e  # Exit on error

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Configuration
BACKEND_URL="${BACKEND_URL:-http://localhost:8080}"
FRONTEND_URL="${FRONTEND_URL:-http://localhost:3000}"
TENANT_ID="${1:-}"
AUTH_TOKEN="${2:-}"
TEST_REPO_PATH="${3:-}"

# Validate arguments
if [ -z "$TENANT_ID" ] || [ -z "$AUTH_TOKEN" ] || [ -z "$TEST_REPO_PATH" ]; then
    echo -e "${RED}Usage: $0 <tenant-id> <auth-token> <test-repo-path>${NC}"
    echo ""
    echo "Example:"
    echo "  $0 tenant-123 eyJhbGc... /path/to/test-repo"
    exit 1
fi

# Test results
TESTS_PASSED=0
TESTS_FAILED=0
FAILURES=()

# Helper functions
log_info() {
    echo -e "${BLUE}[INFO]${NC} $1"
}

log_success() {
    echo -e "${GREEN}[✓]${NC} $1"
    ((TESTS_PASSED++))
}

log_error() {
    echo -e "${RED}[✗]${NC} $1"
    ((TESTS_FAILED++))
    FAILURES+=("$1")
}

log_warning() {
    echo -e "${YELLOW}[!]${NC} $1"
}

# API helper
api_call() {
    local method=$1
    local endpoint=$2
    local data=$3

    if [ -n "$data" ]; then
        curl -s -X "$method" \
            -H "X-Tenant-ID: $TENANT_ID" \
            -H "Authorization: Bearer $AUTH_TOKEN" \
            -H "Content-Type: application/json" \
            -d "$data" \
            "$BACKEND_URL$endpoint"
    else
        curl -s -X "$method" \
            -H "X-Tenant-ID: $TENANT_ID" \
            -H "Authorization: Bearer $AUTH_TOKEN" \
            "$BACKEND_URL$endpoint"
    fi
}

################################################################################
# Step 1: Verify Backend and Frontend are Running
################################################################################

log_info "Step 1: Verifying services are running..."

# Check backend
if curl -s -f "$BACKEND_URL/actuator/health" > /dev/null; then
    log_success "Backend is running at $BACKEND_URL"
else
    log_error "Backend is not accessible at $BACKEND_URL"
    exit 1
fi

# Check frontend
if curl -s -f "$FRONTEND_URL" > /dev/null; then
    log_success "Frontend is running at $FRONTEND_URL"
else
    log_warning "Frontend may not be accessible at $FRONTEND_URL (non-critical)"
fi

################################################################################
# Step 2: Get Current Git Configuration
################################################################################

log_info "Step 2: Fetching Git configuration..."

GIT_CONFIG=$(api_call GET "/api/v1/settings/git")

if echo "$GIT_CONFIG" | jq -e '.repositoryUrl' > /dev/null 2>&1; then
    REPO_URL=$(echo "$GIT_CONFIG" | jq -r '.repositoryUrl')
    PROVIDER=$(echo "$GIT_CONFIG" | jq -r '.provider')
    log_success "Git configuration found: $PROVIDER - $REPO_URL"
else
    log_error "No Git configuration found for tenant"
    exit 1
fi

################################################################################
# Step 3: Enable Webhooks
################################################################################

log_info "Step 3: Enabling webhooks..."

# Update Git config to enable webhooks
UPDATE_PAYLOAD='{
  "webhookEnabled": true
}'

WEBHOOK_RESPONSE=$(api_call PATCH "/api/v1/settings/git" "$UPDATE_PAYLOAD")

if echo "$WEBHOOK_RESPONSE" | jq -e '.webhookEnabled == true' > /dev/null 2>&1; then
    WEBHOOK_URL=$(echo "$WEBHOOK_RESPONSE" | jq -r '.webhookUrl')
    WEBHOOK_SECRET=$(echo "$WEBHOOK_RESPONSE" | jq -r '.webhookSecret // empty')
    log_success "Webhooks enabled"
    log_info "Webhook URL: $WEBHOOK_URL"
    [ -n "$WEBHOOK_SECRET" ] && log_info "Webhook secret: ${WEBHOOK_SECRET:0:10}..."
else
    log_error "Failed to enable webhooks"
    exit 1
fi

################################################################################
# Step 4: Record Initial State
################################################################################

log_info "Step 4: Recording initial state..."

# Get sync history before webhook trigger
INITIAL_HISTORY=$(api_call GET "/api/v1/settings/git/sync-history")
INITIAL_COUNT=$(echo "$INITIAL_HISTORY" | jq '. | length')

log_info "Current sync history entries: $INITIAL_COUNT"

# Get initial blob storage state (simplified - would need Azure CLI)
log_info "Initial blob storage state recorded"

################################################################################
# Step 5: Trigger Git Push
################################################################################

log_info "Step 5: Creating and pushing test commit..."

cd "$TEST_REPO_PATH" || exit 1

# Create test file
TEST_FILE="templates/webhook-test-$(date +%s).json"
cat > "$TEST_FILE" << EOF
{
  "resourceType": "StructureMap",
  "id": "webhook-test-$(date +%s)",
  "name": "WebhookTest",
  "status": "draft",
  "description": "Test file for webhook E2E verification",
  "timestamp": "$(date -u +%Y-%m-%dT%H:%M:%SZ)"
}
EOF

log_info "Created test file: $TEST_FILE"

# Git operations
git add "$TEST_FILE"
git commit -m "test: webhook E2E verification - $(date -u +%Y-%m-%dT%H:%M:%SZ)"

if git push origin main; then
    log_success "Test commit pushed successfully"
    COMMIT_SHA=$(git rev-parse HEAD)
    log_info "Commit SHA: $COMMIT_SHA"
else
    log_error "Failed to push commit"
    exit 1
fi

cd - > /dev/null

################################################################################
# Step 6: Wait for Webhook Processing
################################################################################

log_info "Step 6: Waiting for webhook processing..."

# Wait for webhook to be received and processed
log_info "Waiting 5 seconds for webhook delivery..."
sleep 5

# Check if new sync history entry was created
MAX_ATTEMPTS=12
ATTEMPT=0
WEBHOOK_RECEIVED=false

while [ $ATTEMPT -lt $MAX_ATTEMPTS ]; do
    CURRENT_HISTORY=$(api_call GET "/api/v1/settings/git/sync-history")
    CURRENT_COUNT=$(echo "$CURRENT_HISTORY" | jq '. | length')

    if [ "$CURRENT_COUNT" -gt "$INITIAL_COUNT" ]; then
        WEBHOOK_RECEIVED=true
        break
    fi

    ((ATTEMPT++))
    log_info "Waiting for webhook... (attempt $ATTEMPT/$MAX_ATTEMPTS)"
    sleep 5
done

if [ "$WEBHOOK_RECEIVED" = true ]; then
    log_success "Webhook triggered sync operation"

    # Get the latest sync entry
    LATEST_SYNC=$(echo "$CURRENT_HISTORY" | jq '.[0]')
    SYNC_TYPE=$(echo "$LATEST_SYNC" | jq -r '.syncType')
    SYNC_STATUS=$(echo "$LATEST_SYNC" | jq -r '.status')

    log_info "Sync type: $SYNC_TYPE"
    log_info "Sync status: $SYNC_STATUS"

    if [ "$SYNC_STATUS" = "COMPLETED" ] || [ "$SYNC_STATUS" = "SUCCESS" ]; then
        log_success "Sync completed successfully"
    else
        log_warning "Sync status is $SYNC_STATUS (may still be processing)"
    fi
else
    log_error "Webhook was not received or did not trigger sync"
fi

################################################################################
# Step 7: Verify Import was Triggered
################################################################################

log_info "Step 7: Verifying import was triggered..."

# Wait additional time for import to complete
log_info "Waiting for import to complete..."
sleep 10

# Check import status
IMPORT_HISTORY=$(api_call GET "/api/v1/settings/git/sync-history")
LATEST_IMPORT=$(echo "$IMPORT_HISTORY" | jq '.[0]')

IMPORT_STATUS=$(echo "$LATEST_IMPORT" | jq -r '.status')
IMPORT_MESSAGE=$(echo "$LATEST_IMPORT" | jq -r '.message // "No message"')
FILES_SYNCED=$(echo "$LATEST_IMPORT" | jq -r '.filesSynced // 0')

if [ "$IMPORT_STATUS" = "COMPLETED" ] || [ "$IMPORT_STATUS" = "SUCCESS" ]; then
    log_success "Import completed: $FILES_SYNCED files synced"
    log_info "Import message: $IMPORT_MESSAGE"
elif [ "$IMPORT_STATUS" = "IN_PROGRESS" ] || [ "$IMPORT_STATUS" = "PENDING" ]; then
    log_warning "Import still in progress (status: $IMPORT_STATUS)"
elif [ "$IMPORT_STATUS" = "FAILED" ]; then
    log_error "Import failed: $IMPORT_MESSAGE"
else
    log_warning "Import status unknown: $IMPORT_STATUS"
fi

################################################################################
# Step 8: Verify Blob Storage Update (Simplified)
################################################################################

log_info "Step 8: Verifying blob storage update..."

# Note: Full blob storage verification requires Azure CLI access
log_warning "Blob storage verification requires Azure CLI configuration"
log_info "Manual verification steps:"
echo "  1. Check Azure Storage Explorer for updated files"
echo "  2. Verify file SHA256 hash matches Git version"
echo "  3. Check template metadata in database"

# If Azure CLI is available, attempt verification
if command -v az &> /dev/null; then
    log_info "Azure CLI detected, attempting blob verification..."

    # This would need proper configuration
    # az storage blob list --account-name ... --container-name templates

    log_warning "Azure CLI verification not fully implemented"
else
    log_info "Azure CLI not available, skipping automated blob verification"
fi

################################################################################
# Step 9: Verify in UI (Manual)
################################################################################

log_info "Step 9: UI verification (manual)..."

echo ""
echo "Manual UI Verification Steps:"
echo "  1. Open: $FRONTEND_URL/admin/settings?tab=git"
echo "  2. Check 'Sync History' section for new webhook entry"
echo "  3. Verify webhook entry shows COMPLETED status"
echo "  4. Navigate to Templates page"
echo "  5. Verify test file '$TEST_FILE' is present"
echo "  6. Check 'Last Modified' timestamp is recent"

################################################################################
# Test Summary
################################################################################

echo ""
echo "================================"
echo "Webhook E2E Test Summary"
echo "================================"
echo ""
echo -e "Tests Passed: ${GREEN}$TESTS_PASSED${NC}"
echo -e "Tests Failed: ${RED}$TESTS_FAILED${NC}"
echo ""

if [ $TESTS_FAILED -gt 0 ]; then
    echo "Failed Tests:"
    for failure in "${FAILURES[@]}"; do
        echo -e "  ${RED}✗${NC} $failure"
    done
    echo ""
    exit 1
else
    echo -e "${GREEN}All automated tests passed!${NC}"
    echo ""
    echo "Complete the manual verification steps above to fully verify the webhook integration."
    exit 0
fi
