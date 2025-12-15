#!/usr/bin/env python3
"""
Build ALL handler modules
"""
from pathlib import Path

OUTPUT_DIR = Path("auto-claude-ui/src/main/ipc-handlers")
original = Path("auto-claude-ui/src/main/ipc-handlers.ts").read_text()
lines = original.split('\n')

COMMON_IMPORTS = """import { ipcMain } from 'electron';
import type { BrowserWindow } from 'electron';
import { IPC_CHANNELS } from '../../shared/constants';
import type { IPCResult } from '../../shared/types';
"""

def extract(start, end, extra_imports, services, name):
    handler_code = '\n'.join(lines[start-1:end])
    
    # Build service parameters
    service_params_list = [f"{s['name']}: {s['type']}" for s in services]
    service_params_list.append("getMainWindow: () => BrowserWindow | null")
    params = ',\n  '.join(service_params_list)
    
    # Build imports
    imports = COMMON_IMPORTS + extra_imports
    for s in services:
        if s.get('import'):
            imports += s['import'] + '\n'
    
    return f"""{imports}

/**
 * Register all {name}-related IPC handlers
 */
export function register{name.replace('-', '').capitalize()}Handlers(
  {params}
): void {{
{handler_code}
}}
"""

# Module configurations
modules = {
    'terminal': {
        'start': 2201,
        'end': 2687,
        'imports': """import type { TerminalCreateOptions, ClaudeProfile, ClaudeProfileSettings } from '../../shared/types';
import { getClaudeProfileManager } from '../claude-profile-manager';
""",
        'services': [
            {'name': 'terminalManager', 'type': 'TerminalManager', 'import': "import { TerminalManager } from '../terminal-manager';"}
        ]
    },
    'agent-events': {
        'start': 2689,
        'end': 2838,
        'imports': """import type { RateLimitInfo, ExecutionProgress } from '../../shared/types';
""",
        'services': [
            {'name': 'agentManager', 'type': 'AgentManager', 'import': "import { AgentManager } from '../agent-manager';"},
            {'name': 'titleGenerator', 'type': 'any', 'import': "import { titleGenerator } from '../title-generator';"},
            {'name': 'fileWatcher', 'type': 'any', 'import': "import { fileWatcher } from '../file-watcher';"}
        ]
    },
    'roadmap': {
        'start': 2840,
        'end': 3207,
        'imports': """import path from 'path';
import { existsSync, readFileSync, writeFileSync, mkdirSync } from 'fs';
import type { Roadmap, RoadmapFeature, RoadmapFeatureStatus } from '../../shared/types';
import { projectStore } from '../project-store';
import { fileWatcher } from '../file-watcher';
""",
        'services': [
            {'name': 'agentManager', 'type': 'AgentManager', 'import': "import { AgentManager } from '../agent-manager';"}
        ]
    },
    'context': {
        'start': 3208,
        'end': 3716,
        'imports': """import path from 'path';
import { existsSync, readFileSync } from 'fs';
import type { ProjectContextData, GraphitiMemoryStatus, MemoryEpisode, ContextSearchResult } from '../../shared/types';
import { projectStore } from '../project-store';
""",
        'services': []
    },
    'env': {
        'start': 3717,
        'end': 4143,
        'imports': """import path from 'path';
import { existsSync, readFileSync, writeFileSync } from 'fs';
import { execSync, spawn } from 'child_process';
import type { ProjectEnvConfig, ClaudeAuthResult } from '../../shared/types';
import { projectStore } from '../project-store';
""",
        'services': []
    },
    'linear': {
        'start': 4144,
        'end': 4647,
        'imports': """import path from 'path';
import { existsSync, readFileSync } from 'fs';
import { spawn } from 'child_process';
import type { LinearIssue, LinearTeam, LinearProject, LinearImportResult, LinearSyncStatus } from '../../shared/types';
import { projectStore } from '../project-store';
""",
        'services': []
    },
    'github': {
        'start': 4648,
        'end': 5369,
        'imports': """import path from 'path';
import { existsSync, readFileSync } from 'fs';
import { spawn } from 'child_process';
import type { GitHubRepository, GitHubIssue, GitHubSyncStatus, GitHubImportResult, GitHubInvestigationResult } from '../../shared/types';
import { projectStore } from '../project-store';
""",
        'services': [
            {'name': 'agentManager', 'type': 'AgentManager', 'import': "import { AgentManager } from '../agent-manager';"}
        ]
    },
    'autobuild-source': {
        'start': 5370,
        'end': 5655,
        'imports': """import path from 'path';
import { existsSync, readFileSync, writeFileSync } from 'fs';
import type { AutoBuildSourceUpdateProgress, SourceEnvConfig, SourceEnvCheckResult } from '../../shared/types';
import { checkForUpdates as checkSourceUpdates, downloadAndApplyUpdate, getBundledVersion, getEffectiveSourcePath } from '../auto-claude-updater';
""",
        'services': []
    },
    'ideation': {
        'start': 5656,
        'end': 6241,
        'imports': """import path from 'path';
import { existsSync, readFileSync, writeFileSync, mkdirSync } from 'fs';
import type { IdeationSession, IdeationConfig, IdeationGenerationStatus } from '../../shared/types';
import { projectStore } from '../project-store';
import { fileWatcher } from '../file-watcher';
""",
        'services': [
            {'name': 'agentManager', 'type': 'AgentManager', 'import': "import { AgentManager } from '../agent-manager';"}
        ]
    },
    'changelog': {
        'start': 6243,
        'end': 6553,
        'imports': """import path from 'path';
import { existsSync, readFileSync } from 'fs';
import { execSync } from 'child_process';
import { getSpecsDir } from '../../shared/constants';
import type { Task } from '../../shared/types';
import { projectStore } from '../project-store';
import { changelogService } from '../changelog-service';
""",
        'services': []
    },
    'insights': {
        'start': 6554,
        'end': 6830,
        'imports': """import path from 'path';
import type { InsightsSession, InsightsSessionSummary, InsightsChatStatus, InsightsStreamChunk } from '../../shared/types';
import { projectStore } from '../project-store';
import { insightsService } from '../insights-service';
""",
        'services': []
    }
}

# Generate all modules
for name, config in modules.items():
    content = extract(
        config['start'],
        config['end'],
        config['imports'],
        config['services'],
        name
    )
    
    output_file = OUTPUT_DIR / f"{name}-handlers.ts"
    output_file.write_text(content)
    lines_count = config['end'] - config['start'] + 1
    print(f"✓ {name}-handlers.ts ({lines_count} lines)")

print(f"\n✅ Generated {len(modules)} handler modules!")
