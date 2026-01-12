# CLAUDE.md - Roadmap Feature

This file provides guidance to Claude Code when working with the Roadmap feature in Auto Claude.

## Feature Overview

The **Roadmap** feature is an AI-powered strategic product planning tool that analyzes your project and generates a comprehensive feature roadmap. It helps you understand your target audience, prioritize features, and plan development phases.

**Key Capabilities:**
- Autonomous project analysis (README, codebase, dependencies)
- Target audience discovery and persona creation
- Competitive context analysis (with optional web-based competitor research)
- Strategic feature generation based on user pain points
- Multi-phase roadmap with prioritization (MoSCoW framework)
- Graphiti memory integration for insights storage

## Architecture

### Two-Phase Pipeline

**Phase 1: Discovery** (`roadmap_discovery.md`)
- Analyzes project structure, README, package files
- Infers target audience and pain points
- Determines project maturity and technical constraints
- Optional: Incorporates competitor analysis data
- **Output**: `roadmap_discovery.json`

**Phase 2: Feature Generation** (`roadmap_features.md`)
- Reads discovery data
- Generates features addressing user pain points
- Prioritizes using MoSCoW framework (Must/Should/Could/Won't)
- Organizes features into development phases
- **Output**: `roadmap.json`

### Optional: Competitor Analysis

When enabled with `--competitor-analysis`, a separate agent performs web research on competitors to identify pain points and market gaps that inform feature prioritization.

## File Structure

```
apps/backend/runners/roadmap/
├── CLAUDE.md                  # This file
├── __init__.py                # Package exports
├── orchestrator.py            # Main orchestration logic
├── phases.py                  # Phase execution (Discovery, Features)
├── executor.py                # Agent execution wrapper
├── competitor_analyzer.py     # Optional competitor research
├── graph_integration.py       # Graphiti memory integration
├── models.py                  # Data models
└── project_index.json         # Project indexing template
```

## Usage

### Basic Usage

```bash
cd apps/backend

# Generate roadmap for current directory
python roadmap_runner.py

# Generate roadmap for specific project
python roadmap_runner.py --project /path/to/project

# Force regeneration even if roadmap exists
python roadmap_runner.py --project /path/to/project --refresh

# Custom output location
python roadmap_runner.py --output /custom/path
```

### Advanced Options

```bash
# Use different model
python roadmap_runner.py --model opus

# Enable extended thinking
python roadmap_runner.py --thinking-level high

# Enable competitor analysis
python roadmap_runner.py --competitor-analysis

# Refresh competitor analysis data
python roadmap_runner.py --competitor-analysis --refresh-competitor-analysis
```

## Output Files

All output is stored in `.auto-claude/roadmap/` within the project directory (or custom `--output` path):

### Core Files

**`roadmap_discovery.json`** - Project understanding
```json
{
  "project_name": "Auto Claude",
  "project_type": "desktop-app",
  "tech_stack": {
    "primary_language": "TypeScript",
    "frameworks": ["Electron", "React"],
    "key_dependencies": ["claude-agent-sdk"]
  },
  "target_audience": {
    "primary_persona": "Software developers building AI features",
    "pain_points": ["Manual coding is slow", "Complex AI integration"],
    "goals": ["Build features faster", "Leverage AI effectively"]
  },
  "product_vision": {
    "one_liner": "AI-powered autonomous coding framework",
    "value_proposition": "Build software through coordinated AI agents"
  },
  "current_state": {
    "maturity": "growth",
    "existing_features": ["Multi-agent builds", "Git worktrees"],
    "known_gaps": ["Mobile support", "Cloud deployment"]
  }
}
```

**`roadmap.json`** - Complete roadmap
```json
{
  "id": "roadmap-2026-01-11",
  "project_name": "Auto Claude",
  "version": "1.0",
  "vision": "AI-powered autonomous coding framework",
  "phases": [
    {
      "id": "phase-1",
      "name": "Foundation",
      "order": 1,
      "features": ["feature-1", "feature-2"]
    }
  ],
  "features": [
    {
      "id": "feature-1",
      "title": "Conda Environment Support",
      "description": "Auto-activate Python virtual environments",
      "rationale": "Developers need isolated dependencies",
      "priority": "must",
      "complexity": "medium",
      "impact": "high",
      "phase_id": "phase-1",
      "acceptance_criteria": [
        "Settings UI for activation script",
        "Auto-activation in terminals"
      ],
      "user_stories": [
        "As a developer, I want conda environments to auto-activate so I don't manually configure each terminal"
      ]
    }
  ]
}
```

**`project_index.json`** - Project structure snapshot
```json
{
  "root": "/path/to/project",
  "files": [
    {"path": "README.md", "type": "documentation"},
    {"path": "src/main.ts", "type": "source"}
  ],
  "directories": ["src", "tests"]
}
```

### Optional Files

**`competitor_analysis.json`** - Competitor research (when `--competitor-analysis` enabled)
```json
{
  "competitors": [
    {
      "name": "Competitor X",
      "pain_points": [
        {"id": "cp-1", "description": "Slow setup process"}
      ],
      "strengths": ["Feature Y"],
      "weaknesses": ["Missing Z"]
    }
  ],
  "insights_summary": {
    "top_pain_points": ["Slow setup", "Complex config"],
    "market_gaps": ["User-friendly UX", "One-click install"],
    "differentiator_opportunities": ["Auto-configuration"]
  }
}
```

## Key Concepts

### Prioritization (MoSCoW Framework)

- **Must** - Critical for MVP, without this the product doesn't work
- **Should** - Important but not critical, strong business value
- **Could** - Nice-to-have, adds value but can wait
- **Won't** - Explicitly out of scope for current phase

### Feature Complexity

- **low** - Simple, 1-2 days of work
- **medium** - Moderate, 3-7 days of work
- **high** - Complex, 1-2 weeks of work

### Feature Impact

- **low** - Affects small subset of users or edge cases
- **medium** - Affects significant portion of users
- **high** - Affects all users or core value proposition

### Development Phases

1. **Foundation/MVP** - Core features, makes product usable
2. **Growth** - Expands audience, adds major capabilities
3. **Scale** - Performance, reliability, enterprise features
4. **Innovation** - Experimental, cutting-edge features

## Integration with Main CLAUDE.md

Add this section to the main CLAUDE.md:

```markdown
### Roadmap Generation
```bash
cd apps/backend

# Generate strategic feature roadmap
python roadmap_runner.py --project /path/to/project

# Enable competitor analysis for market insights
python roadmap_runner.py --competitor-analysis

# Force refresh existing roadmap
python roadmap_runner.py --refresh
```

Output stored in `.auto-claude/roadmap/`:
- `roadmap_discovery.json` - Project understanding and target audience
- `roadmap.json` - Prioritized features organized into phases
- `competitor_analysis.json` - Market research insights (optional)
```

## Common Issues

### Issue: "Project directory does not exist"
**Solution**: Provide absolute path or ensure current directory is correct
```bash
python roadmap_runner.py --project "$(pwd)"
```

### Issue: Discovery agent asks questions instead of autonomous analysis
**Root Cause**: Agent prompt violation
**Solution**: Check that prompts explicitly state "NON-INTERACTIVE" and "DO NOT ask questions"

### Issue: roadmap_discovery.json not created
**Root Cause**: Agent didn't follow prompt instructions
**Solution**:
1. Check agent logs for errors
2. Verify output directory exists and is writable
3. Re-run with `--refresh` flag

### Issue: Features seem generic or not tailored to project
**Root Cause**: Poor target audience discovery
**Solution**:
1. Improve README.md with clear target audience description
2. Add documentation about user pain points
3. Enable competitor analysis for market context
4. Review `roadmap_discovery.json` and manually improve target audience section

### Issue: Competitor analysis fails or returns poor results
**Root Cause**: Web search limitations or vague project domain
**Solution**:
1. Ensure project README clearly describes the domain
2. Verify internet connectivity
3. Check that competitor names are discoverable via search
4. Review competitor_analysis.json and manually add missing insights

## Development Guidelines

### Adding New Phase

1. Create phase class in `phases.py`:
```python
class MyNewPhase(RoadmapPhase):
    def __init__(self, orchestrator: 'RoadmapOrchestrator'):
        super().__init__(
            name="my_new_phase",
            description="What this phase does",
            output_file="my_output.json"
        )
```

2. Add to orchestrator pipeline in `orchestrator.py`:
```python
phases = [
    DiscoveryPhase(self),
    MyNewPhase(self),  # NEW
    FeaturesPhase(self)
]
```

3. Create prompt in `apps/backend/prompts/roadmap_myname.md`

### Testing

```bash
# Test on sample project
cd /tmp
mkdir test-project
cd test-project
echo "# Test Project" > README.md
python /path/to/roadmap_runner.py --project .

# Verify outputs
cat .auto-claude/roadmap/roadmap_discovery.json
cat .auto-claude/roadmap/roadmap.json
```

### Debugging

Enable debug output:
```python
from debug import debug, debug_error

debug("roadmap", "Starting discovery", project=project_dir)
```

Check agent logs:
```bash
# Logs are written to stdout during execution
python roadmap_runner.py --project . 2>&1 | tee roadmap.log
```

## Frontend Integration

The roadmap is accessible via the Electron frontend:

**UI Location**: Sidebar → Roadmap

**IPC Handlers**: `apps/frontend/src/main/ipc-handlers/roadmap-handlers.ts`

**Store**: `apps/frontend/src/renderer/stores/roadmap-store.ts`

**API**: `apps/frontend/src/preload/api/modules/roadmap-api.ts`

## Related Features

- **Spec Runner**: Uses similar multi-phase agent pipeline
- **Graphiti Memory**: Stores roadmap insights for future reference
- **Project Analyzer**: Shares project indexing logic

## Best Practices

1. **Run early** - Generate roadmap before starting implementation
2. **Iterate** - Use `--refresh` as project evolves
3. **Document** - Keep README.md updated with target audience
4. **Validate** - Review generated roadmap, adjust manually if needed
5. **Integrate** - Reference roadmap when creating specs
6. **Enable competitor analysis** - For market-driven feature prioritization
7. **Version control** - Commit roadmap files to track evolution

## Future Enhancements

- **Interactive refinement** - Allow user to provide feedback and regenerate
- **Roadmap diff** - Show changes between versions
- **Export formats** - Markdown, PDF, Jira/Linear integration
- **AI chat** - Ask questions about the roadmap
- **Progress tracking** - Link features to implementation specs
