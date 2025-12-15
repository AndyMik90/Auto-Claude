#!/usr/bin/env python3
"""
Script to extract IPC handlers from the monolithic ipc-handlers.ts file
and organize them into domain-specific modules.
"""

import re
from pathlib import Path
from typing import Dict, List, Tuple

# Read the original file
ipc_handlers_path = Path("auto-claude-ui/src/main/ipc-handlers.ts")
content = ipc_handlers_path.read_text()

# Define handler domains based on IPC channel prefixes
DOMAINS = {
    'task': ['TASK_'],
    'terminal': ['TERMINAL_', 'CLAUDE_PROFILE_', 'CLAUDE_RETRY'],
    'file': ['FILE_EXPLORER_'],
    'settings': ['SETTINGS_', 'DIALOG_', 'APP_VERSION', 'python-env:'],
    'changelog': ['CHANGELOG_'],
    'roadmap': ['ROADMAP_'],
    'context': ['CONTEXT_'],
    'insights': ['INSIGHTS_'],
    'ideation': ['IDEATION_'],
    'integration': ['LINEAR_', 'GITHUB_', 'ENV_', 'AUTOBUILD_SOURCE_ENV'],
    'autobuild': ['AUTOBUILD_SOURCE_CHECK', 'AUTOBUILD_SOURCE_DOWNLOAD', 'AUTOBUILD_SOURCE_VERSION', 'AUTOBUILD_SOURCE_PROGRESS']
}

# Find all handler registrations
handler_pattern = r'ipcMain\.(handle|on)\s*\(\s*(?:IPC_CHANNELS\.|[\'"])([\w:]+)'
handlers = list(re.finditer(handler_pattern, content))

print(f"Found {len(handlers)} handlers")

# Group handlers by domain
domain_handlers: Dict[str, List[Tuple[str, int]]] = {domain: [] for domain in DOMAINS.keys()}
domain_handlers['project'] = []  # Special case for project handlers

for match in handlers:
    channel = match.group(2)
    start_pos = match.start()

    # Determine domain
    domain = None
    if channel.startswith('PROJECT'):
        domain = 'project'
    else:
        for dom, prefixes in DOMAINS.items():
            if any(channel.startswith(prefix) or channel.find(prefix) != -1 for prefix in prefixes):
                domain = dom
                break

    if domain:
        domain_handlers[domain].append((channel, start_pos))
    else:
        print(f"Unknown domain for channel: {channel}")

# Print summary
for domain, handlers_list in domain_handlers.items():
    if handlers_list:
        print(f"{domain}: {len(handlers_list)} handlers")
        for channel, _ in sorted(handlers_list)[:5]:
            print(f"  - {channel}")
        if len(handlers_list) > 5:
            print(f"  ... and {len(handlers_list) - 5} more")
