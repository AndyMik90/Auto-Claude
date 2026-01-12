# Single-File Agents (SFAs)

Self-contained Python agents for quick analysis and utility tasks in Auto-Claude.

## Overview

Single-File Agents (SFAs) are specialized Python scripts that follow the UV + PEP 723 pattern:
- **Self-contained**: All dependencies embedded in the script
- **No venv needed**: UV manages dependencies automatically
- **Quick execution**: < 30 seconds typical runtime
- **Focused**: One task, done well

## Available Agents

| Agent | Purpose | Usage |
|-------|---------|-------|
| `sfa_spec_query_anthropic_v1.py` | Query spec.md files | `--spec-dir PATH --query "text"` |

## Usage

### Direct Execution

```bash
# Query a spec file
uv run apps/backend/single-file-agents/agents/sfa_spec_query_anthropic_v1.py \
  --spec-dir .auto-claude/specs/001-auth \
  --query "What are the acceptance criteria?"
```

### Via Claude Code Skill

Say: "use sfa to query spec 001 for acceptance criteria"

Claude Code will execute the appropriate SFA automatically.

## Requirements

- **UV installed**: `curl -LsSf https://astral.sh/uv/install.sh | sh`
- **ANTHROPIC_API_KEY**: Set in environment or `.env` file
- **Python 3.12+**: Managed automatically by UV

## Creating New SFAs

Follow the template pattern:

```python
#!/usr/bin/env -S uv run --script
# /// script
# dependencies = [
#   "anthropic>=0.45.2",
#   "rich>=13.7.0",
# ]
# ///

"""
Brief description of what this SFA does.

/// Example Usage
uv run sfa_name_anthropic_v1.py --arg1 value --arg2 value
///
"""

import argparse
from anthropic import Anthropic
from rich.console import Console

def main():
    parser = argparse.ArgumentParser(description="Your SFA description")
    parser.add_argument("--arg1", required=True, help="Argument description")
    args = parser.parse_args()

    console = Console()
    # Your logic here

if __name__ == "__main__":
    main()
```

## Best Practices

1. **Keep it focused**: One clear purpose per SFA
2. **Rich output**: Use Rich library for beautiful terminal formatting
3. **CLI arguments**: Use argparse for clear interface
4. **Error handling**: Graceful failures with helpful messages
5. **Documentation**: Include usage examples in docstring
6. **JSON mode**: Support `--json` flag for machine-readable output

## Integration

SFAs complement Auto-Claude's core agents:
- **Core agents**: Multi-module, complex workflows, state management
- **SFAs**: Quick analysis, utilities, single-purpose tasks

Use SFAs when:
- You need quick information (< 30 seconds)
- Task is well-scoped and standalone
- No persistent state needed
- Analysis doesn't require multi-step orchestration

## Roadmap

**Phase 2 (Weeks 3-4)**: Initial 6 SFAs
- [x] sfa_spec_query_anthropic_v1.py
- [ ] sfa_plan_analyzer_anthropic_v1.py
- [ ] sfa_session_cost_tracker_anthropic_v1.py
- [ ] sfa_graphiti_query_anthropic_v1.py
- [ ] sfa_qa_report_analyzer_anthropic_v1.py
- [ ] sfa_worktree_manager_anthropic_v1.py

**Phase 5 (Weeks 9-10)**: Archon Integration SFAs
- [ ] sfa_archon_task_query_anthropic_v1.py
- [ ] sfa_archon_rag_researcher_anthropic_v1.py
- [ ] sfa_archon_project_reporter_anthropic_v1.py

**Phase 6 (Weeks 11-12)**: Observability SFAs
- [ ] sfa_events_analyzer_anthropic_v1.py
- [ ] sfa_loop_detector_report_anthropic_v1.py
- [ ] sfa_failure_investigator_anthropic_v1.py

## Resources

- [SFA Development Guide (Archon)](../../../.claude/skills/single-file-agents/README.md)
- [UV Documentation](https://docs.astral.sh/uv/)
- [PEP 723 - Inline Script Metadata](https://peps.python.org/pep-0723/)
- [Rich Library](https://github.com/Textualize/rich)
