#!/usr/bin/env python3
"""
Smart extraction of IPC handlers into separate modules
"""
import re
from pathlib import Path
from typing import List, Tuple

# Read the original file
original_file = Path("auto-claude-ui/src/main/ipc-handlers.ts")
content = original_file.read_text()

# Read imports section (first 100 lines)
imports_section = '\n'.join(content.split('\n')[:76])

# Module definitions with their channel patterns and line ranges
MODULES = {
    'task': {
        'channels': ['TASK_', 'CHANGELOG_LOAD_TASK'],
        'start_line': 381,
        'end_line': 1877,
        'imports': ['Task', 'TaskMetadata', 'TaskStatus', 'TaskStartOptions', 'ImplementationPlan'],
    },
    'terminal': {
        'channels': ['TERMINAL_', 'CLAUDE_PROFILE_', 'CLAUDE_RETRY'],
        'start_line': 2201,
        'end_line': 2687,
        'imports': ['TerminalCreateOptions', 'ClaudeProfile', 'ClaudeProfileSettings'],
    },
    'changelog': {
        'channels': ['CHANGELOG_'],
        'extra_content': True,  # Has event handlers
    },
    'roadmap': {
        'channels': ['ROADMAP_'],
        'start_line': 2840,
        'end_line': 3207,
    },
    'context': {
        'channels': ['CONTEXT_'],
        'start_line': 3208,
        'end_line': 3716,
    },
}

# Extract content by line numbers
lines = content.split('\n')

for module_name, config in MODULES.items():
    if 'start_line' in config and 'end_line' in config:
        # Extract the handler section
        start = config['start_line'] - 1  # Convert to 0-indexed
        end = config['end_line']
        module_content = '\n'.join(lines[start:end])
        
        # Save to section file
        section_file = Path(f"auto-claude-ui/src/main/ipc-handlers/sections/{module_name}_extracted.txt")
        section_file.write_text(module_content)
        print(f"Extracted {module_name}: lines {config['start_line']}-{config['end_line']} ({end-start} lines)")

print("\nExtraction complete!")
