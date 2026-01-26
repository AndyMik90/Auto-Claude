#!/bin/bash

# End-to-End Test Script: Bidirectional Git Sync
# Test ID: subtask-5-1
# Description: Automates verification of Git import functionality

set -e

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Configuration (update these values)
BACKEND_URL="${BACKEND_URL:-http://localhost:8080}"
FRONTEND_URL="${FRONTEND_URL:-http://localhost:3000}"
TENANT_ID="${TENANT_ID:-}"
AUTH_TOKEN="${AUTH_TOKEN:-}"
GIT_REPO_URL="${GIT_REPO_URL:-}"
GIT_TOKEN="${GIT_TOKEN:-}"
GIT_BRANCH="${GIT_BRANCH:-main}"

# Test tracking
TESTS_RUN=0
TESTS_PASSED=0
TESTS_FAILED=0

# Functions
print_header() {
    echo ""
    echo -e "${BLUE}========================================${NC}"
    echo -e "${BLUE}$1${NC}"
    echo -e "${BLUE}========================================${NC}"
    echo ""
}

print_test() {
    echo -e "${YELLOW}[TEST]${NC} $1"
}

print_success() {
    echo -e "${GREEN}[PASS]${NC} $1"
    TESTS_PASSED=$((TESTS_PASSED + 1))
}

print_failure() {
    echo -e "${RED}[FAIL]${NC} $1"
    TESTS_FAILED=$((TESTS_FAILED + 1))
}

print_info() {
    echo -e "${BLUE}[INFO]${NC} $1"
}

test_api_endpoint() {
    local method=$1
    local endpoint=$2
    local expected_status=$3
    local description=$4
    local data=$5

    TESTS_RUN=$((TESTS_RUN + 1))
    print_test "$description"

    if [ -n "$data" ]; then
        response=$(curl -s -w "\n%{http_code}" -X "$method" "$BACKEND_URL$endpoint" \
            -H "X-Tenant-Id: $TENANT_ID" \
            -H "Authorization: Bearer $AUTH_TOKEN" \
            -H "Content-Type: application/json" \
            -d "$data")
    else
        response=$(curl -s -w "\n%{http_code}" -X "$method" "$BACKEND_URL$endpoint" \
            -H "X-Tenant-Id: $TENANT_ID" \
            -H "Authorization: Bearer $AUTH_TOKEN")
    fi

    http_code=$(echo "$response" | tail -n1)
    body=$(echo "$response" | sed '$d')

    if [ "$http_code" -eq "$expected_status" ]; then
        print_success "Status: $http_code (expected $expected_status)"
        echo "$body"
        return 0
    else
        print_failure "Status: $http_code (expected $expected_status)"
        echo "Response: $body"
        return 1
    fi
}

check_service() {
    local url=$1
    local name=$2

    if curl -s -o /dev/null -w "%{http_code}" "$url" | grep -q "200\|401\|403"; then
        print_success "$name is running at $url"
        return 0
    else
        print_failure "$name is not accessible at $url"
        return 1
    fi
}

# Main test execution
main() {
    print_header "E2E Test: Bidirectional Git Sync"

    # Check configuration
    if [ -z "$TENANT_ID" ] || [ -z "$AUTH_TOKEN" ]; then
        echo -e "${RED}Error: TENANT_ID and AUTH_TOKEN must be set${NC}"
        echo "Usage: TENANT_ID=xxx AUTH_TOKEN=yyy ./e2e-test-script.sh"
        exit 1
    fi

    print_info "Backend URL: $BACKEND_URL"
    print_info "Frontend URL: $FRONTEND_URL"
    print_info "Tenant ID: $TENANT_ID"
    print_info "Git Branch: $GIT_BRANCH"

    # Test 1: Check services are running
    print_header "Test 1: Service Availability"
    TESTS_RUN=$((TESTS_RUN + 1))
    if check_service "$BACKEND_URL/actuator/health" "Backend API" && \
       check_service "$FRONTEND_URL" "Frontend"; then
        print_success "All services are running"
        TESTS_PASSED=$((TESTS_PASSED + 1))
    else
        print_failure "Some services are not running"
        TESTS_FAILED=$((TESTS_FAILED + 1))
        echo "Please start services using: ./init.sh"
        exit 1
    fi

    # Test 2: Get Git configuration
    print_header "Test 2: Git Configuration"
    git_config=$(test_api_endpoint "GET" "/api/v1/settings/git" 200 "Retrieve Git configuration")

    if echo "$git_config" | grep -q "repositoryUrl"; then
        print_success "Git configuration exists"
    else
        print_failure "Git configuration not found - please configure Git in UI first"
        exit 1
    fi

    # Test 3: Get sync history (before import)
    print_header "Test 3: Pre-Import Sync History"
    history_before=$(test_api_endpoint "GET" "/api/v1/settings/git/history?limit=1" 200 "Get sync history before import")
    history_count_before=$(echo "$history_before" | jq 'length')
    print_info "Sync history entries before import: $history_count_before"

    # Test 4: Trigger import
    print_header "Test 4: Trigger Git Import"
    import_request='{"branchName":"'"$GIT_BRANCH"'"}'
    import_response=$(test_api_endpoint "POST" "/api/v1/settings/git/import" 200 "Trigger import from Git" "$import_request")

    if echo "$import_response" | grep -q "importId"; then
        import_id=$(echo "$import_response" | jq -r '.importId')
        print_success "Import triggered successfully - Import ID: $import_id"
    else
        print_failure "Import trigger failed"
        exit 1
    fi

    # Test 5: Check import status
    print_header "Test 5: Import Status Polling"
    max_attempts=30
    attempt=0
    import_completed=false

    while [ $attempt -lt $max_attempts ]; do
        attempt=$((attempt + 1))
        print_info "Checking import status (attempt $attempt/$max_attempts)..."

        status_response=$(curl -s -X GET "$BACKEND_URL/api/v1/settings/git/import/$import_id" \
            -H "X-Tenant-Id: $TENANT_ID" \
            -H "Authorization: Bearer $AUTH_TOKEN")

        import_status=$(echo "$status_response" | jq -r '.status // empty')

        if [ "$import_status" = "COMPLETED" ]; then
            print_success "Import completed successfully"
            files_imported=$(echo "$status_response" | jq -r '.filesImported // 0')
            print_info "Files imported: $files_imported"
            import_completed=true
            break
        elif [ "$import_status" = "FAILED" ]; then
            print_failure "Import failed"
            echo "$status_response" | jq '.'
            break
        else
            print_info "Import status: $import_status - waiting..."
            sleep 2
        fi
    done

    TESTS_RUN=$((TESTS_RUN + 1))
    if [ "$import_completed" = true ]; then
        TESTS_PASSED=$((TESTS_PASSED + 1))
    else
        print_failure "Import did not complete within timeout"
        TESTS_FAILED=$((TESTS_FAILED + 1))
    fi

    # Test 6: Verify import in sync history
    print_header "Test 6: Post-Import Sync History"
    history_after=$(test_api_endpoint "GET" "/api/v1/settings/git/history?limit=5" 200 "Get sync history after import")

    if echo "$history_after" | jq '.[0].syncType' | grep -q "MANUAL"; then
        print_success "Import operation appears in sync history"
        echo "$history_after" | jq '.[0]'
    else
        print_failure "Import operation not found in sync history"
    fi

    # Test 7: List templates (verify they exist)
    print_header "Test 7: Template Verification"
    TESTS_RUN=$((TESTS_RUN + 1))

    # Note: Actual endpoint may vary - this is a placeholder
    # Update with actual template listing endpoint
    print_info "Manual verification required:"
    echo "  1. Navigate to $FRONTEND_URL/templates"
    echo "  2. Verify templates are visible"
    echo "  3. Open a template that was modified in Git"
    echo "  4. Verify changes from Git are present"

    # Generate test report
    print_header "Test Summary"
    echo "Total Tests: $TESTS_RUN"
    echo -e "${GREEN}Passed: $TESTS_PASSED${NC}"
    echo -e "${RED}Failed: $TESTS_FAILED${NC}"

    if [ $TESTS_FAILED -eq 0 ]; then
        print_success "All automated tests passed!"
        echo ""
        echo "Next steps:"
        echo "1. Complete manual verification steps"
        echo "2. Review e2e-test-plan.md for detailed scenarios"
        echo "3. Create test report in e2e-test-report.md"
        return 0
    else
        print_failure "Some tests failed - review output above"
        return 1
    fi
}

# Run tests
main "$@"
