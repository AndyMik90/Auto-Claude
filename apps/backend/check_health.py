#!/usr/bin/env python3
"""
Health Check CLI
================

Command-line interface for running system health checks.
Outputs JSON results for consumption by Electron IPC handlers.
"""

import json
import sys
import os
from pathlib import Path

# Ensure parent directory is in path for imports
_PARENT_DIR = Path(__file__).parent
if str(_PARENT_DIR) not in sys.path:
    sys.path.insert(0, str(_PARENT_DIR))

from health_check import run_system_health_check


def main():
    """Run health check and output JSON."""
    try:
        # DEBUG: Log environment variables received from spawn
        print(f"[DEBUG] GRAPHITI_ENABLED from env: {os.getenv('GRAPHITI_ENABLED')}", file=sys.stderr)
        print(f"[DEBUG] CLAUDE_CODE_OAUTH_TOKEN present: {bool(os.getenv('CLAUDE_CODE_OAUTH_TOKEN'))}", file=sys.stderr)
        print(f"[DEBUG] All env keys with GRAPHITI: {[k for k in os.environ.keys() if 'GRAPHITI' in k]}", file=sys.stderr)

        results = run_system_health_check()
        print(json.dumps(results, indent=2))
        sys.exit(0)
    except Exception as e:
        error_result = {
            "healthy": False,
            "error": str(e),
            "timestamp": None,
            "checks": {},
            "summary": {
                "total_checks": 0,
                "passed": 0,
                "failed": 0,
            }
        }
        print(json.dumps(error_result, indent=2))
        sys.exit(1)


if __name__ == "__main__":
    main()
