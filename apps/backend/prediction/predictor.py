"""
Main BugPredictor class that orchestrates prediction components.
"""

from pathlib import Path

from .checklist_generator import ChecklistGenerator
from .formatter import ChecklistFormatter
from .memory_loader import MemoryLoader
from .models import PreImplementationChecklist
from .risk_analyzer import RiskAnalyzer


class BugPredictor:
    """
    Predicts likely bugs and generates pre-implementation checklists.

    This is the main orchestrator that coordinates the prediction components:
    - MemoryLoader: Loads historical data from memory files
    - RiskAnalyzer: Analyzes risks based on work type and history
    - ChecklistGenerator: Generates structured checklists
    - ChecklistFormatter: Formats checklists as markdown
    """

    def __init__(self, spec_dir: Path):
        """
        Initialize the bug predictor.

        Args:
            spec_dir: Path to the spec directory (e.g., auto-claude/specs/001-feature/)
        """
        self.spec_dir = Path(spec_dir)
        self.memory_dir = self.spec_dir / "memory"

        # Initialize components
        self.memory_loader = MemoryLoader(self.memory_dir)
        self.risk_analyzer = RiskAnalyzer()
        self.checklist_generator = ChecklistGenerator()
        self.formatter = ChecklistFormatter()

    def generate_checklist(self, subtask: dict) -> PreImplementationChecklist:
        """
        Generate a complete pre-implementation checklist for a subtask.

        Args:
            subtask: Subtask dictionary from implementation_plan.json

        Returns:
            PreImplementationChecklist ready for formatting
        """
        # Load historical data
        attempt_history = self.memory_loader.load_attempt_history()
        known_patterns = self.memory_loader.load_patterns()
        known_gotchas = self.memory_loader.load_gotchas()

        # Analyze risks
        predicted_issues = self.risk_analyzer.analyze_subtask_risks(
            subtask, attempt_history
        )

        # Generate checklist
        checklist = self.checklist_generator.generate_checklist(
            subtask=subtask,
            predicted_issues=predicted_issues,
            known_patterns=known_patterns,
            known_gotchas=known_gotchas,
        )

        return checklist

    def format_checklist_markdown(self, checklist: PreImplementationChecklist) -> str:
        """
        Format checklist as markdown for agent consumption.

        Args:
            checklist: PreImplementationChecklist to format

        Returns:
            Markdown-formatted checklist string
        """
        return self.formatter.format_markdown(checklist)
