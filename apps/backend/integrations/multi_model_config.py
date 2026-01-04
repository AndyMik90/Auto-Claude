"""
Multi-Model Configuration
=========================

Manages multiple model configurations for different task types.
Allows assigning specific models to specific agent roles or task categories.

Features:
- Task-specific model assignment (e.g., coding model, review model)
- Role-based model selection (Planner, Coder, Reviewer, QA)
- Dynamic model switching based on task complexity
- Cost optimization by using appropriate models for each task

Environment Variables:
    OLLAMA_MODEL_SIMPLE: Model for simple tasks (default: llama3.2:3b)
    OLLAMA_MODEL_COMPLEX: Model for complex tasks (default: llama3.1:70b-instruct-q4_K_M)
    OLLAMA_MODEL_CODE: Model for coding tasks (default: qwen2.5-coder:7b)
    OLLAMA_MODEL_REVIEW: Model for code review (default: llama3.1:8b-instruct-q4_K_M)
"""

import os
from dataclasses import dataclass, field
from enum import Enum
from typing import Dict, Optional, List


class TaskComplexity(str, Enum):
    """Task complexity levels."""
    SIMPLE = "simple"
    MODERATE = "moderate"
    COMPLEX = "complex"


class AgentRole(str, Enum):
    """Agent roles in Auto-Claude."""
    PLANNER = "planner"
    CODER = "coder"
    REVIEWER = "reviewer"
    QA = "qa"
    MEMORY = "memory"
    GENERAL = "general"


class TaskType(str, Enum):
    """Types of tasks that may benefit from specialized models."""
    CODE_GENERATION = "code_generation"
    CODE_REVIEW = "code_review"
    PLANNING = "planning"
    DEBUGGING = "debugging"
    DOCUMENTATION = "documentation"
    TESTING = "testing"
    REFACTORING = "refactoring"
    ANALYSIS = "analysis"
    GENERAL = "general"


@dataclass
class ModelSpec:
    """Specification for a model."""
    name: str
    provider: str  # "ollama" or "claude"
    context_window: int
    strengths: List[str] = field(default_factory=list)
    vram_usage_gb: Optional[float] = None
    tokens_per_second: Optional[float] = None


# Predefined model specifications
OLLAMA_MODELS: Dict[str, ModelSpec] = {
    "llama3.2:3b": ModelSpec(
        name="llama3.2:3b",
        provider="ollama",
        context_window=4096,
        strengths=["fast", "low_memory", "simple_tasks"],
        vram_usage_gb=2.5,
        tokens_per_second=100,
    ),
    "llama3.1:8b-instruct-q4_K_M": ModelSpec(
        name="llama3.1:8b-instruct-q4_K_M",
        provider="ollama",
        context_window=8192,
        strengths=["balanced", "general_purpose", "coding"],
        vram_usage_gb=5.5,
        tokens_per_second=50,
    ),
    "llama3.1:70b-instruct-q4_K_M": ModelSpec(
        name="llama3.1:70b-instruct-q4_K_M",
        provider="ollama",
        context_window=16384,
        strengths=["complex_reasoning", "architecture", "planning"],
        vram_usage_gb=40,
        tokens_per_second=15,
    ),
    "qwen2.5-coder:7b": ModelSpec(
        name="qwen2.5-coder:7b",
        provider="ollama",
        context_window=8192,
        strengths=["code_generation", "code_completion", "debugging"],
        vram_usage_gb=4.8,
        tokens_per_second=55,
    ),
    "codellama:7b": ModelSpec(
        name="codellama:7b",
        provider="ollama",
        context_window=8192,
        strengths=["code_generation", "code_completion"],
        vram_usage_gb=4.0,
        tokens_per_second=60,
    ),
    "deepseek-r1:7b": ModelSpec(
        name="deepseek-r1:7b",
        provider="ollama",
        context_window=8192,
        strengths=["reasoning", "analysis", "complex_logic"],
        vram_usage_gb=5.2,
        tokens_per_second=45,
    ),
}

CLAUDE_MODELS: Dict[str, ModelSpec] = {
    "claude-3-5-sonnet-20241022": ModelSpec(
        name="claude-3-5-sonnet-20241022",
        provider="claude",
        context_window=200000,
        strengths=["all_tasks", "complex_reasoning", "long_context"],
    ),
    "claude-opus-4-5-20251101": ModelSpec(
        name="claude-opus-4-5-20251101",
        provider="claude",
        context_window=200000,
        strengths=["all_tasks", "complex_reasoning", "long_context", "highest_quality"],
    ),
}


@dataclass
class MultiModelConfig:
    """Configuration for multi-model setup."""
    
    # Default models by task type
    model_simple: str = "llama3.2:3b"
    model_complex: str = "llama3.1:70b-instruct-q4_K_M"
    model_code: str = "qwen2.5-coder:7b"
    model_review: str = "llama3.1:8b-instruct-q4_K_M"
    model_default: str = "llama3.1:8b-instruct-q4_K_M"
    
    # Role-specific model overrides
    role_models: Dict[AgentRole, str] = field(default_factory=dict)
    
    # Task type to model mapping
    task_models: Dict[TaskType, str] = field(default_factory=dict)
    
    @classmethod
    def from_env(cls) -> "MultiModelConfig":
        """Create configuration from environment variables."""
        config = cls(
            model_simple=os.environ.get("OLLAMA_MODEL_SIMPLE", "llama3.2:3b"),
            model_complex=os.environ.get("OLLAMA_MODEL_COMPLEX", "llama3.1:70b-instruct-q4_K_M"),
            model_code=os.environ.get("OLLAMA_MODEL_CODE", "qwen2.5-coder:7b"),
            model_review=os.environ.get("OLLAMA_MODEL_REVIEW", "llama3.1:8b-instruct-q4_K_M"),
            model_default=os.environ.get("OLLAMA_MODEL", os.environ.get("OLLAMA_LLM_MODEL", "llama3.1:8b-instruct-q4_K_M")),
        )
        
        # Set up default task mappings
        config.task_models = {
            TaskType.CODE_GENERATION: config.model_code,
            TaskType.CODE_REVIEW: config.model_review,
            TaskType.PLANNING: config.model_complex,
            TaskType.DEBUGGING: config.model_code,
            TaskType.DOCUMENTATION: config.model_default,
            TaskType.TESTING: config.model_review,
            TaskType.REFACTORING: config.model_code,
            TaskType.ANALYSIS: config.model_complex,
            TaskType.GENERAL: config.model_default,
        }
        
        # Set up default role mappings
        config.role_models = {
            AgentRole.PLANNER: config.model_complex,
            AgentRole.CODER: config.model_code,
            AgentRole.REVIEWER: config.model_review,
            AgentRole.QA: config.model_review,
            AgentRole.MEMORY: config.model_simple,
            AgentRole.GENERAL: config.model_default,
        }
        
        return config
    
    def get_model_for_task(self, task_type: TaskType) -> str:
        """Get the appropriate model for a task type."""
        return self.task_models.get(task_type, self.model_default)
    
    def get_model_for_role(self, role: AgentRole) -> str:
        """Get the appropriate model for an agent role."""
        return self.role_models.get(role, self.model_default)
    
    def get_model_for_complexity(self, complexity: TaskComplexity) -> str:
        """Get the appropriate model based on task complexity."""
        if complexity == TaskComplexity.SIMPLE:
            return self.model_simple
        elif complexity == TaskComplexity.COMPLEX:
            return self.model_complex
        return self.model_default
    
    def set_role_model(self, role: AgentRole, model: str) -> None:
        """Set a specific model for an agent role."""
        self.role_models[role] = model
    
    def set_task_model(self, task_type: TaskType, model: str) -> None:
        """Set a specific model for a task type."""
        self.task_models[task_type] = model


class ModelSelector:
    """
    Intelligent model selector that chooses the best model for a given context.
    
    Considers:
    - Task type and complexity
    - Agent role
    - Available VRAM
    - Required context window
    - Performance requirements
    """
    
    def __init__(self, config: Optional[MultiModelConfig] = None):
        """Initialize the model selector."""
        self.config = config or MultiModelConfig.from_env()
        self._available_vram_gb: Optional[float] = None
    
    def set_available_vram(self, vram_gb: float) -> None:
        """Set the available VRAM for model selection."""
        self._available_vram_gb = vram_gb
    
    def get_model_spec(self, model_name: str) -> Optional[ModelSpec]:
        """Get the specification for a model."""
        if model_name in OLLAMA_MODELS:
            return OLLAMA_MODELS[model_name]
        if model_name in CLAUDE_MODELS:
            return CLAUDE_MODELS[model_name]
        return None
    
    def select_model(
        self,
        task_type: Optional[TaskType] = None,
        role: Optional[AgentRole] = None,
        complexity: Optional[TaskComplexity] = None,
        required_context: Optional[int] = None,
        prefer_speed: bool = False,
    ) -> str:
        """
        Select the best model for the given requirements.
        
        Args:
            task_type: Type of task to perform
            role: Agent role requesting the model
            complexity: Task complexity level
            required_context: Minimum required context window
            prefer_speed: If True, prefer faster models over quality
            
        Returns:
            Name of the selected model
        """
        # Start with role-based selection if provided
        if role:
            candidate = self.config.get_model_for_role(role)
        elif task_type:
            candidate = self.config.get_model_for_task(task_type)
        elif complexity:
            candidate = self.config.get_model_for_complexity(complexity)
        else:
            candidate = self.config.model_default
        
        # Check if candidate meets requirements
        spec = self.get_model_spec(candidate)
        
        if spec:
            # Check context window requirement
            if required_context and spec.context_window < required_context:
                # Need a model with larger context
                for name, model_spec in OLLAMA_MODELS.items():
                    if model_spec.context_window >= required_context:
                        if self._check_vram_fit(model_spec):
                            candidate = name
                            break
            
            # Check VRAM constraint
            if not self._check_vram_fit(spec):
                # Need a smaller model
                candidate = self._find_fitting_model(prefer_speed)
        
        return candidate
    
    def _check_vram_fit(self, spec: ModelSpec) -> bool:
        """Check if a model fits in available VRAM."""
        if self._available_vram_gb is None:
            return True  # Assume it fits if we don't know VRAM
        if spec.vram_usage_gb is None:
            return True  # Assume it fits if we don't know model size
        return spec.vram_usage_gb <= self._available_vram_gb
    
    def _find_fitting_model(self, prefer_speed: bool = False) -> str:
        """Find a model that fits in available VRAM."""
        if self._available_vram_gb is None:
            return self.config.model_default
        
        # Sort models by VRAM usage (ascending)
        fitting_models = [
            (name, spec)
            for name, spec in OLLAMA_MODELS.items()
            if spec.vram_usage_gb and spec.vram_usage_gb <= self._available_vram_gb
        ]
        
        if not fitting_models:
            return self.config.model_simple  # Fallback to smallest
        
        if prefer_speed:
            # Sort by tokens per second (descending)
            fitting_models.sort(
                key=lambda x: x[1].tokens_per_second or 0,
                reverse=True
            )
        else:
            # Sort by VRAM usage (descending) to get the best model that fits
            fitting_models.sort(
                key=lambda x: x[1].vram_usage_gb or 0,
                reverse=True
            )
        
        return fitting_models[0][0]
    
    def get_all_available_models(self) -> Dict[str, ModelSpec]:
        """Get all models that fit in available VRAM."""
        if self._available_vram_gb is None:
            return {**OLLAMA_MODELS, **CLAUDE_MODELS}
        
        available = {}
        for name, spec in OLLAMA_MODELS.items():
            if self._check_vram_fit(spec):
                available[name] = spec
        
        # Claude models don't have VRAM constraints
        available.update(CLAUDE_MODELS)
        
        return available


# Global instance
_selector_instance: Optional[ModelSelector] = None


def get_model_selector() -> ModelSelector:
    """Get or create the global model selector instance."""
    global _selector_instance
    if _selector_instance is None:
        _selector_instance = ModelSelector()
    return _selector_instance


def reset_model_selector() -> None:
    """Reset the global model selector (useful for testing)."""
    global _selector_instance
    _selector_instance = None
