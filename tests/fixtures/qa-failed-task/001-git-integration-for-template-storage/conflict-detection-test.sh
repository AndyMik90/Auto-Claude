#!/bin/bash

################################################################################
# Conflict Detection End-to-End Test Script
#
# This script automates testing of the Git integration conflict detection
# and resolution functionality.
#
# Usage:
#   ./conflict-detection-test.sh [options]
#
# Options:
#   --backend-url URL      Backend URL (default: http://localhost:8080)
#   --frontend-url URL     Frontend URL (default: http://localhost:3000)
#   --tenant-id ID         Tenant ID to test with
#   --auth-token TOKEN     Authentication token
#   --git-repo PATH        Path to test Git repository
#   --test-file PATH       Template file to test with
#   --skip-setup           Skip initial setup steps
#   --verbose              Enable verbose output
#
# Prerequisites:
#   - Backend and frontend services running
#   - Git repository configured
#   - Valid authentication token
#   - jq, curl, git installed
################################################################################

set -e  # Exit on error

# Default configuration
BACKEND_URL="${BACKEND_URL:-http://localhost:8080}"
FRONTEND_URL="${FRONTEND_URL:-http://localhost:3000}"
API_BASE="${BACKEND_URL}/api/v1"
TENANT_ID=""
AUTH_TOKEN=""
GIT_REPO_PATH=""
TEST_FILE="templates/patient-template.json"
SKIP_SETUP=false
VERBOSE=false

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Test results
TESTS_PASSED=0
TESTS_FAILED=0
TESTS_SKIPPED=0

################################################################################
# Helper Functions
################################################################################

print_header() {
    echo -e "\n${BLUE}========================================${NC}"
    echo -e "${BLUE}$1${NC}"
    echo -e "${BLUE}========================================${NC}\n"
}

print_success() {
    echo -e "${GREEN}✓ $1${NC}"
    ((TESTS_PASSED++))
}

print_error() {
    echo -e "${RED}✗ $1${NC}"
    ((TESTS_FAILED++))
}

print_warning() {
    echo -e "${YELLOW}⚠ $1${NC}"
}

print_info() {
    echo -e "${BLUE}ℹ $1${NC}"
}

print_skip() {
    echo -e "${YELLOW}⊘ $1${NC}"
    ((TESTS_SKIPPED++))
}

verbose() {
    if [ "$VERBOSE" = true ]; then
        echo -e "${BLUE}[DEBUG] $1${NC}"
    fi
}

# API call wrapper with error handling
api_call() {
    local method=$1
    local endpoint=$2
    local data=$3
    local description=$4

    verbose "API Call: $method $endpoint"
    verbose "Data: $data"

    local response
    local http_code

    if [ -n "$data" ]; then
        response=$(curl -s -w "\n%{http_code}" -X "$method" \
            "${API_BASE}${endpoint}" \
            -H "Content-Type: application/json" \
            -H "Authorization: Bearer ${AUTH_TOKEN}" \
            -d "$data")
    else
        response=$(curl -s -w "\n%{http_code}" -X "$method" \
            "${API_BASE}${endpoint}" \
            -H "Authorization: Bearer ${AUTH_TOKEN}")
    fi

    http_code=$(echo "$response" | tail -n1)
    body=$(echo "$response" | sed '$d')

    verbose "HTTP Code: $http_code"
    verbose "Response: $body"

    if [ "$http_code" -ge 200 ] && [ "$http_code" -lt 300 ]; then
        print_success "$description (HTTP $http_code)"
        echo "$body"
        return 0
    else
        print_error "$description (HTTP $http_code)"
        echo "$body" >&2
        return 1
    fi
}

# Wait for service to be ready
wait_for_service() {
    local url=$1
    local service_name=$2
    local max_attempts=30
    local attempt=0

    print_info "Waiting for $service_name to be ready..."

    while [ $attempt -lt $max_attempts ]; do
        if curl -s -f "$url" > /dev/null 2>&1; then
            print_success "$service_name is ready"
            return 0
        fi
        ((attempt++))
        sleep 2
    done

    print_error "$service_name is not responding after $max_attempts attempts"
    return 1
}

################################################################################
# Test Steps
################################################################################

# Step 0: Setup and Prerequisites
test_prerequisites() {
    print_header "Step 0: Prerequisites Check"

    # Check required tools
    for tool in curl jq git sha256sum; do
        if command -v $tool &> /dev/null; then
            print_success "$tool is installed"
        else
            print_error "$tool is not installed"
            exit 1
        fi
    done

    # Check services are running
    wait_for_service "${BACKEND_URL}/actuator/health" "Backend"
    wait_for_service "$FRONTEND_URL" "Frontend"

    # Validate parameters
    if [ -z "$TENANT_ID" ]; then
        print_error "TENANT_ID is required"
        exit 1
    fi

    if [ -z "$AUTH_TOKEN" ]; then
        print_error "AUTH_TOKEN is required"
        exit 1
    fi

    if [ -z "$GIT_REPO_PATH" ] || [ ! -d "$GIT_REPO_PATH" ]; then
        print_error "GIT_REPO_PATH is required and must be a valid directory"
        exit 1
    fi

    print_success "All prerequisites met"
}

# Step 1: Modify Template Locally (Simulated)
test_local_modification() {
    print_header "Step 1: Modify Template Locally"

    # In a real test, this would involve:
    # 1. Making API call to update template
    # 2. Verifying blob storage update
    # 3. Capturing local SHA hash

    print_info "This step requires UI interaction or direct blob storage manipulation"
    print_info "Manual action: Modify template '$TEST_FILE' in the UI and save"
    print_skip "Skipping automated local modification (requires UI interaction)"

    # Prompt for confirmation
    read -p "Have you modified the template locally? (y/n): " -n 1 -r
    echo
    if [[ $REPLY =~ ^[Yy]$ ]]; then
        print_success "Local modification confirmed"
        return 0
    else
        print_error "Local modification not performed"
        return 1
    fi
}

# Step 2: Modify Template in Git
test_git_modification() {
    print_header "Step 2: Modify Template in Git"

    cd "$GIT_REPO_PATH" || exit 1

    # Check if file exists
    if [ ! -f "$TEST_FILE" ]; then
        print_error "Test file $TEST_FILE not found in Git repository"
        return 1
    fi

    print_info "Modifying template in Git repository..."

    # Create a different modification than local
    local timestamp=$(date +%s)
    local test_content="{\"resourceType\":\"Patient\",\"timestamp\":$timestamp,\"gitModified\":true}"

    # Backup original
    cp "$TEST_FILE" "${TEST_FILE}.backup"

    # Modify file
    echo "$test_content" > "$TEST_FILE"

    # Commit changes
    git add "$TEST_FILE"
    git commit -m "Test: Conflict detection modification at $timestamp" || {
        print_error "Git commit failed"
        return 1
    }

    # Get commit SHA
    local commit_sha=$(git rev-parse HEAD)
    print_success "Git modification committed (SHA: ${commit_sha:0:7})"

    # Push to remote (optional, comment out if testing locally)
    # git push origin main || print_warning "Git push failed (this is ok for local testing)"

    cd - > /dev/null

    export GIT_COMMIT_SHA=$commit_sha
    return 0
}

# Step 3: Trigger Import
test_trigger_import() {
    print_header "Step 3: Trigger Import"

    local request_body=$(cat <<EOF
{
    "branchName": "main"
}
EOF
)

    local response=$(api_call "POST" "/settings/git/import" "$request_body" "Trigger import")

    if [ $? -eq 0 ]; then
        local import_id=$(echo "$response" | jq -r '.importId')

        if [ "$import_id" != "null" ] && [ -n "$import_id" ]; then
            print_success "Import triggered successfully (ID: $import_id)"
            export IMPORT_ID=$import_id
            return 0
        else
            print_error "Import ID not found in response"
            return 1
        fi
    else
        return 1
    fi
}

# Step 4: Verify Conflict Detected
test_conflict_detection() {
    print_header "Step 4: Verify Conflict Detection"

    if [ -z "$IMPORT_ID" ]; then
        print_error "No import ID available"
        return 1
    fi

    print_info "Polling import status for conflicts..."

    local max_attempts=30
    local attempt=0
    local conflicts_detected=false

    while [ $attempt -lt $max_attempts ]; do
        local response=$(api_call "GET" "/settings/git/import/${IMPORT_ID}" "" "Check import status (attempt $((attempt+1)))")

        if [ $? -eq 0 ]; then
            local status=$(echo "$response" | jq -r '.status')
            local conflicts=$(echo "$response" | jq -r '.conflicts')

            verbose "Status: $status"
            verbose "Conflicts: $conflicts"

            if [ "$conflicts" != "null" ] && [ "$conflicts" != "[]" ]; then
                print_success "Conflicts detected!"

                # Parse conflict details
                local conflict_count=$(echo "$response" | jq '.conflicts | length')
                print_info "Number of conflicts: $conflict_count"

                echo "$response" | jq '.conflicts[]' | while read -r conflict; do
                    local path=$(echo "$conflict" | jq -r '.path')
                    local git_sha=$(echo "$conflict" | jq -r '.gitSha')
                    local local_sha=$(echo "$conflict" | jq -r '.localSha')

                    print_info "  - File: $path"
                    print_info "    Git SHA: ${git_sha:0:7}"
                    print_info "    Local SHA: ${local_sha:0:7}"
                done

                export IMPORT_RESPONSE=$response
                conflicts_detected=true
                break
            elif [ "$status" = "COMPLETED" ]; then
                print_warning "Import completed without detecting conflicts"
                print_warning "This may indicate conflict detection logic is not implemented"
                return 1
            elif [ "$status" = "FAILED" ]; then
                local error=$(echo "$response" | jq -r '.errorMessage')
                print_error "Import failed: $error"
                return 1
            fi
        fi

        ((attempt++))
        sleep 2
    done

    if [ "$conflicts_detected" = false ]; then
        print_error "Conflict detection timeout or not triggered"
        print_warning "Check if Phase 1 pull methods are implemented"
        return 1
    fi

    return 0
}

# Step 5: Resolve Conflict (Simulated)
test_conflict_resolution() {
    print_header "Step 5: Resolve Conflict"

    print_info "This step requires UI interaction to select resolution strategy"
    print_skip "Skipping automated conflict resolution (requires UI interaction)"

    print_info "Manual action: Open conflict modal and select resolution"
    print_info "  Options: USE_GIT or USE_LOCAL"

    # Simulate resolution API call
    print_info "Example resolution API call:"
    cat <<EOF
curl -X POST ${API_BASE}/settings/git/import/resolve-conflicts \\
  -H "Content-Type: application/json" \\
  -H "Authorization: Bearer \${AUTH_TOKEN}" \\
  -d '{
    "importId": "${IMPORT_ID}",
    "resolutions": [
      {
        "path": "${TEST_FILE}",
        "resolution": "USE_GIT"
      }
    ]
  }'
EOF

    read -p "Have you resolved conflicts in the UI? (y/n): " -n 1 -r
    echo
    if [[ $REPLY =~ ^[Yy]$ ]]; then
        print_success "Conflict resolution confirmed"
        return 0
    else
        print_error "Conflict resolution not performed"
        return 1
    fi
}

# Step 6: Verify Resolution Applied
test_resolution_verification() {
    print_header "Step 6: Verify Resolution Applied"

    if [ -z "$IMPORT_ID" ]; then
        print_error "No import ID available"
        return 1
    fi

    # Check final import status
    local response=$(api_call "GET" "/settings/git/import/${IMPORT_ID}" "" "Check final import status")

    if [ $? -eq 0 ]; then
        local status=$(echo "$response" | jq -r '.status')
        local success=$(echo "$response" | jq -r '.success')
        local files_imported=$(echo "$response" | jq -r '.filesImported')

        print_info "Final Status: $status"
        print_info "Success: $success"
        print_info "Files Imported: $files_imported"

        if [ "$status" = "COMPLETED" ] && [ "$success" = "true" ]; then
            print_success "Import completed successfully with resolution applied"
            return 0
        else
            print_error "Import did not complete successfully"
            return 1
        fi
    else
        return 1
    fi
}

################################################################################
# Cleanup
################################################################################

cleanup() {
    print_header "Cleanup"

    # Restore Git repository
    if [ -n "$GIT_REPO_PATH" ] && [ -d "$GIT_REPO_PATH" ]; then
        cd "$GIT_REPO_PATH" || return

        if [ -f "${TEST_FILE}.backup" ]; then
            print_info "Restoring original test file..."
            mv "${TEST_FILE}.backup" "$TEST_FILE"
            git add "$TEST_FILE"
            git commit -m "Test: Restore original file after conflict detection test" || true
            print_success "Original file restored"
        fi

        cd - > /dev/null
    fi
}

################################################################################
# Main Test Execution
################################################################################

main() {
    print_header "Conflict Detection E2E Test Suite"
    print_info "Backend: $BACKEND_URL"
    print_info "Frontend: $FRONTEND_URL"
    print_info "Tenant ID: $TENANT_ID"
    print_info "Test File: $TEST_FILE"

    # Run test steps
    test_prerequisites || exit 1

    if [ "$SKIP_SETUP" = false ]; then
        test_local_modification || print_warning "Local modification step not automated"
    fi

    test_git_modification || exit 1
    test_trigger_import || exit 1
    test_conflict_detection || exit 1
    test_conflict_resolution || print_warning "Conflict resolution step not automated"
    test_resolution_verification || exit 1

    # Cleanup
    trap cleanup EXIT

    # Print summary
    print_header "Test Summary"
    echo -e "${GREEN}Tests Passed: $TESTS_PASSED${NC}"
    echo -e "${RED}Tests Failed: $TESTS_FAILED${NC}"
    echo -e "${YELLOW}Tests Skipped: $TESTS_SKIPPED${NC}"

    if [ $TESTS_FAILED -eq 0 ]; then
        print_success "All automated tests passed!"
        exit 0
    else
        print_error "Some tests failed"
        exit 1
    fi
}

################################################################################
# Parse Command Line Arguments
################################################################################

while [[ $# -gt 0 ]]; do
    case $1 in
        --backend-url)
            BACKEND_URL="$2"
            API_BASE="${BACKEND_URL}/api/v1"
            shift 2
            ;;
        --frontend-url)
            FRONTEND_URL="$2"
            shift 2
            ;;
        --tenant-id)
            TENANT_ID="$2"
            shift 2
            ;;
        --auth-token)
            AUTH_TOKEN="$2"
            shift 2
            ;;
        --git-repo)
            GIT_REPO_PATH="$2"
            shift 2
            ;;
        --test-file)
            TEST_FILE="$2"
            shift 2
            ;;
        --skip-setup)
            SKIP_SETUP=true
            shift
            ;;
        --verbose)
            VERBOSE=true
            shift
            ;;
        --help)
            grep '^#' "$0" | grep -v '#!/bin/bash' | sed 's/^# //'
            exit 0
            ;;
        *)
            echo "Unknown option: $1"
            echo "Use --help for usage information"
            exit 1
            ;;
    esac
done

# Run main
main
