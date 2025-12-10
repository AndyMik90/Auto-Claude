#!/usr/bin/env python3
"""
Spec Creation Orchestrator
==========================

Dynamic spec creation with complexity-based phase selection.
The orchestrator uses AI to evaluate task complexity and adapts its process accordingly.

Complexity Assessment:
- By default, uses AI (complexity_assessor.md prompt) to analyze the task
- AI considers: scope, integrations, infrastructure, knowledge requirements, risk
- Falls back to heuristic analysis if AI assessment fails
- Use --no-ai-assessment to skip AI and use heuristics only

Complexity Tiers:
- SIMPLE (1-2 files): Discovery → Quick Spec → Validate (3 phases)
- STANDARD (3-10 files): Discovery → Requirements → Context → Spec → Plan → Validate (6 phases)
- STANDARD + Research: Same as above but with research phase for external dependencies (7 phases)
- COMPLEX (10+ files/integrations): Full 8-phase pipeline with research and self-critique

The AI considers:
- Number of files/services involved
- External integrations and research requirements
- Infrastructure changes (Docker, databases, etc.)
- Whether codebase has existing patterns to follow
- Risk factors and edge cases

Usage:
    python auto-build/spec_runner.py --task "Add user authentication"
    python auto-build/spec_runner.py --interactive
    python auto-build/spec_runner.py --continue 001-feature
    python auto-build/spec_runner.py --task "Fix button color" --complexity simple
    python auto-build/spec_runner.py --task "Simple fix" --no-ai-assessment
"""

import asyncio
import json
import os
import re
import subprocess
import sys
from dataclasses import dataclass, field
from datetime import datetime
from enum import Enum
from pathlib import Path
from typing import Optional

# Add auto-build to path
sys.path.insert(0, str(Path(__file__).parent))

# Load .env file - check both auto-build/ and dev/auto-build/ locations
from dotenv import load_dotenv
env_file = Path(__file__).parent / ".env"
dev_env_file = Path(__file__).parent.parent / "dev" / "auto-build" / ".env"
if env_file.exists():
    load_dotenv(env_file)
elif dev_env_file.exists():
    load_dotenv(dev_env_file)

from client import create_client
from validate_spec import SpecValidator, auto_fix_plan
from ui import (
    Icons,
    icon,
    box,
    success,
    error,
    warning,
    info,
    muted,
    highlight,
    bold,
    print_status,
    print_key_value,
    print_section,
    StatusManager,
    BuildState,
)


# Configuration
MAX_RETRIES = 3
PROMPTS_DIR = Path(__file__).parent / "prompts"

# Default specs directory (production mode)
DEFAULT_SPECS_DIR = Path(__file__).parent / "specs"
# Dev specs directory (--dev mode) - gitignored, for developing auto-build itself
DEV_SPECS_DIR = Path(__file__).parent.parent / "dev" / "auto-build" / "specs"


def get_specs_dir(dev_mode: bool = False) -> Path:
    """Get the specs directory based on mode."""
    if dev_mode:
        return DEV_SPECS_DIR
    return DEFAULT_SPECS_DIR


class Complexity(Enum):
    """Task complexity tiers that determine which phases to run."""
    SIMPLE = "simple"      # 1-2 files, single service, no integrations
    STANDARD = "standard"  # 3-10 files, 1-2 services, minimal integrations
    COMPLEX = "complex"    # 10+ files, multiple services, external integrations


@dataclass
class ComplexityAssessment:
    """Result of analyzing task complexity."""
    complexity: Complexity
    confidence: float  # 0.0 to 1.0
    signals: dict = field(default_factory=dict)
    reasoning: str = ""

    # Detected characteristics
    estimated_files: int = 1
    estimated_services: int = 1
    external_integrations: list = field(default_factory=list)
    infrastructure_changes: bool = False
    
    # AI-recommended phases (if using AI assessment)
    recommended_phases: list = field(default_factory=list)
    
    # Flags from AI assessment
    needs_research: bool = False
    needs_self_critique: bool = False

    def phases_to_run(self) -> list[str]:
        """Return list of phase names to run based on complexity."""
        # If AI provided recommended phases, use those
        if self.recommended_phases:
            return self.recommended_phases
        
        # Otherwise fall back to default phase sets
        if self.complexity == Complexity.SIMPLE:
            return ["discovery", "quick_spec", "validation"]
        elif self.complexity == Complexity.STANDARD:
            # Standard can optionally include research if flagged
            phases = ["discovery", "requirements"]
            if self.needs_research:
                phases.append("research")
            phases.extend(["context", "spec_writing", "planning", "validation"])
            return phases
        else:  # COMPLEX
            return ["discovery", "requirements", "research", "context", "spec_writing", "self_critique", "planning", "validation"]


class ComplexityAnalyzer:
    """Analyzes task description and context to determine complexity."""

    # Keywords that suggest different complexity levels
    SIMPLE_KEYWORDS = [
        "fix", "typo", "update", "change", "rename", "remove", "delete",
        "adjust", "tweak", "correct", "modify", "style", "color", "text",
        "label", "button", "margin", "padding", "font", "size", "hide", "show"
    ]

    COMPLEX_KEYWORDS = [
        "integrate", "integration", "api", "sdk", "library", "package",
        "database", "migrate", "migration", "docker", "kubernetes", "deploy",
        "authentication", "oauth", "graphql", "websocket", "queue", "cache",
        "redis", "postgres", "mongo", "elasticsearch", "kafka", "rabbitmq",
        "microservice", "refactor", "architecture", "infrastructure"
    ]

    MULTI_SERVICE_KEYWORDS = [
        "backend", "frontend", "worker", "service", "api", "client",
        "server", "database", "queue", "cache", "proxy"
    ]

    def __init__(self, project_index: Optional[dict] = None):
        self.project_index = project_index or {}

    def analyze(self, task_description: str, requirements: Optional[dict] = None) -> ComplexityAssessment:
        """Analyze task and return complexity assessment."""
        task_lower = task_description.lower()
        signals = {}

        # 1. Keyword analysis
        simple_matches = sum(1 for kw in self.SIMPLE_KEYWORDS if kw in task_lower)
        complex_matches = sum(1 for kw in self.COMPLEX_KEYWORDS if kw in task_lower)
        multi_service_matches = sum(1 for kw in self.MULTI_SERVICE_KEYWORDS if kw in task_lower)

        signals["simple_keywords"] = simple_matches
        signals["complex_keywords"] = complex_matches
        signals["multi_service_keywords"] = multi_service_matches

        # 2. External integrations detection
        integrations = self._detect_integrations(task_lower)
        signals["external_integrations"] = len(integrations)

        # 3. Infrastructure changes detection
        infra_changes = self._detect_infrastructure_changes(task_lower)
        signals["infrastructure_changes"] = infra_changes

        # 4. Estimate files and services
        estimated_files = self._estimate_files(task_lower, requirements)
        estimated_services = self._estimate_services(task_lower, requirements)
        signals["estimated_files"] = estimated_files
        signals["estimated_services"] = estimated_services

        # 5. Requirements-based signals (if available)
        if requirements:
            services_involved = requirements.get("services_involved", [])
            signals["explicit_services"] = len(services_involved)
            estimated_services = max(estimated_services, len(services_involved))

        # Determine complexity
        complexity, confidence, reasoning = self._calculate_complexity(
            signals, integrations, infra_changes, estimated_files, estimated_services
        )

        return ComplexityAssessment(
            complexity=complexity,
            confidence=confidence,
            signals=signals,
            reasoning=reasoning,
            estimated_files=estimated_files,
            estimated_services=estimated_services,
            external_integrations=integrations,
            infrastructure_changes=infra_changes,
        )

    def _detect_integrations(self, task_lower: str) -> list[str]:
        """Detect external integrations mentioned in task."""
        integration_patterns = [
            r'\b(graphiti|graphql|apollo)\b',
            r'\b(stripe|paypal|payment)\b',
            r'\b(auth0|okta|oauth|jwt)\b',
            r'\b(aws|gcp|azure|s3|lambda)\b',
            r'\b(redis|memcached|cache)\b',
            r'\b(postgres|mysql|mongodb|database)\b',
            r'\b(elasticsearch|algolia|search)\b',
            r'\b(kafka|rabbitmq|sqs|queue)\b',
            r'\b(docker|kubernetes|k8s)\b',
            r'\b(openai|anthropic|llm|ai)\b',
            r'\b(sendgrid|twilio|email|sms)\b',
        ]

        found = []
        for pattern in integration_patterns:
            matches = re.findall(pattern, task_lower)
            found.extend(matches)

        return list(set(found))

    def _detect_infrastructure_changes(self, task_lower: str) -> bool:
        """Detect if task involves infrastructure changes."""
        infra_patterns = [
            r'\bdocker\b', r'\bkubernetes\b', r'\bk8s\b',
            r'\bdeploy\b', r'\binfrastructure\b', r'\bci/cd\b',
            r'\benvironment\b', r'\bconfig\b', r'\b\.env\b',
            r'\bdatabase migration\b', r'\bschema\b',
        ]

        for pattern in infra_patterns:
            if re.search(pattern, task_lower):
                return True
        return False

    def _estimate_files(self, task_lower: str, requirements: Optional[dict]) -> int:
        """Estimate number of files to be modified."""
        # Base estimate from task description
        if any(kw in task_lower for kw in ["single", "one file", "one component", "this file"]):
            return 1

        # Check for explicit file mentions
        file_mentions = len(re.findall(r'\.(tsx?|jsx?|py|go|rs|java|rb|php|vue|svelte)\b', task_lower))
        if file_mentions > 0:
            return max(1, file_mentions)

        # Heuristic based on task scope
        if any(kw in task_lower for kw in self.SIMPLE_KEYWORDS):
            return 2
        elif any(kw in task_lower for kw in ["feature", "add", "implement", "create"]):
            return 5
        elif any(kw in task_lower for kw in self.COMPLEX_KEYWORDS):
            return 15

        return 5  # Default estimate

    def _estimate_services(self, task_lower: str, requirements: Optional[dict]) -> int:
        """Estimate number of services involved."""
        service_count = sum(1 for kw in self.MULTI_SERVICE_KEYWORDS if kw in task_lower)

        # If project is a monorepo, check project_index
        if self.project_index.get("project_type") == "monorepo":
            services = self.project_index.get("services", {})
            if services:
                # Check which services are mentioned
                mentioned = sum(1 for svc in services if svc.lower() in task_lower)
                if mentioned > 0:
                    return mentioned

        return max(1, min(service_count, 5))

    def _calculate_complexity(
        self,
        signals: dict,
        integrations: list,
        infra_changes: bool,
        estimated_files: int,
        estimated_services: int,
    ) -> tuple[Complexity, float, str]:
        """Calculate final complexity based on all signals."""

        reasons = []

        # Strong indicators for SIMPLE
        if (
            estimated_files <= 2 and
            estimated_services == 1 and
            len(integrations) == 0 and
            not infra_changes and
            signals["simple_keywords"] > 0 and
            signals["complex_keywords"] == 0
        ):
            reasons.append(f"Single service, {estimated_files} file(s), no integrations")
            return Complexity.SIMPLE, 0.9, "; ".join(reasons)

        # Strong indicators for COMPLEX
        if (
            len(integrations) >= 2 or
            infra_changes or
            estimated_services >= 3 or
            estimated_files >= 10 or
            signals["complex_keywords"] >= 3
        ):
            reasons.append(f"{len(integrations)} integrations, {estimated_services} services, {estimated_files} files")
            if infra_changes:
                reasons.append("infrastructure changes detected")
            return Complexity.COMPLEX, 0.85, "; ".join(reasons)

        # Default to STANDARD
        reasons.append(f"{estimated_files} files, {estimated_services} service(s)")
        if len(integrations) > 0:
            reasons.append(f"{len(integrations)} integration(s)")

        return Complexity.STANDARD, 0.75, "; ".join(reasons)


@dataclass
class PhaseResult:
    """Result of a phase execution."""
    phase: str
    success: bool
    output_files: list[str]
    errors: list[str]
    retries: int


class SpecOrchestrator:
    """Orchestrates the spec creation process with dynamic complexity adaptation."""

    def __init__(
        self,
        project_dir: Path,
        task_description: Optional[str] = None,
        spec_name: Optional[str] = None,
        model: str = "claude-opus-4-5-20251101",
        complexity_override: Optional[str] = None,  # Force a specific complexity
        use_ai_assessment: bool = True,  # Use AI for complexity assessment (vs heuristics)
        dev_mode: bool = False,  # Dev mode: specs in gitignored folder, code changes to auto-build/
    ):
        self.project_dir = Path(project_dir)
        self.task_description = task_description
        self.model = model
        self.complexity_override = complexity_override
        self.use_ai_assessment = use_ai_assessment
        self.dev_mode = dev_mode

        # Get the appropriate specs directory
        self.specs_dir = get_specs_dir(dev_mode)

        # Complexity assessment (populated during run)
        self.assessment: Optional[ComplexityAssessment] = None

        # Create spec directory
        if spec_name:
            self.spec_dir = self.specs_dir / spec_name
        else:
            self.spec_dir = self._create_spec_dir()

        self.spec_dir.mkdir(parents=True, exist_ok=True)
        self.validator = SpecValidator(self.spec_dir)

    def _create_spec_dir(self) -> Path:
        """Create a new spec directory with incremented number."""
        existing = list(self.specs_dir.glob("[0-9][0-9][0-9]-*"))
        next_num = len(existing) + 1

        # Generate name from task description
        if self.task_description:
            # Convert to kebab-case
            name = self.task_description.lower()
            name = "".join(c if c.isalnum() or c == " " else "" for c in name)
            name = "-".join(name.split()[:4])  # First 4 words
        else:
            name = "new-spec"

        return self.specs_dir / f"{next_num:03d}-{name}"

    def _run_script(self, script: str, args: list[str]) -> tuple[bool, str]:
        """Run a Python script and return (success, output)."""
        script_path = Path(__file__).parent / script

        if not script_path.exists():
            return False, f"Script not found: {script_path}"

        cmd = [sys.executable, str(script_path)] + args

        try:
            result = subprocess.run(
                cmd,
                cwd=self.project_dir,
                capture_output=True,
                text=True,
                timeout=300,
            )

            if result.returncode == 0:
                return True, result.stdout
            else:
                return False, result.stderr or result.stdout

        except subprocess.TimeoutExpired:
            return False, "Script timed out"
        except Exception as e:
            return False, str(e)

    async def _run_agent(
        self,
        prompt_file: str,
        additional_context: str = "",
        interactive: bool = False,
    ) -> tuple[bool, str]:
        """Run an agent with the given prompt."""
        prompt_path = PROMPTS_DIR / prompt_file

        if not prompt_path.exists():
            return False, f"Prompt not found: {prompt_path}"

        # Load prompt
        prompt = prompt_path.read_text()

        # Add context
        prompt += f"\n\n---\n\n**Spec Directory**: {self.spec_dir}\n"
        prompt += f"**Project Directory**: {self.project_dir}\n"

        if additional_context:
            prompt += f"\n{additional_context}\n"

        # Create client
        client = create_client(self.project_dir, self.spec_dir, self.model)

        try:
            async with client:
                await client.query(prompt)

                response_text = ""
                async for msg in client.receive_response():
                    msg_type = type(msg).__name__

                    if msg_type == "AssistantMessage" and hasattr(msg, "content"):
                        for block in msg.content:
                            block_type = type(block).__name__
                            if block_type == "TextBlock" and hasattr(block, "text"):
                                response_text += block.text
                                print(block.text, end="", flush=True)
                            elif block_type == "ToolUseBlock" and hasattr(block, "name"):
                                print(f"\n[Tool: {block.name}]", flush=True)

                print()
                return True, response_text

        except Exception as e:
            return False, str(e)

    # === Phase Implementations ===

    async def phase_complexity_assessment_with_requirements(self) -> PhaseResult:
        """Assess complexity after requirements are gathered (with full context)."""

        assessment_file = self.spec_dir / "complexity_assessment.json"
        requirements_file = self.spec_dir / "requirements.json"

        # Load requirements for full context
        requirements_context = ""
        if requirements_file.exists():
            with open(requirements_file) as f:
                req = json.load(f)
                self.task_description = req.get("task_description", self.task_description)
                requirements_context = f"""
**Task Description**: {req.get('task_description', 'Not provided')}
**Workflow Type**: {req.get('workflow_type', 'Not specified')}
**Services Involved**: {', '.join(req.get('services_involved', []))}
**User Requirements**:
{chr(10).join(f'- {r}' for r in req.get('user_requirements', []))}
**Acceptance Criteria**:
{chr(10).join(f'- {c}' for c in req.get('acceptance_criteria', []))}
**Constraints**:
{chr(10).join(f'- {c}' for c in req.get('constraints', []))}
"""

        if self.complexity_override:
            # Manual override
            complexity = Complexity(self.complexity_override)
            self.assessment = ComplexityAssessment(
                complexity=complexity,
                confidence=1.0,
                reasoning=f"Manual override: {self.complexity_override}",
            )
            print_status(f"Complexity override: {complexity.value.upper()}", "success")
        elif self.use_ai_assessment:
            # Run AI assessment with full requirements context
            print_status("Running AI complexity assessment...", "progress")
            self.assessment = await self._run_ai_complexity_assessment(requirements_context)
            
            if self.assessment:
                print_status(f"AI assessed complexity: {highlight(self.assessment.complexity.value.upper())}", "success")
                print_key_value("Confidence", f"{self.assessment.confidence:.0%}")
                print_key_value("Reasoning", self.assessment.reasoning)
                
                # Show flags if set
                if self.assessment.needs_research:
                    print(f"  {muted('→ Research phase enabled')}")
                if self.assessment.needs_self_critique:
                    print(f"  {muted('→ Self-critique phase enabled')}")
            else:
                # Fall back to heuristic assessment
                print_status("AI assessment failed, falling back to heuristics...", "warning")
                self.assessment = self._heuristic_assessment()
                print_status(f"Assessed complexity: {highlight(self.assessment.complexity.value.upper())}", "success")
        else:
            # Use heuristic assessment
            self.assessment = self._heuristic_assessment()
            print_status(f"Assessed complexity: {highlight(self.assessment.complexity.value.upper())}", "success")
            print_key_value("Confidence", f"{self.assessment.confidence:.0%}")
            print_key_value("Reasoning", self.assessment.reasoning)

        # Show what phases will run
        phases = self.assessment.phases_to_run()
        print()
        print(f"  Phases to run ({highlight(str(len(phases)))}):")
        for i, phase in enumerate(phases, 1):
            print(f"    {i}. {phase}")

        # Save assessment to spec dir (may already exist from AI agent)
        if not assessment_file.exists():
            with open(assessment_file, "w") as f:
                json.dump({
                    "complexity": self.assessment.complexity.value,
                    "confidence": self.assessment.confidence,
                    "reasoning": self.assessment.reasoning,
                    "signals": self.assessment.signals,
                    "estimated_files": self.assessment.estimated_files,
                    "estimated_services": self.assessment.estimated_services,
                    "external_integrations": self.assessment.external_integrations,
                    "infrastructure_changes": self.assessment.infrastructure_changes,
                    "phases_to_run": phases,
                    "needs_research": self.assessment.needs_research,
                    "needs_self_critique": self.assessment.needs_self_critique,
                    "dev_mode": self.dev_mode,  # Track if this spec was created in dev mode
                    "created_at": datetime.now().isoformat(),
                }, f, indent=2)

        return PhaseResult("complexity_assessment", True, [str(assessment_file)], [], 0)

    async def _run_ai_complexity_assessment(self, additional_requirements_context: str = "") -> Optional[ComplexityAssessment]:
        """Run AI agent to assess complexity. Returns None if it fails."""
        assessment_file = self.spec_dir / "complexity_assessment.json"
        
        # Prepare context for the AI
        context = f"""
**Project Directory**: {self.project_dir}
**Spec Directory**: {self.spec_dir}
"""
        
        # Add requirements context (this is the key information for accurate assessment)
        if additional_requirements_context:
            context += f"\n## Requirements (from user)\n{additional_requirements_context}\n"
        else:
            context += f"\n**Task Description**: {self.task_description or 'Not provided'}\n"
        
        # Add project index if available
        auto_build_index = Path(__file__).parent / "project_index.json"
        if auto_build_index.exists():
            context += f"\n**Project Index**: Available at {auto_build_index}\n"
        
        # Point to requirements file for detailed reading
        requirements_file = self.spec_dir / "requirements.json"
        if requirements_file.exists():
            context += f"\n**Requirements File**: {requirements_file} (read this for full details)\n"
        
        try:
            success, output = await self._run_agent(
                "complexity_assessor.md",
                additional_context=context,
            )
            
            if success and assessment_file.exists():
                with open(assessment_file) as f:
                    data = json.load(f)
                
                # Parse AI assessment into ComplexityAssessment
                complexity_str = data.get("complexity", "standard").lower()
                complexity = Complexity(complexity_str)
                
                # Extract flags
                flags = data.get("flags", {})
                
                return ComplexityAssessment(
                    complexity=complexity,
                    confidence=data.get("confidence", 0.75),
                    reasoning=data.get("reasoning", "AI assessment"),
                    signals=data.get("analysis", {}),
                    estimated_files=data.get("analysis", {}).get("scope", {}).get("estimated_files", 5),
                    estimated_services=data.get("analysis", {}).get("scope", {}).get("estimated_services", 1),
                    external_integrations=data.get("analysis", {}).get("integrations", {}).get("external_services", []),
                    infrastructure_changes=data.get("analysis", {}).get("infrastructure", {}).get("docker_changes", False),
                    recommended_phases=data.get("recommended_phases", []),
                    needs_research=flags.get("needs_research", False),
                    needs_self_critique=flags.get("needs_self_critique", False),
                )
            
            return None
            
        except Exception as e:
            print_status(f"AI assessment failed: {e}", "warning")
            return None

    def _heuristic_assessment(self) -> ComplexityAssessment:
        """Fall back to heuristic-based complexity assessment."""
        # Load project index if available
        project_index = {}
        auto_build_index = Path(__file__).parent / "project_index.json"
        if auto_build_index.exists():
            with open(auto_build_index) as f:
                project_index = json.load(f)

        analyzer = ComplexityAnalyzer(project_index)
        return analyzer.analyze(self.task_description or "")

    async def phase_discovery(self) -> PhaseResult:
        """Analyze project structure."""

        errors = []
        retries = 0

        for attempt in range(MAX_RETRIES):
            retries = attempt

            # Check if project_index already exists
            auto_build_index = Path(__file__).parent / "project_index.json"
            spec_index = self.spec_dir / "project_index.json"

            if auto_build_index.exists() and not spec_index.exists():
                # Copy existing index
                import shutil
                shutil.copy(auto_build_index, spec_index)
                print_status("Copied existing project_index.json", "success")
                return PhaseResult("discovery", True, [str(spec_index)], [], 0)

            if spec_index.exists():
                print_status("project_index.json already exists", "success")
                return PhaseResult("discovery", True, [str(spec_index)], [], 0)

            # Run analyzer
            print_status("Running project analyzer...", "progress")
            success, output = self._run_script(
                "analyzer.py",
                ["--output", str(spec_index)]
            )

            if success and spec_index.exists():
                print_status("Created project_index.json", "success")
                return PhaseResult("discovery", True, [str(spec_index)], [], retries)

            errors.append(f"Attempt {attempt + 1}: {output}")
            print_status(f"Attempt {attempt + 1} failed: {output[:200]}", "error")

        return PhaseResult("discovery", False, [], errors, retries)

    def _interactive_requirements_gathering(self) -> dict:
        """Gather requirements interactively from the user via CLI prompts."""
        print()
        print(f"  {muted('Answer the following questions to define your task:')}")
        print()

        # Task description
        print(f"  {bold('1. What do you want to build or fix?')}")
        print(f"     {muted('(Describe the feature, bug fix, or change)')}")
        task = input("     > ").strip()
        if not task:
            task = "No task description provided"
        print()

        # Workflow type
        print(f"  {bold('2. What type of work is this?')}")
        print(f"     {muted('[1] feature  - New functionality')}")
        print(f"     {muted('[2] bugfix   - Fix existing issue')}")
        print(f"     {muted('[3] refactor - Improve code structure')}")
        print(f"     {muted('[4] docs     - Documentation changes')}")
        print(f"     {muted('[5] test     - Add or improve tests')}")
        workflow_choice = input("     > ").strip()
        workflow_map = {
            "1": "feature", "feature": "feature",
            "2": "bugfix", "bugfix": "bugfix",
            "3": "refactor", "refactor": "refactor",
            "4": "docs", "docs": "docs",
            "5": "test", "test": "test",
        }
        workflow_type = workflow_map.get(workflow_choice.lower(), "feature")
        print()

        # Additional context (optional)
        print(f"  {bold('3. Any additional context or constraints?')}")
        print(f"     {muted('(Press Enter to skip)')}")
        additional_context = input("     > ").strip()
        print()

        return {
            "task_description": task,
            "workflow_type": workflow_type,
            "services_involved": [],  # AI will discover this during planning and context fetching
            "additional_context": additional_context if additional_context else None,
            "created_at": datetime.now().isoformat(),
        }

    async def phase_requirements(self, interactive: bool = True) -> PhaseResult:
        """Gather requirements from user or task description."""

        requirements_file = self.spec_dir / "requirements.json"

        # Check if requirements already exist
        if requirements_file.exists():
            print_status("requirements.json already exists", "success")
            return PhaseResult("requirements", True, [str(requirements_file)], [], 0)

        # If we have a task description and not interactive, create requirements directly
        if self.task_description and not interactive:
            requirements = {
                "task_description": self.task_description,
                "workflow_type": "feature",  # Default, agent will refine
                "services_involved": [],  # AI will discover during planning and context fetching
                "created_at": datetime.now().isoformat(),
            }
            with open(requirements_file, "w") as f:
                json.dump(requirements, f, indent=2)
            print_status("Created requirements.json from task description", "success")
            return PhaseResult("requirements", True, [str(requirements_file)], [], 0)

        # Interactive mode - gather requirements via CLI prompts
        if interactive:
            try:
                requirements = self._interactive_requirements_gathering()

                # Update task description for subsequent phases
                self.task_description = requirements["task_description"]

                # Re-run complexity assessment with the actual task
                print()
                print_status("Re-assessing complexity with actual task...", "progress")
                analyzer = ComplexityAnalyzer()
                self.assessment = analyzer.analyze(self.task_description, requirements)
                print_status(f"Updated complexity: {highlight(self.assessment.complexity.value.upper())}", "success")
                print_key_value("Confidence", f"{self.assessment.confidence:.0%}")
                print_key_value("Reasoning", self.assessment.reasoning)

                with open(requirements_file, "w") as f:
                    json.dump(requirements, f, indent=2)
                print()
                print_status("Created requirements.json", "success")
                return PhaseResult("requirements", True, [str(requirements_file)], [], 0)
            except (KeyboardInterrupt, EOFError):
                print()
                print_status("Requirements gathering cancelled", "warning")
                return PhaseResult("requirements", False, [], ["User cancelled"], 0)

        # Fallback: create minimal requirements
        requirements = {
            "task_description": self.task_description or "Unknown task",
            "workflow_type": "feature",
            "services_involved": [],  # AI will discover during planning and context fetching
            "created_at": datetime.now().isoformat(),
        }
        with open(requirements_file, "w") as f:
            json.dump(requirements, f, indent=2)
        print_status("Created minimal requirements.json", "success")
        return PhaseResult("requirements", True, [str(requirements_file)], [], 0)

    async def phase_quick_spec(self) -> PhaseResult:
        """Quick spec for simple tasks - combines context and spec in one step."""

        spec_file = self.spec_dir / "spec.md"
        plan_file = self.spec_dir / "implementation_plan.json"

        if spec_file.exists() and plan_file.exists():
            print_status("Quick spec already exists", "success")
            return PhaseResult("quick_spec", True, [str(spec_file), str(plan_file)], [], 0)

        errors = []
        for attempt in range(MAX_RETRIES):
            print_status(f"Running quick spec agent (attempt {attempt + 1})...", "progress")

            context = f"""
**Task**: {self.task_description}
**Spec Directory**: {self.spec_dir}
**Complexity**: SIMPLE (1-2 files expected)

This is a SIMPLE task. Create a minimal spec and implementation plan directly.
No research or extensive analysis needed.

Create:
1. A concise spec.md with just the essential sections
2. A simple implementation_plan.json with 1-2 chunks
"""
            success, output = await self._run_agent(
                "spec_quick.md",
                additional_context=context,
            )

            if success and spec_file.exists():
                # Create minimal plan if agent didn't
                if not plan_file.exists():
                    self._create_minimal_plan()

                print_status("Quick spec created", "success")
                return PhaseResult("quick_spec", True, [str(spec_file), str(plan_file)], [], attempt)

            errors.append(f"Attempt {attempt + 1}: Quick spec agent failed")

        return PhaseResult("quick_spec", False, [], errors, MAX_RETRIES)

    def _create_minimal_plan(self):
        """Create a minimal implementation plan for simple tasks."""
        plan = {
            "spec_name": self.spec_dir.name,
            "workflow_type": "simple",
            "total_phases": 1,
            "recommended_workers": 1,
            "phases": [
                {
                    "phase": 1,
                    "name": "Implementation",
                    "description": self.task_description or "Simple implementation",
                    "depends_on": [],
                    "chunks": [
                        {
                            "id": "chunk-1-1",
                            "description": self.task_description or "Implement the change",
                            "service": "main",
                            "status": "pending",
                            "files_to_create": [],
                            "files_to_modify": [],
                            "patterns_from": [],
                            "verification": {
                                "type": "manual",
                                "run": "Verify the change works as expected"
                            }
                        }
                    ]
                }
            ],
            "metadata": {
                "created_at": datetime.now().isoformat(),
                "complexity": "simple",
                "estimated_sessions": 1,
            }
        }

        plan_file = self.spec_dir / "implementation_plan.json"
        with open(plan_file, "w") as f:
            json.dump(plan, f, indent=2)

    async def phase_research(self) -> PhaseResult:
        """Research external integrations and validate assumptions."""

        research_file = self.spec_dir / "research.json"
        requirements_file = self.spec_dir / "requirements.json"

        # Check if research already exists
        if research_file.exists():
            print_status("research.json already exists", "success")
            return PhaseResult("research", True, [str(research_file)], [], 0)

        # Load requirements to understand what integrations need research
        if not requirements_file.exists():
            print_status("No requirements.json - skipping research phase", "warning")
            # Create empty research file
            with open(research_file, "w") as f:
                json.dump({
                    "integrations_researched": [],
                    "research_skipped": True,
                    "reason": "No requirements file available",
                    "created_at": datetime.now().isoformat(),
                }, f, indent=2)
            return PhaseResult("research", True, [str(research_file)], [], 0)

        # Run research agent
        errors = []
        for attempt in range(MAX_RETRIES):
            print_status(f"Running research agent (attempt {attempt + 1})...", "progress")
            print(f"  {muted('Validating external integrations against documentation...')}")

            context = f"""
**Requirements File**: {requirements_file}
**Research Output**: {research_file}

Read the requirements.json to understand what integrations/libraries are needed.
Research each external dependency to validate:
- Correct package names
- Actual API patterns
- Configuration requirements
- Known issues or gotchas

Output your findings to research.json.
"""
            success, output = await self._run_agent(
                "spec_researcher.md",
                additional_context=context,
            )

            if success and research_file.exists():
                print_status("Created research.json", "success")
                return PhaseResult("research", True, [str(research_file)], [], attempt)

            # If agent didn't create file, create minimal one
            if success and not research_file.exists():
                print_status("Agent completed but no research.json created, creating minimal...", "warning")
                with open(research_file, "w") as f:
                    json.dump({
                        "integrations_researched": [],
                        "research_completed": True,
                        "agent_output": output[:2000] if output else "",
                        "created_at": datetime.now().isoformat(),
                    }, f, indent=2)
                return PhaseResult("research", True, [str(research_file)], [], attempt)

            errors.append(f"Attempt {attempt + 1}: Research agent failed")

        # Create minimal research file on failure
        with open(research_file, "w") as f:
            json.dump({
                "integrations_researched": [],
                "research_failed": True,
                "errors": errors,
                "created_at": datetime.now().isoformat(),
            }, f, indent=2)
        print_status("Created minimal research.json (agent failed)", "warning")
        return PhaseResult("research", True, [str(research_file)], errors, MAX_RETRIES)

    async def phase_context(self) -> PhaseResult:
        """Discover relevant files for the task."""

        context_file = self.spec_dir / "context.json"
        requirements_file = self.spec_dir / "requirements.json"

        if context_file.exists():
            print_status("context.json already exists", "success")
            return PhaseResult("context", True, [str(context_file)], [], 0)

        # Load requirements for task description
        task = self.task_description
        services = ""

        if requirements_file.exists():
            with open(requirements_file) as f:
                req = json.load(f)
                task = req.get("task_description", task)
                services = ",".join(req.get("services_involved", []))

        errors = []
        for attempt in range(MAX_RETRIES):
            print_status(f"Running context discovery (attempt {attempt + 1})...", "progress")

            args = [
                "--task", task or "unknown task",
                "--output", str(context_file),
            ]
            if services:
                args.extend(["--services", services])

            success, output = self._run_script("context.py", args)

            if success and context_file.exists():
                print_status("Created context.json", "success")
                return PhaseResult("context", True, [str(context_file)], [], attempt)

            errors.append(f"Attempt {attempt + 1}: {output}")
            print_status(f"Attempt {attempt + 1} failed", "error")

        # Create minimal context if script fails
        minimal_context = {
            "task_description": task or "unknown task",
            "scoped_services": services.split(",") if services else [],
            "files_to_modify": [],
            "files_to_reference": [],
            "created_at": datetime.now().isoformat(),
        }
        with open(context_file, "w") as f:
            json.dump(minimal_context, f, indent=2)
        print_status("Created minimal context.json (script failed)", "success")
        return PhaseResult("context", True, [str(context_file)], errors, MAX_RETRIES)

    async def phase_spec_writing(self) -> PhaseResult:
        """Write the spec.md document."""

        spec_file = self.spec_dir / "spec.md"

        if spec_file.exists():
            # Validate existing spec
            result = self.validator.validate_spec_document()
            if result.valid:
                print_status("spec.md already exists and is valid", "success")
                return PhaseResult("spec_writing", True, [str(spec_file)], [], 0)
            print_status("spec.md exists but has issues, regenerating...", "warning")

        errors = []
        for attempt in range(MAX_RETRIES):
            print_status(f"Running spec writer (attempt {attempt + 1})...", "progress")

            success, output = await self._run_agent("spec_writer.md")

            if success and spec_file.exists():
                # Validate
                result = self.validator.validate_spec_document()
                if result.valid:
                    print_status("Created valid spec.md", "success")
                    return PhaseResult("spec_writing", True, [str(spec_file)], [], attempt)
                else:
                    errors.append(f"Attempt {attempt + 1}: Spec invalid - {result.errors}")
                    print_status(f"Spec created but invalid: {result.errors}", "error")
            else:
                errors.append(f"Attempt {attempt + 1}: Agent did not create spec.md")

        return PhaseResult("spec_writing", False, [], errors, MAX_RETRIES)

    async def phase_self_critique(self) -> PhaseResult:
        """Self-critique the spec using extended thinking."""

        spec_file = self.spec_dir / "spec.md"
        research_file = self.spec_dir / "research.json"
        critique_file = self.spec_dir / "critique_report.json"

        if not spec_file.exists():
            print_status("No spec.md to critique", "error")
            return PhaseResult("self_critique", False, [], ["spec.md does not exist"], 0)

        # Check if critique already done
        if critique_file.exists():
            with open(critique_file) as f:
                critique = json.load(f)
                if critique.get("issues_fixed", False) or critique.get("no_issues_found", False):
                    print_status("Self-critique already completed", "success")
                    return PhaseResult("self_critique", True, [str(critique_file)], [], 0)

        errors = []
        for attempt in range(MAX_RETRIES):
            print_status(f"Running self-critique agent (attempt {attempt + 1})...", "progress")
            print(f"  {muted('Using extended thinking to find issues in the spec...')}")

            context = f"""
**Spec File**: {spec_file}
**Research File**: {research_file}
**Critique Output**: {critique_file}

Use EXTENDED THINKING (ultrathink) to deeply analyze the spec.md:

1. **Technical Accuracy**: Do code examples match the research findings?
2. **Completeness**: Are all requirements covered? Edge cases handled?
3. **Consistency**: Do package names, APIs, and patterns match throughout?
4. **Feasibility**: Is the implementation approach realistic?

For each issue found:
- Fix it directly in spec.md
- Document what was fixed in critique_report.json

Output critique_report.json with:
{{
  "issues_found": [...],
  "issues_fixed": true/false,
  "no_issues_found": true/false,
  "critique_summary": "..."
}}
"""
            success, output = await self._run_agent(
                "spec_critic.md",
                additional_context=context,
            )

            if success:
                # Create critique report if agent didn't
                if not critique_file.exists():
                    with open(critique_file, "w") as f:
                        json.dump({
                            "issues_found": [],
                            "no_issues_found": True,
                            "critique_summary": "Agent completed without explicit issues",
                            "created_at": datetime.now().isoformat(),
                        }, f, indent=2)

                # Re-validate spec after critique
                result = self.validator.validate_spec_document()
                if result.valid:
                    print_status("Self-critique completed, spec is valid", "success")
                    return PhaseResult("self_critique", True, [str(critique_file)], [], attempt)
                else:
                    print_status(f"Spec invalid after critique: {result.errors}", "warning")
                    errors.append(f"Attempt {attempt + 1}: Spec still invalid after critique")
            else:
                errors.append(f"Attempt {attempt + 1}: Critique agent failed")

        # Create minimal critique report on failure
        with open(critique_file, "w") as f:
            json.dump({
                "issues_found": [],
                "critique_failed": True,
                "errors": errors,
                "created_at": datetime.now().isoformat(),
            }, f, indent=2)
        print_status("Self-critique failed, continuing with existing spec", "warning")
        return PhaseResult("self_critique", True, [str(critique_file)], errors, MAX_RETRIES)

    async def phase_planning(self) -> PhaseResult:
        """Create the implementation plan."""

        plan_file = self.spec_dir / "implementation_plan.json"

        if plan_file.exists():
            # Validate existing plan
            result = self.validator.validate_implementation_plan()
            if result.valid:
                print_status("implementation_plan.json already exists and is valid", "success")
                return PhaseResult("planning", True, [str(plan_file)], [], 0)
            print_status("Plan exists but invalid, regenerating...", "warning")

        errors = []

        # Try Python script first (deterministic)
        print_status("Trying planner.py (deterministic)...", "progress")
        success, output = self._run_script(
            "planner.py",
            ["--spec-dir", str(self.spec_dir)]
        )

        if success and plan_file.exists():
            # Validate
            result = self.validator.validate_implementation_plan()
            if result.valid:
                print_status("Created valid implementation_plan.json via script", "success")
                return PhaseResult("planning", True, [str(plan_file)], [], 0)
            else:
                print_status("Script output invalid, trying auto-fix...", "warning")
                if auto_fix_plan(self.spec_dir):
                    result = self.validator.validate_implementation_plan()
                    if result.valid:
                        print_status("Auto-fixed implementation_plan.json", "success")
                        return PhaseResult("planning", True, [str(plan_file)], [], 0)

                errors.append(f"Script output invalid: {result.errors}")

        # Fall back to agent
        print_status("Falling back to planner agent...", "progress")
        for attempt in range(MAX_RETRIES):
            print_status(f"Running planner agent (attempt {attempt + 1})...", "progress")

            success, output = await self._run_agent("planner.md")

            if success and plan_file.exists():
                # Validate
                result = self.validator.validate_implementation_plan()
                if result.valid:
                    print_status("Created valid implementation_plan.json via agent", "success")
                    return PhaseResult("planning", True, [str(plan_file)], [], attempt)
                else:
                    # Try auto-fix
                    if auto_fix_plan(self.spec_dir):
                        result = self.validator.validate_implementation_plan()
                        if result.valid:
                            print_status("Auto-fixed implementation_plan.json", "success")
                            return PhaseResult("planning", True, [str(plan_file)], [], attempt)

                    errors.append(f"Agent attempt {attempt + 1}: {result.errors}")
                    print_status("Plan created but invalid", "error")
            else:
                errors.append(f"Agent attempt {attempt + 1}: Did not create plan file")

        return PhaseResult("planning", False, [], errors, MAX_RETRIES)

    async def phase_validation(self) -> PhaseResult:
        """Final validation of all spec files."""

        results = self.validator.validate_all()
        all_valid = all(r.valid for r in results)

        for result in results:
            if result.valid:
                print_status(f"{result.checkpoint}: PASS", "success")
            else:
                print_status(f"{result.checkpoint}: FAIL", "error")
            for err in result.errors:
                print(f"    {muted('Error:')} {err}")

        if all_valid:
            print()
            print_status("All validation checks passed", "success")
            return PhaseResult("validation", True, [], [], 0)
        else:
            errors = [
                f"{r.checkpoint}: {err}"
                for r in results
                for err in r.errors
            ]
            return PhaseResult("validation", False, [], errors, 0)

    # === Main Orchestration ===

    async def run(self, interactive: bool = True) -> bool:
        """Run the spec creation process with dynamic phase selection."""
        print(box(
            f"Spec Directory: {self.spec_dir}\n"
            f"Project: {self.project_dir}" +
            (f"\nTask: {self.task_description}" if self.task_description else ""),
            title="SPEC CREATION ORCHESTRATOR",
            style="heavy"
        ))

        results = []
        phase_num = 0  # Track phase number for display

        # Phase display names and icons
        phase_display = {
            "discovery": ("PROJECT DISCOVERY", Icons.FOLDER),
            "requirements": ("REQUIREMENTS GATHERING", Icons.FILE),
            "complexity_assessment": ("COMPLEXITY ASSESSMENT", Icons.GEAR),
            "research": ("INTEGRATION RESEARCH", Icons.SEARCH),
            "context": ("CONTEXT DISCOVERY", Icons.FOLDER),
            "quick_spec": ("QUICK SPEC", Icons.LIGHTNING),
            "spec_writing": ("SPEC DOCUMENT CREATION", Icons.FILE),
            "self_critique": ("SPEC SELF-CRITIQUE", Icons.GEAR),
            "planning": ("IMPLEMENTATION PLANNING", Icons.CHUNK),
            "validation": ("FINAL VALIDATION", Icons.SUCCESS),
        }

        def run_phase(name: str, phase_fn):
            """Run a phase with proper numbering and display."""
            nonlocal phase_num
            phase_num += 1
            display_name, display_icon = phase_display.get(name, (name.upper(), Icons.GEAR))
            print_section(f"PHASE {phase_num}: {display_name}", display_icon)
            return phase_fn()

        # === PHASE 1: DISCOVERY ===
        result = await run_phase("discovery", self.phase_discovery)
        results.append(result)
        if not result.success:
            print_status("Discovery failed", "error")
            return False

        # === PHASE 2: REQUIREMENTS GATHERING ===
        result = await run_phase("requirements", lambda: self.phase_requirements(interactive))
        results.append(result)
        if not result.success:
            print_status("Requirements gathering failed", "error")
            return False

        # === PHASE 3: AI COMPLEXITY ASSESSMENT ===
        result = await run_phase("complexity_assessment", self.phase_complexity_assessment_with_requirements)
        results.append(result)
        if not result.success:
            print_status("Complexity assessment failed", "error")
            return False

        # Map of all available phases (remaining after discovery/requirements/complexity)
        all_phases = {
            "research": self.phase_research,
            "context": self.phase_context,
            "spec_writing": self.phase_spec_writing,
            "self_critique": self.phase_self_critique,
            "planning": self.phase_planning,
            "validation": self.phase_validation,
            "quick_spec": self.phase_quick_spec,
        }

        # Get remaining phases to run based on complexity (excluding discovery/requirements which are done)
        all_phases_to_run = self.assessment.phases_to_run()
        phases_to_run = [p for p in all_phases_to_run if p not in ["discovery", "requirements"]]

        print()
        print(f"  Running {highlight(self.assessment.complexity.value.upper())} workflow")
        print(f"  {muted('Remaining phases:')} {', '.join(phases_to_run)}")
        print()

        phases_executed = ["discovery", "requirements", "complexity_assessment"]
        for phase_name in phases_to_run:
            if phase_name not in all_phases:
                print_status(f"Unknown phase: {phase_name}, skipping", "warning")
                continue

            result = await run_phase(phase_name, all_phases[phase_name])
            results.append(result)
            phases_executed.append(phase_name)

            if not result.success:
                print()
                print_status(f"Phase '{phase_name}' failed after {result.retries} retries", "error")
                print(f"  {muted('Errors:')}")
                for err in result.errors:
                    print(f"    {icon(Icons.ARROW_RIGHT)} {err}")
                print()
                print_status("Spec creation incomplete. Fix errors and retry.", "warning")
                return False

        # Summary
        files_created = []
        for r in results:
            for f in r.output_files:
                files_created.append(Path(f).name)

        print(box(
            f"Complexity: {self.assessment.complexity.value.upper()}\n"
            f"Phases run: {len(phases_executed) + 1}\n"  # +1 for complexity_assessment
            f"Spec saved to: {self.spec_dir}\n\n"
            f"Files created:\n" +
            "\n".join(f"  {icon(Icons.SUCCESS)} {f}" for f in files_created),
            title=f"{icon(Icons.SUCCESS)} SPEC CREATION COMPLETE",
            style="heavy"
        ))

        print()
        print(f"  {muted('To start the build:')}")
        print(f"    {highlight(f'python auto-build/run.py --spec {self.spec_dir.name}')}")
        print()

        return True


def main():
    """CLI entry point."""
    import argparse

    parser = argparse.ArgumentParser(
        description="Dynamic spec creation with complexity-based phase selection",
        formatter_class=argparse.RawDescriptionHelpFormatter,
        epilog="""
Complexity Tiers:
  simple    - 3 phases: Discovery → Quick Spec → Validate (1-2 files)
  standard  - 6 phases: Discovery → Requirements → Context → Spec → Plan → Validate
  complex   - 8 phases: Full pipeline with research and self-critique

Examples:
  # Simple UI fix (auto-detected as simple)
  python spec_runner.py --task "Fix button color in Header component"

  # Force simple mode
  python spec_runner.py --task "Update text" --complexity simple

  # Complex integration (auto-detected)
  python spec_runner.py --task "Add Graphiti memory integration with FalkorDB"

  # Interactive mode
  python spec_runner.py --interactive
        """
    )
    parser.add_argument(
        "--task",
        type=str,
        help="Task description (what to build). For very long descriptions, use --task-file instead.",
    )
    parser.add_argument(
        "--task-file",
        type=Path,
        help="Read task description from a file (useful for long specs)",
    )
    parser.add_argument(
        "--interactive",
        action="store_true",
        help="Run in interactive mode (gather requirements from user)",
    )
    parser.add_argument(
        "--continue",
        dest="continue_spec",
        type=str,
        help="Continue an existing spec",
    )
    parser.add_argument(
        "--complexity",
        type=str,
        choices=["simple", "standard", "complex"],
        help="Override automatic complexity detection",
    )
    parser.add_argument(
        "--project-dir",
        type=Path,
        default=Path.cwd(),
        help="Project directory (default: current directory)",
    )
    parser.add_argument(
        "--model",
        type=str,
        default="claude-opus-4-5-20251101",
        help="Model to use for agent phases",
    )
    parser.add_argument(
        "--no-ai-assessment",
        action="store_true",
        help="Use heuristic complexity assessment instead of AI (faster but less accurate)",
    )
    parser.add_argument(
        "--dev",
        action="store_true",
        help="Dev mode: specs saved to dev/auto-build/specs/ (gitignored), code changes target auto-build/",
    )

    args = parser.parse_args()

    # Handle task from file if provided
    task_description = args.task
    if args.task_file:
        if not args.task_file.exists():
            print(f"Error: Task file not found: {args.task_file}")
            sys.exit(1)
        task_description = args.task_file.read_text().strip()
        if not task_description:
            print(f"Error: Task file is empty: {args.task_file}")
            sys.exit(1)

    # Validate task description isn't problematic
    if task_description:
        # Warn about very long descriptions but don't block
        if len(task_description) > 5000:
            print(f"Warning: Task description is very long ({len(task_description)} chars). Consider breaking into subtasks.")
        # Sanitize null bytes which could cause issues
        task_description = task_description.replace('\x00', '')

    # Find project root (look for auto-build folder)
    project_dir = args.project_dir
    if not (project_dir / "auto-build").exists():
        # Try parent directories
        for parent in project_dir.parents:
            if (parent / "auto-build").exists():
                project_dir = parent
                break

    # Show dev mode warning
    if args.dev:
        print(f"\n{icon(Icons.GEAR)} DEV MODE: Specs will be saved to dev/auto-build/specs/ (gitignored)")
        print(f"  Code changes will target auto-build/ (versioned)\n")

    orchestrator = SpecOrchestrator(
        project_dir=project_dir,
        task_description=task_description,
        spec_name=args.continue_spec,
        model=args.model,
        complexity_override=args.complexity,
        use_ai_assessment=not args.no_ai_assessment,
        dev_mode=args.dev,
    )

    try:
        success = asyncio.run(orchestrator.run(interactive=args.interactive or not task_description))
        sys.exit(0 if success else 1)
    except KeyboardInterrupt:
        print("\n\nSpec creation interrupted.")
        print(f"To continue: python auto-build/spec_runner.py --continue {orchestrator.spec_dir.name}")
        sys.exit(1)


if __name__ == "__main__":
    main()
