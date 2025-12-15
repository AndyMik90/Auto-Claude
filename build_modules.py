#!/usr/bin/env python3
"""
Build complete handler modules with proper imports and structure
"""
from pathlib import Path
import re

# Base output directory
OUTPUT_DIR = Path("auto-claude-ui/src/main/ipc-handlers")

# Read original file
original = Path("auto-claude-ui/src/main/ipc-handlers.ts").read_text()
lines = original.split('\n')

# Common imports for all modules
COMMON_IMPORTS = """import { ipcMain } from 'electron';
import { IPC_CHANNELS } from '../../shared/constants';
import type { IPCResult, BrowserWindow } from '../../shared/types';
"""

# Helper to create module template
def create_module(name: str, start_line: int, end_line: int, extra_imports: str = "", services: list = []):
    # Extract handler code
    handler_code = '\n'.join(lines[start_line-1:end_line])
    
    # Build service parameters
    service_params = []
    service_imports = []
    
    for service in services:
        service_params.append(f"  {service['name']}: {service['type']}")
        if service.get('import'):
            service_imports.append(service['import'])
    
    params_str = ',\n'.join(service_params) if service_params else ''
    if params_str:
        params_str = f"\n{params_str},\n  getMainWindow: () => BrowserWindow | null\n"
    else:
        params_str = "getMainWindow: () => BrowserWindow | null"
    
    imports_block = COMMON_IMPORTS
    if extra_imports:
        imports_block += extra_imports
    for imp in service_imports:
        imports_block += imp + '\n'
    
    module_content = f"""{imports_block}

/**
 * Register all {name}-related IPC handlers
 */
export function register{name.capitalize()}Handlers({params_str}): void {{
{handler_code}
}}
"""
    return module_content

print("Building handler modules...")

# Build each module
modules_config = [
    {
        'name': 'task',
        'start': 381,
        'end': 1877,
        'extra_imports': """import path from 'path';
import { existsSync, readFileSync, writeFileSync, readdirSync, mkdirSync } from 'fs';
import { execSync } from 'child_process';
import { getSpecsDir } from '../../shared/constants';
import type { Task, TaskMetadata, TaskStartOptions, ImplementationPlan } from '../../shared/types';
import { projectStore } from '../project-store';
import { fileWatcher } from '../file-watcher';
import { taskLogService } from '../task-log-service';
import { titleGenerator } from '../title-generator';
""",
        'services': [
            {'name': 'agentManager', 'type': 'AgentManager', 'import': "import { AgentManager } from '../agent-manager';"},
        ]
    }
]

# Generate task handlers as proof of concept
config = modules_config[0]
module_code = create_module(
    config['name'],
    config['start'],
    config['end'],
    config['extra_imports'],
    config['services']
)

output_file = OUTPUT_DIR / f"{config['name']}-handlers.ts"
output_file.write_text(module_code)
print(f"✓ Created {output_file} ({len(module_code)} chars)")

print("\nModule generation complete!")
