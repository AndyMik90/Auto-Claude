"""
Roadmap generation orchestrator.

Coordinates all phases of the roadmap generation process.
Supports checkpoint/resume to recover from interruptions (rate limits, token exhaustion).
"""

import asyncio
import json
from dataclasses import asdict
from pathlib import Path

from client import create_client
from debug import debug, debug_error, debug_section, debug_success, debug_warning
from init import init_auto_claude_dir
from phase_config import get_thinking_budget
from ui import Icons, box, icon, muted, print_section, print_status

from .competitor_analyzer import CompetitorAnalyzer
from .executor import AgentExecutor, ScriptExecutor
from .graph_integration import GraphHintsProvider
from .models import PhaseCheckpoint, RoadmapCheckpoint
from .phases import DiscoveryPhase, FeaturesPhase, ProjectIndexPhase

# Checkpoint filename
CHECKPOINT_FILE = "roadmap.checkpoint.json"


class RoadmapOrchestrator:
    """Orchestrates the roadmap creation process.

    Supports checkpoint/resume to recover from interruptions such as:
    - Rate limits (Claude API limits)
    - Token exhaustion (running out of context/tokens)
    - Process crashes or user interruption

    Checkpoints are saved after each phase completes. When resuming,
    completed phases are skipped and only remaining phases are executed.
    """

    def __init__(
        self,
        project_dir: Path,
        output_dir: Path | None = None,
        model: str = "sonnet",  # Changed from "opus" (fix #433)
        thinking_level: str = "medium",
        refresh: bool = False,
        enable_competitor_analysis: bool = False,
        refresh_competitor_analysis: bool = False,
    ):
        self.project_dir = Path(project_dir)
        self.model = model
        self.thinking_level = thinking_level
        self.thinking_budget = get_thinking_budget(thinking_level)
        self.refresh = refresh
        self.enable_competitor_analysis = enable_competitor_analysis
        self.refresh_competitor_analysis = refresh_competitor_analysis

        # Default output to project's .auto-claude directory (installed instance)
        # Note: auto-claude/ is source code, .auto-claude/ is the installed instance
        if output_dir:
            self.output_dir = Path(output_dir)
        else:
            # Initialize .auto-claude directory and ensure it's in .gitignore
            init_auto_claude_dir(self.project_dir)
            self.output_dir = self.project_dir / ".auto-claude" / "roadmap"

        self.output_dir.mkdir(parents=True, exist_ok=True)

        # Checkpoint file path
        self.checkpoint_file = self.output_dir / CHECKPOINT_FILE

        # Load or create checkpoint
        self.checkpoint = self._load_checkpoint()

        # Initialize executors
        self.script_executor = ScriptExecutor(self.project_dir)
        self.agent_executor = AgentExecutor(
            self.project_dir,
            self.output_dir,
            self.model,
            create_client,
            self.thinking_budget,
        )

        # Initialize phase handlers
        self.graph_hints_provider = GraphHintsProvider(
            self.output_dir, self.project_dir, self.refresh
        )
        # Competitor analyzer refreshes if either general refresh or specific competitor refresh
        competitor_should_refresh = self.refresh or self.refresh_competitor_analysis
        self.competitor_analyzer = CompetitorAnalyzer(
            self.output_dir, competitor_should_refresh, self.agent_executor
        )
        self.project_index_phase = ProjectIndexPhase(
            self.output_dir, self.refresh, self.script_executor
        )
        self.discovery_phase = DiscoveryPhase(
            self.output_dir, self.refresh, self.agent_executor
        )
        self.features_phase = FeaturesPhase(
            self.output_dir, self.refresh, self.agent_executor
        )

        debug_section("roadmap_orchestrator", "Roadmap Orchestrator Initialized")
        debug(
            "roadmap_orchestrator",
            "Configuration",
            project_dir=str(self.project_dir),
            output_dir=str(self.output_dir),
            model=self.model,
            refresh=self.refresh,
            checkpoint_phases=self.checkpoint.get_completed_phase_names(),
        )

    def _load_checkpoint(self) -> RoadmapCheckpoint:
        """Load checkpoint from file if it exists and refresh is not enabled."""
        if self.refresh:
            debug("roadmap_orchestrator", "Refresh enabled - ignoring checkpoint")
            return RoadmapCheckpoint(model=self.model, thinking_level=self.thinking_level)

        if not self.checkpoint_file.exists():
            debug("roadmap_orchestrator", "No checkpoint file found - starting fresh")
            return RoadmapCheckpoint(model=self.model, thinking_level=self.thinking_level)

        try:
            with open(self.checkpoint_file, encoding="utf-8") as f:
                data = json.load(f)

            # Check for model/config mismatch
            if data.get("model") != self.model:
                debug_warning(
                    "roadmap_orchestrator",
                    "Model mismatch - checkpoint ignored",
                    checkpoint_model=data.get("model"),
                    current_model=self.model,
                )
                return RoadmapCheckpoint(model=self.model, thinking_level=self.thinking_level)

            # Reconstruct checkpoint
            completed_phases = [
                PhaseCheckpoint(**p) for p in data.get("completed_phases", [])
            ]
            checkpoint = RoadmapCheckpoint(
                version=data.get("version", 1),
                started_at=data.get("started_at", ""),
                last_updated=data.get("last_updated", ""),
                completed_phases=completed_phases,
                model=data.get("model", self.model),
                thinking_level=data.get("thinking_level", self.thinking_level),
            )

            completed = checkpoint.get_completed_phase_names()
            if completed:
                debug_success(
                    "roadmap_orchestrator",
                    f"Loaded checkpoint - resuming from phase after: {completed[-1]}",
                    completed_phases=completed,
                )
                print_status(
                    f"Resuming from checkpoint (completed: {', '.join(completed)})",
                    "success",
                )

            return checkpoint

        except (json.JSONDecodeError, TypeError, KeyError) as e:
            debug_warning(
                "roadmap_orchestrator",
                "Failed to load checkpoint - starting fresh",
                error=str(e),
            )
            return RoadmapCheckpoint(model=self.model, thinking_level=self.thinking_level)

    def _save_checkpoint(self) -> None:
        """Save current checkpoint state to file."""
        try:
            # Convert to dict, handling nested dataclasses
            data = {
                "version": self.checkpoint.version,
                "started_at": self.checkpoint.started_at,
                "last_updated": self.checkpoint.last_updated,
                "model": self.checkpoint.model,
                "thinking_level": self.checkpoint.thinking_level,
                "completed_phases": [asdict(p) for p in self.checkpoint.completed_phases],
            }

            with open(self.checkpoint_file, "w", encoding="utf-8") as f:
                json.dump(data, f, indent=2)

            debug(
                "roadmap_orchestrator",
                "Checkpoint saved",
                phases=self.checkpoint.get_completed_phase_names(),
            )

        except OSError as e:
            debug_error(
                "roadmap_orchestrator",
                "Failed to save checkpoint",
                error=str(e),
            )

    def _clear_checkpoint(self) -> None:
        """Remove checkpoint file after successful completion."""
        try:
            if self.checkpoint_file.exists():
                self.checkpoint_file.unlink()
                debug("roadmap_orchestrator", "Checkpoint cleared after successful completion")
        except OSError as e:
            debug_warning(
                "roadmap_orchestrator",
                "Failed to clear checkpoint file",
                error=str(e),
            )

    def _should_skip_phase(self, phase_name: str) -> bool:
        """Check if a phase should be skipped (already completed in checkpoint)."""
        if self.refresh:
            return False
        return self.checkpoint.is_phase_complete(phase_name)

    async def run(self) -> bool:
        """Run the complete roadmap generation process with optional competitor analysis.

        Supports checkpoint/resume: if a previous run was interrupted, completed phases
        will be skipped and only remaining phases will be executed.
        """
        debug_section("roadmap_orchestrator", "Starting Roadmap Generation")
        debug(
            "roadmap_orchestrator",
            "Run configuration",
            project_dir=str(self.project_dir),
            output_dir=str(self.output_dir),
            model=self.model,
            refresh=self.refresh,
            resuming_from_checkpoint=bool(self.checkpoint.completed_phases),
        )

        # Show status with checkpoint info
        checkpoint_info = ""
        if self.checkpoint.completed_phases and not self.refresh:
            completed = self.checkpoint.get_completed_phase_names()
            checkpoint_info = f"\nResuming: skipping {', '.join(completed)}"

        print(
            box(
                f"Project: {self.project_dir}\n"
                f"Output: {self.output_dir}\n"
                f"Model: {self.model}\n"
                f"Competitor Analysis: {'enabled' if self.enable_competitor_analysis else 'disabled'}"
                f"{checkpoint_info}",
                title="ROADMAP GENERATOR",
                style="heavy",
            )
        )
        results = []

        # Phase 1: Project Index & Graph Hints (in parallel)
        phase1_index_skip = self._should_skip_phase("project_index")
        phase1_hints_skip = self._should_skip_phase("graph_hints")

        if phase1_index_skip and phase1_hints_skip:
            debug("roadmap_orchestrator", "Phase 1: Skipping (checkpoint)")
            print_section("PHASE 1: PROJECT ANALYSIS & GRAPH HINTS", Icons.FOLDER)
            print_status("Skipped (completed in previous run)", "success")
        else:
            debug(
                "roadmap_orchestrator",
                "Starting Phase 1: Project Analysis & Graph Hints (parallel)",
            )
            print_section("PHASE 1: PROJECT ANALYSIS & GRAPH HINTS", Icons.FOLDER)

            # Run project index and graph hints in parallel (only if not checkpointed)
            tasks = []
            if not phase1_index_skip:
                tasks.append(("index", self.project_index_phase.execute()))
            if not phase1_hints_skip:
                tasks.append(("hints", self.graph_hints_provider.retrieve_hints()))

            if tasks:
                task_results = await asyncio.gather(*[t[1] for t in tasks])
                task_map = dict(zip([t[0] for t in tasks], task_results))

                if "index" in task_map:
                    index_result = task_map["index"]
                    results.append(index_result)
                    self.checkpoint.mark_phase_complete(index_result)
                    self._save_checkpoint()

                    if not index_result.success:
                        debug_error(
                            "roadmap_orchestrator",
                            "Project analysis failed - aborting roadmap generation",
                        )
                        print_status("Project analysis failed", "error")
                        return False

                if "hints" in task_map:
                    hints_result = task_map["hints"]
                    results.append(hints_result)
                    self.checkpoint.mark_phase_complete(hints_result)
                    self._save_checkpoint()

            debug(
                "roadmap_orchestrator",
                "Phase 1 complete",
            )

        # Phase 2: Discovery
        if self._should_skip_phase("discovery"):
            debug("roadmap_orchestrator", "Phase 2: Skipping (checkpoint)")
            print_section("PHASE 2: PROJECT DISCOVERY", Icons.SEARCH)
            print_status("Skipped (completed in previous run)", "success")
        else:
            debug("roadmap_orchestrator", "Starting Phase 2: Project Discovery")
            print_section("PHASE 2: PROJECT DISCOVERY", Icons.SEARCH)
            result = await self.discovery_phase.execute()
            results.append(result)

            # Save checkpoint after discovery
            self.checkpoint.mark_phase_complete(result)
            self._save_checkpoint()

            if not result.success:
                debug_error(
                    "roadmap_orchestrator",
                    "Discovery failed - aborting roadmap generation",
                    errors=result.errors,
                )
                print_status("Discovery failed (checkpoint saved for resume)", "error")
                for err in result.errors:
                    print(f"  {muted('Error:')} {err}")
                return False
            debug_success("roadmap_orchestrator", "Phase 2 complete")

        # Phase 2.5: Competitor Analysis (optional, runs after discovery)
        if self._should_skip_phase("competitor_analysis"):
            debug("roadmap_orchestrator", "Phase 2.5: Skipping (checkpoint)")
            print_section("PHASE 2.5: COMPETITOR ANALYSIS", Icons.SEARCH)
            print_status("Skipped (completed in previous run)", "success")
        else:
            print_section("PHASE 2.5: COMPETITOR ANALYSIS", Icons.SEARCH)
            competitor_result = await self.competitor_analyzer.analyze(
                enabled=self.enable_competitor_analysis
            )
            results.append(competitor_result)

            # Save checkpoint after competitor analysis
            self.checkpoint.mark_phase_complete(competitor_result)
            self._save_checkpoint()
            # Note: competitor_result.success is always True (graceful degradation)

        # Phase 3: Feature Generation
        if self._should_skip_phase("features"):
            debug("roadmap_orchestrator", "Phase 3: Skipping (checkpoint)")
            print_section("PHASE 3: FEATURE GENERATION", Icons.SUBTASK)
            print_status("Skipped (completed in previous run)", "success")
        else:
            debug("roadmap_orchestrator", "Starting Phase 3: Feature Generation")
            print_section("PHASE 3: FEATURE GENERATION", Icons.SUBTASK)
            result = await self.features_phase.execute()
            results.append(result)

            # Save checkpoint after features
            self.checkpoint.mark_phase_complete(result)
            self._save_checkpoint()

            if not result.success:
                debug_error(
                    "roadmap_orchestrator",
                    "Feature generation failed - aborting",
                    errors=result.errors,
                )
                print_status("Feature generation failed (checkpoint saved for resume)", "error")
                for err in result.errors:
                    print(f"  {muted('Error:')} {err}")
                return False
            debug_success("roadmap_orchestrator", "Phase 3 complete")

        # Success - clear checkpoint
        self._clear_checkpoint()

        # Summary
        self._print_summary()
        return True

    def _print_summary(self):
        """Print the final roadmap generation summary."""
        roadmap_file = self.output_dir / "roadmap.json"
        if not roadmap_file.exists():
            return

        with open(roadmap_file, encoding="utf-8") as f:
            roadmap = json.load(f)

        features = roadmap.get("features", [])
        phases = roadmap.get("phases", [])

        # Count by priority
        priority_counts = {}
        for f in features:
            p = f.get("priority", "unknown")
            priority_counts[p] = priority_counts.get(p, 0) + 1

        debug_success(
            "roadmap_orchestrator",
            "Roadmap generation complete",
            phase_count=len(phases),
            feature_count=len(features),
            priority_breakdown=priority_counts,
        )

        print(
            box(
                f"Vision: {roadmap.get('vision', 'N/A')}\n"
                f"Phases: {len(phases)}\n"
                f"Features: {len(features)}\n\n"
                f"Priority breakdown:\n"
                + "\n".join(
                    f"  {icon(Icons.ARROW_RIGHT)} {p.upper()}: {c}"
                    for p, c in priority_counts.items()
                )
                + f"\n\nRoadmap saved to: {roadmap_file}",
                title=f"{icon(Icons.SUCCESS)} ROADMAP GENERATED",
                style="heavy",
            )
        )
