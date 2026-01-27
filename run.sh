#!/bin/bash
# Auto-Claude Run Script
# Handles all run modes with virtual environment

set -e

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
cd "$SCRIPT_DIR"

# Colors
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
CYAN='\033[0;36m'
NC='\033[0m'

VENV_DIR="$SCRIPT_DIR/.venv"

# Check if venv exists
check_venv() {
    if [ ! -d "$VENV_DIR" ]; then
        echo -e "${RED}Error: Virtual environment not found.${NC}"
        echo -e "Run ${CYAN}./setup.sh${NC} first to create it."
        exit 1
    fi
}

# Activate venv
activate_venv() {
    check_venv
    source "$VENV_DIR/bin/activate"
}

# Show help
show_help() {
    echo ""
    echo -e "${CYAN}Auto-Claude Run Script${NC}"
    echo ""
    echo "Usage: ./run.sh <command> [options]"
    echo ""
    echo "Commands:"
    echo "  dev                Run Electron app in development mode"
    echo "  build              Build production Electron app"
    echo "  start              Run production Electron app"
    echo "  package            Package app for current platform"
    echo "  package:mac        Package app for macOS"
    echo ""
    echo "  cli [options]      Run CLI backend directly"
    echo "                     Examples:"
    echo "                       ./run.sh cli --list"
    echo "                       ./run.sh cli --spec 001"
    echo "                       ./run.sh cli --spec 001 --isolated"
    echo ""
    echo "  test-jira          Test JIRA MCP connection"
    echo "  test-gitlab        Test GitLab connection (runs OAuth if needed)"
    echo "  gitlab-login       Run GitLab OAuth login flow"
    echo ""
    echo "  shell              Open shell with venv activated"
    echo "  help               Show this help message"
    echo ""
}

# Run Electron dev mode
run_dev() {
    echo -e "${GREEN}Starting Auto-Claude in development mode...${NC}"
    activate_venv
    cd apps/frontend
    npm run dev
}

# Build Electron app
run_build() {
    echo -e "${GREEN}Building Auto-Claude...${NC}"
    activate_venv
    cd apps/frontend
    npm run build
    echo -e "${GREEN}Build complete!${NC}"
}

# Run production build
run_start() {
    echo -e "${GREEN}Starting Auto-Claude...${NC}"
    activate_venv
    cd apps/frontend
    npm run start
}

# Package app
run_package() {
    local platform="${1:-}"
    activate_venv
    cd apps/frontend

    if [ -z "$platform" ]; then
        echo -e "${GREEN}Packaging for current platform...${NC}"
        npm run package
    else
        echo -e "${GREEN}Packaging for $platform...${NC}"
        npm run "package:$platform"
    fi

    echo -e "${GREEN}Package complete! Check apps/frontend/dist/${NC}"
}

# Run CLI
run_cli() {
    activate_venv
    cd apps/backend
    python run.py "$@"
}

# Test JIRA connection
test_jira() {
    echo -e "${CYAN}Testing JIRA connection...${NC}"
    echo ""
    activate_venv
    cd apps/backend

    python3 << 'EOF'
import asyncio
import sys
sys.path.insert(0, '.')

from integrations.jira.direct_client import DirectJiraClient, JiraCredentials

async def test():
    # Try to load credentials
    creds = JiraCredentials.from_mcp_settings() or JiraCredentials.from_env()

    if not creds:
        print("⚠️  JIRA not configured.")
        print("   Ensure hc-jira is in ~/.claude/settings.json")
        print("   Or set JIRA_HOST, JIRA_EMAIL, JIRA_API_TOKEN in environment")
        return

    print(f"JIRA Host: {creds.host}")
    print(f"Email: {creds.email}")
    print(f"Default Project: {creds.default_project or 'Not set'}")

    print("\nConnecting to JIRA...")

    try:
        async with DirectJiraClient(creds) as client:
            # Get current user
            user = await client.get_current_user()
            print(f"✓ Authenticated as: {user.get('displayName', 'Unknown')}")

            # Search for issues (new API requires bounded queries)
            project = creds.default_project or 'CAP'
            jql = f'project = {project} ORDER BY created DESC'
            result = await client.search_issues(jql, 5, fields=['key', 'summary', 'status'])
            issues = result.get('issues', [])
            print(f"✓ Found {len(issues)} recent issues")

            for issue in issues:
                key = issue.get('key', 'N/A')
                fields = issue.get('fields', {})
                summary = fields.get('summary', 'No summary')[:50] if fields.get('summary') else 'No summary'
                status_obj = fields.get('status', {})
                status = status_obj.get('name', 'Unknown') if status_obj else 'Unknown'
                print(f"   - {key}: {summary} [{status}]")

            print("\n✓ JIRA integration working!")

    except Exception as e:
        print(f"\n✗ Error: {e}")
        import traceback
        traceback.print_exc()

asyncio.run(test())
EOF
}

# Test GitLab connection
test_gitlab() {
    echo -e "${CYAN}Testing GitLab connection...${NC}"
    echo ""
    activate_venv
    cd apps/backend

    python3 << 'EOF'
import asyncio
import os
import sys
sys.path.insert(0, '.')

from integrations.gitlab.integration import GitLabManager, is_gitlab_enabled
from integrations.gitlab.config import GitLabConfig
from pathlib import Path

async def test():
    print(f"GitLab integration enabled: {is_gitlab_enabled()}")

    config = GitLabConfig.from_file() or GitLabConfig.from_env()

    if not config.url:
        print("\n⚠️  GitLab not configured.")
        print("   Set these environment variables:")
        print("     GITLAB_URL=https://gitlab.yourcompany.com")
        print("     GITLAB_CLIENT_ID=your-client-id")
        print("     GITLAB_CLIENT_SECRET=your-client-secret")
        print("     GITLAB_PROJECT_ID=group/project")
        return

    print(f"\nGitLab URL: {config.url}")
    print(f"Project: {config.project_id or 'Not set'}")
    print(f"Auth mode: {'OAuth' if config.use_oauth else 'Personal Access Token'}")

    manager = GitLabManager(Path('.'), Path('.'), user_id='test-user')

    if not manager.is_authenticated:
        print("\n⚠️  Not authenticated.")
        print("   Run: ./run.sh gitlab-login")
        return

    try:
        print("\nConnecting to GitLab API...")
        await manager.connect()
        print("✓ Connected to GitLab")

        issues = await manager.list_project_issues(per_page=3)
        print(f"✓ Found {len(issues)} issues")

        for issue in issues:
            print(f"   - #{issue.get('iid')}: {issue.get('title', '')[:50]}")

        await manager.disconnect()
        print("\n✓ GitLab integration working!")

    except Exception as e:
        print(f"\n✗ Error: {e}")

asyncio.run(test())
EOF
}

# GitLab OAuth login
gitlab_login() {
    echo -e "${CYAN}Starting GitLab OAuth login...${NC}"
    echo ""
    activate_venv
    cd apps/backend

    python3 << 'EOF'
import asyncio
import os
import sys
sys.path.insert(0, '.')

from integrations.gitlab.oauth import GitLabOAuth
from integrations.gitlab.oauth_server import run_oauth_flow
from integrations.gitlab.config import GitLabConfig

async def login():
    config = GitLabConfig.from_file() or GitLabConfig.from_env()

    if not config.url or not config.client_id:
        print("⚠️  GitLab OAuth not configured.")
        print("\nSet these environment variables:")
        print("  GITLAB_URL=https://gitlab.yourcompany.com")
        print("  GITLAB_CLIENT_ID=your-oauth-app-client-id")
        print("  GITLAB_CLIENT_SECRET=your-oauth-app-secret")
        print("\nOr add them to apps/backend/.env")
        return

    print(f"GitLab: {config.url}")
    print(f"Client ID: {config.client_id[:10]}...")

    user_id = input("\nEnter your email or username: ").strip()
    if not user_id:
        print("Cancelled.")
        return

    oauth = GitLabOAuth(
        gitlab_url=config.url,
        client_id=config.client_id,
        client_secret=config.client_secret,
        redirect_uri=config.redirect_uri,
    )

    print("\nOpening browser for authentication...")
    token = await run_oauth_flow(oauth, user_id)

    if token:
        username = token.gitlab_user.get('username', 'Unknown') if token.gitlab_user else 'Unknown'
        print(f"\n✓ Successfully logged in as: {username}")
        print(f"  Token stored for user: {user_id}")
    else:
        print("\n✗ Login failed")

asyncio.run(login())
EOF
}

# Open shell with venv
open_shell() {
    echo -e "${GREEN}Opening shell with virtual environment...${NC}"
    echo -e "${YELLOW}Type 'exit' to leave${NC}"
    echo ""
    activate_venv
    export PS1="(auto-claude) \w $ "
    exec bash --norc --noprofile
}

# Main
case "${1:-help}" in
    dev)
        run_dev
        ;;
    build)
        run_build
        ;;
    start)
        run_start
        ;;
    package)
        run_package "${2:-}"
        ;;
    package:mac)
        run_package "mac"
        ;;
    package:win)
        run_package "win"
        ;;
    package:linux)
        run_package "linux"
        ;;
    cli)
        shift
        run_cli "$@"
        ;;
    test-jira)
        test_jira
        ;;
    test-gitlab)
        test_gitlab
        ;;
    gitlab-login)
        gitlab_login
        ;;
    shell)
        open_shell
        ;;
    help|--help|-h)
        show_help
        ;;
    *)
        echo -e "${RED}Unknown command: $1${NC}"
        show_help
        exit 1
        ;;
esac
