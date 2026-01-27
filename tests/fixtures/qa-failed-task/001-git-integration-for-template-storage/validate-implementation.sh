#!/bin/bash

# Implementation Validation Script
# Verifies that all required code changes for bidirectional sync are in place

set -e

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

CHECKS_PASSED=0
CHECKS_FAILED=0
WARNINGS=0

print_header() {
    echo ""
    echo -e "${BLUE}========================================${NC}"
    echo -e "${BLUE}$1${NC}"
    echo -e "${BLUE}========================================${NC}"
    echo ""
}

check_pass() {
    echo -e "${GREEN}✓${NC} $1"
    CHECKS_PASSED=$((CHECKS_PASSED + 1))
}

check_fail() {
    echo -e "${RED}✗${NC} $1"
    CHECKS_FAILED=$((CHECKS_FAILED + 1))
}

check_warn() {
    echo -e "${YELLOW}⚠${NC} $1"
    WARNINGS=$((WARNINGS + 1))
}

check_file_exists() {
    local file=$1
    local description=$2

    if [ -f "$file" ]; then
        check_pass "$description exists: $file"
        return 0
    else
        check_fail "$description missing: $file"
        return 1
    fi
}

check_method_exists() {
    local file=$1
    local method=$2
    local description=$3

    if [ -f "$file" ] && grep -q "$method" "$file"; then
        check_pass "$description found in $file"
        return 0
    else
        check_fail "$description not found in $file"
        return 1
    fi
}

print_header "Implementation Validation for Bidirectional Git Sync"

# Backend - GitProvider Interface
print_header "Phase 1: Git Pull API (Backend)"

check_method_exists \
    "backend/src/main/java/com/healthchain/fhirmapper/service/git/GitProvider.java" \
    "pullFiles" \
    "GitProvider.pullFiles() method"

check_method_exists \
    "backend/src/main/java/com/healthchain/fhirmapper/service/git/GitProvider.java" \
    "getFileContents" \
    "GitProvider.getFileContents() method"

check_method_exists \
    "backend/src/main/java/com/healthchain/fhirmapper/service/git/GitProvider.java" \
    "listFiles" \
    "GitProvider.listFiles() method"

# Backend - Provider Implementations
check_method_exists \
    "backend/src/main/java/com/healthchain/fhirmapper/service/git/GitHubProvider.java" \
    "pullFiles" \
    "GitHubProvider.pullFiles() implementation"

check_method_exists \
    "backend/src/main/java/com/healthchain/fhirmapper/service/git/GitLabProvider.java" \
    "pullFiles" \
    "GitLabProvider.pullFiles() implementation"

check_method_exists \
    "backend/src/main/java/com/healthchain/fhirmapper/service/git/AzureDevOpsProvider.java" \
    "pullFiles" \
    "AzureDevOpsProvider.pullFiles() implementation"

# Backend - Import Service
print_header "Phase 2: Git Import Service (Backend)"

check_file_exists \
    "backend/src/main/java/com/healthchain/fhirmapper/service/git/GitImportService.java" \
    "GitImportService"

check_file_exists \
    "backend/src/main/java/com/healthchain/fhirmapper/dto/GitImportRequest.java" \
    "GitImportRequest DTO"

check_file_exists \
    "backend/src/main/java/com/healthchain/fhirmapper/dto/GitImportResponse.java" \
    "GitImportResponse DTO"

check_file_exists \
    "backend/src/main/java/com/healthchain/fhirmapper/dto/GitConflictResponse.java" \
    "GitConflictResponse DTO"

check_method_exists \
    "backend/src/main/java/com/healthchain/fhirmapper/controller/GitConfigController.java" \
    "/import" \
    "Import endpoint in GitConfigController"

# Backend - Webhook Integration
print_header "Phase 3: Webhook Integration (Backend)"

check_file_exists \
    "backend/src/main/java/com/healthchain/fhirmapper/dto/GitWebhookPayload.java" \
    "GitWebhookPayload DTO"

check_file_exists \
    "backend/src/main/java/com/healthchain/fhirmapper/dto/GitWebhookEvent.java" \
    "GitWebhookEvent enum"

check_file_exists \
    "backend/src/main/java/com/healthchain/fhirmapper/service/git/GitWebhookService.java" \
    "GitWebhookService"

check_file_exists \
    "backend/src/main/java/com/healthchain/fhirmapper/controller/GitWebhookController.java" \
    "GitWebhookController"

check_method_exists \
    "backend/src/main/java/com/healthchain/fhirmapper/model/entity/TenantGitConfig.java" \
    "webhookEnabled" \
    "Webhook fields in TenantGitConfig"

# Frontend - Import UI
print_header "Phase 4: Frontend Import UI"

check_file_exists \
    "frontend/src/types/gitImport.ts" \
    "Git import types"

check_file_exists \
    "frontend/src/api/gitImport.ts" \
    "Git import API client"

check_method_exists \
    "frontend/src/components/settings/GitSettings.tsx" \
    "Import from Git" \
    "Import section in GitSettings"

check_file_exists \
    "frontend/src/components/settings/GitWebhookConfig.tsx" \
    "GitWebhookConfig component"

check_file_exists \
    "frontend/src/components/settings/GitConflictModal.tsx" \
    "GitConflictModal component"

# Backend Compilation
print_header "Backend Compilation Check"

echo "Attempting to compile backend..."
cd backend
if mvn compile -DskipTests -q > /dev/null 2>&1; then
    check_pass "Backend compiles successfully"
else
    check_fail "Backend compilation failed"
    echo "Run 'cd backend && mvn compile' to see errors"
fi
cd ..

# Frontend Compilation
print_header "Frontend Compilation Check"

echo "Checking frontend TypeScript..."
cd frontend
if npm run build > /dev/null 2>&1; then
    check_pass "Frontend builds successfully"
else
    check_fail "Frontend build failed"
    echo "Run 'cd frontend && npm run build' to see errors"
fi
cd ..

# Test Documentation
print_header "Test Documentation"

check_file_exists \
    ".auto-claude/specs/001-git-integration-for-template-storage/e2e-test-plan.md" \
    "E2E test plan"

check_file_exists \
    ".auto-claude/specs/001-git-integration-for-template-storage/e2e-test-script.sh" \
    "E2E test script"

check_file_exists \
    ".auto-claude/specs/001-git-integration-for-template-storage/e2e-test-report.md" \
    "E2E test report template"

check_file_exists \
    ".auto-claude/specs/001-git-integration-for-template-storage/E2E-TESTING-README.md" \
    "E2E testing README"

# Summary
print_header "Validation Summary"

TOTAL_CHECKS=$((CHECKS_PASSED + CHECKS_FAILED))
echo "Total Checks: $TOTAL_CHECKS"
echo -e "${GREEN}Passed: $CHECKS_PASSED${NC}"
echo -e "${RED}Failed: $CHECKS_FAILED${NC}"
echo -e "${YELLOW}Warnings: $WARNINGS${NC}"
echo ""

if [ $CHECKS_FAILED -eq 0 ]; then
    echo -e "${GREEN}✓ Implementation validation passed!${NC}"
    echo ""
    echo "Ready for end-to-end testing:"
    echo "  1. Review: E2E-TESTING-README.md"
    echo "  2. Start services: ./init.sh"
    echo "  3. Run automated tests: ./e2e-test-script.sh"
    echo "  4. Complete manual verification: e2e-test-plan.md"
    echo "  5. Document results: e2e-test-report.md"
    exit 0
else
    echo -e "${RED}✗ Implementation validation failed!${NC}"
    echo ""
    echo "Please fix the failed checks before proceeding with E2E testing."
    exit 1
fi
