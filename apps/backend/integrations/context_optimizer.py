"""
Context Window Optimizer
========================

Optimizes context window usage for Ollama's limited context windows.
Implements intelligent chunking, file filtering, and prompt compression.

Features:
- Smart file filtering to include only relevant code
- Intelligent chunking for large files
- Prompt compression for token efficiency
- Priority-based context allocation
- Memory-efficient context building

Environment Variables:
    OLLAMA_NUM_CTX: Context window size (default: 8192)
    CONTEXT_RESERVE_TOKENS: Tokens reserved for response (default: 2048)
    MAX_FILE_TOKENS: Maximum tokens per file (default: 2000)
"""

import os
import re
from dataclasses import dataclass, field
from enum import Enum
from typing import List, Dict, Optional, Tuple, Set
from pathlib import Path


class ContentPriority(str, Enum):
    """Priority levels for context content."""
    CRITICAL = "critical"    # Must include (e.g., main file being edited)
    HIGH = "high"            # Important (e.g., directly imported files)
    MEDIUM = "medium"        # Useful (e.g., related files)
    LOW = "low"              # Nice to have (e.g., documentation)
    MINIMAL = "minimal"      # Only if space allows


@dataclass
class ContextChunk:
    """A chunk of context content."""
    content: str
    source: str  # File path or description
    priority: ContentPriority
    token_estimate: int
    chunk_index: int = 0
    total_chunks: int = 1
    
    @property
    def is_partial(self) -> bool:
        """Check if this is a partial chunk of a larger file."""
        return self.total_chunks > 1


@dataclass
class ContextBudget:
    """Budget allocation for context window."""
    total_tokens: int
    reserved_for_response: int
    reserved_for_system: int
    available_for_content: int
    
    @classmethod
    def from_config(
        cls,
        context_window: int = 8192,
        response_reserve: int = 2048,
        system_reserve: int = 500,
    ) -> "ContextBudget":
        """Create a context budget from configuration."""
        available = context_window - response_reserve - system_reserve
        return cls(
            total_tokens=context_window,
            reserved_for_response=response_reserve,
            reserved_for_system=system_reserve,
            available_for_content=max(0, available),
        )


@dataclass
class ContextOptimizerConfig:
    """Configuration for context optimization."""
    context_window: int = 8192
    response_reserve: int = 2048
    system_reserve: int = 500
    max_file_tokens: int = 2000
    max_files: int = 20
    
    # File filtering
    include_extensions: Set[str] = field(default_factory=lambda: {
        ".py", ".js", ".ts", ".tsx", ".jsx", ".java", ".go", ".rs",
        ".c", ".cpp", ".h", ".hpp", ".cs", ".rb", ".php", ".swift",
        ".kt", ".scala", ".md", ".json", ".yaml", ".yml", ".toml",
    })
    exclude_patterns: List[str] = field(default_factory=lambda: [
        r"node_modules/", r"__pycache__/", r"\.git/", r"\.venv/",
        r"venv/", r"dist/", r"build/", r"\.next/", r"\.nuxt/",
        r"coverage/", r"\.pytest_cache/", r"\.mypy_cache/",
    ])
    
    # Chunking
    chunk_overlap_lines: int = 5
    prefer_function_boundaries: bool = True
    
    @classmethod
    def from_env(cls) -> "ContextOptimizerConfig":
        """Create configuration from environment variables."""
        try:
            context_window = int(os.environ.get("OLLAMA_NUM_CTX", "8192"))
        except ValueError:
            context_window = 8192
            
        try:
            response_reserve = int(os.environ.get("CONTEXT_RESERVE_TOKENS", "2048"))
        except ValueError:
            response_reserve = 2048
            
        try:
            max_file_tokens = int(os.environ.get("MAX_FILE_TOKENS", "2000"))
        except ValueError:
            max_file_tokens = 2000
        
        return cls(
            context_window=context_window,
            response_reserve=response_reserve,
            max_file_tokens=max_file_tokens,
        )


class TokenEstimator:
    """Estimates token counts for text content."""
    
    # Average characters per token (rough estimate for code)
    CHARS_PER_TOKEN = 3.5
    
    @classmethod
    def estimate_tokens(cls, text: str) -> int:
        """Estimate the number of tokens in text."""
        if not text:
            return 0
        return int(len(text) / cls.CHARS_PER_TOKEN)
    
    @classmethod
    def estimate_lines_for_tokens(cls, target_tokens: int, avg_line_length: int = 40) -> int:
        """Estimate how many lines fit in a token budget."""
        chars = target_tokens * cls.CHARS_PER_TOKEN
        return int(chars / avg_line_length)


class FileFilter:
    """Filters files for context inclusion."""
    
    def __init__(self, config: ContextOptimizerConfig):
        self.config = config
        self._exclude_patterns = [
            re.compile(pattern) for pattern in config.exclude_patterns
        ]
    
    def should_include(self, file_path: str) -> bool:
        """Check if a file should be included in context."""
        path = Path(file_path)
        
        # Check extension
        if path.suffix.lower() not in self.config.include_extensions:
            return False
        
        # Check exclude patterns
        path_str = str(path)
        for pattern in self._exclude_patterns:
            if pattern.search(path_str):
                return False
        
        return True
    
    def filter_files(self, file_paths: List[str]) -> List[str]:
        """Filter a list of file paths."""
        return [f for f in file_paths if self.should_include(f)]


class CodeChunker:
    """Chunks code files intelligently."""
    
    # Patterns that indicate function/class boundaries
    BOUNDARY_PATTERNS = [
        re.compile(r"^(def |async def |class |function |const |let |var |export |import )", re.MULTILINE),
        re.compile(r"^(public |private |protected |static )", re.MULTILINE),
    ]
    
    def __init__(self, config: ContextOptimizerConfig):
        self.config = config
    
    def chunk_content(
        self,
        content: str,
        source: str,
        max_tokens: int,
        priority: ContentPriority = ContentPriority.MEDIUM,
    ) -> List[ContextChunk]:
        """Chunk content into manageable pieces."""
        total_tokens = TokenEstimator.estimate_tokens(content)
        
        # If content fits, return as single chunk
        if total_tokens <= max_tokens:
            return [ContextChunk(
                content=content,
                source=source,
                priority=priority,
                token_estimate=total_tokens,
            )]
        
        # Need to chunk
        lines = content.split("\n")
        chunks = []
        
        if self.config.prefer_function_boundaries:
            chunks = self._chunk_at_boundaries(lines, source, max_tokens, priority)
        else:
            chunks = self._chunk_by_lines(lines, source, max_tokens, priority)
        
        # Update total_chunks for all chunks
        total = len(chunks)
        for i, chunk in enumerate(chunks):
            chunk.chunk_index = i
            chunk.total_chunks = total
        
        return chunks
    
    def _chunk_at_boundaries(
        self,
        lines: List[str],
        source: str,
        max_tokens: int,
        priority: ContentPriority,
    ) -> List[ContextChunk]:
        """Chunk at function/class boundaries."""
        chunks = []
        current_lines = []
        current_tokens = 0
        
        for i, line in enumerate(lines):
            line_tokens = TokenEstimator.estimate_tokens(line + "\n")
            
            # Check if this line is a boundary
            is_boundary = any(
                pattern.match(line.lstrip())
                for pattern in self.BOUNDARY_PATTERNS
            )
            
            # If adding this line would exceed limit and we're at a boundary
            if current_tokens + line_tokens > max_tokens and is_boundary and current_lines:
                # Save current chunk
                chunks.append(ContextChunk(
                    content="\n".join(current_lines),
                    source=source,
                    priority=priority,
                    token_estimate=current_tokens,
                ))
                
                # Start new chunk with overlap
                overlap_start = max(0, len(current_lines) - self.config.chunk_overlap_lines)
                current_lines = current_lines[overlap_start:]
                current_tokens = TokenEstimator.estimate_tokens("\n".join(current_lines))
            
            current_lines.append(line)
            current_tokens += line_tokens
            
            # Force chunk if way over limit
            if current_tokens > max_tokens * 1.5:
                chunks.append(ContextChunk(
                    content="\n".join(current_lines),
                    source=source,
                    priority=priority,
                    token_estimate=current_tokens,
                ))
                current_lines = []
                current_tokens = 0
        
        # Add remaining content
        if current_lines:
            chunks.append(ContextChunk(
                content="\n".join(current_lines),
                source=source,
                priority=priority,
                token_estimate=current_tokens,
            ))
        
        return chunks
    
    def _chunk_by_lines(
        self,
        lines: List[str],
        source: str,
        max_tokens: int,
        priority: ContentPriority,
    ) -> List[ContextChunk]:
        """Simple line-based chunking."""
        chunks = []
        current_lines = []
        current_tokens = 0
        
        for line in lines:
            line_tokens = TokenEstimator.estimate_tokens(line + "\n")
            
            if current_tokens + line_tokens > max_tokens and current_lines:
                chunks.append(ContextChunk(
                    content="\n".join(current_lines),
                    source=source,
                    priority=priority,
                    token_estimate=current_tokens,
                ))
                
                # Overlap
                overlap_start = max(0, len(current_lines) - self.config.chunk_overlap_lines)
                current_lines = current_lines[overlap_start:]
                current_tokens = TokenEstimator.estimate_tokens("\n".join(current_lines))
            
            current_lines.append(line)
            current_tokens += line_tokens
        
        if current_lines:
            chunks.append(ContextChunk(
                content="\n".join(current_lines),
                source=source,
                priority=priority,
                token_estimate=current_tokens,
            ))
        
        return chunks


class PromptCompressor:
    """Compresses prompts for token efficiency."""
    
    # Common verbose patterns to compress
    COMPRESSION_RULES = [
        # Remove excessive whitespace
        (re.compile(r"\n{3,}"), "\n\n"),
        (re.compile(r"[ \t]{2,}"), " "),
        
        # Shorten common phrases
        (re.compile(r"please\s+", re.IGNORECASE), ""),
        (re.compile(r"could you\s+", re.IGNORECASE), ""),
        (re.compile(r"I would like you to\s+", re.IGNORECASE), ""),
        (re.compile(r"make sure to\s+", re.IGNORECASE), ""),
        
        # Remove filler words in instructions
        (re.compile(r"\bbasically\b", re.IGNORECASE), ""),
        (re.compile(r"\bactually\b", re.IGNORECASE), ""),
        (re.compile(r"\bjust\b", re.IGNORECASE), ""),
    ]
    
    @classmethod
    def compress(cls, text: str, aggressive: bool = False) -> str:
        """Compress text to reduce token count."""
        result = text
        
        for pattern, replacement in cls.COMPRESSION_RULES:
            result = pattern.sub(replacement, result)
        
        if aggressive:
            # Remove comments from code blocks
            result = re.sub(r"#[^\n]*\n", "\n", result)
            result = re.sub(r"//[^\n]*\n", "\n", result)
            # Remove docstrings
            result = re.sub(r'"""[\s\S]*?"""', "", result)
            result = re.sub(r"'''[\s\S]*?'''", "", result)
        
        return result.strip()


class ContextOptimizer:
    """
    Main context optimizer that combines all optimization strategies.
    
    Builds an optimized context window for Ollama by:
    1. Filtering relevant files
    2. Prioritizing content
    3. Chunking large files
    4. Compressing prompts
    5. Allocating token budget
    """
    
    def __init__(self, config: Optional[ContextOptimizerConfig] = None):
        """Initialize the context optimizer."""
        self.config = config or ContextOptimizerConfig.from_env()
        self.budget = ContextBudget.from_config(
            context_window=self.config.context_window,
            response_reserve=self.config.response_reserve,
            system_reserve=self.config.system_reserve,
        )
        self.file_filter = FileFilter(self.config)
        self.chunker = CodeChunker(self.config)
    
    def build_context(
        self,
        files: Dict[str, str],  # path -> content
        priorities: Optional[Dict[str, ContentPriority]] = None,
        system_prompt: str = "",
        user_prompt: str = "",
    ) -> Tuple[str, Dict[str, any]]:
        """
        Build an optimized context from files and prompts.
        
        Args:
            files: Dictionary of file paths to content
            priorities: Optional priority overrides for files
            system_prompt: System prompt to include
            user_prompt: User prompt to include
            
        Returns:
            Tuple of (optimized context string, metadata dict)
        """
        priorities = priorities or {}
        
        # Calculate prompt tokens
        system_tokens = TokenEstimator.estimate_tokens(system_prompt)
        user_tokens = TokenEstimator.estimate_tokens(user_prompt)
        prompt_tokens = system_tokens + user_tokens
        
        # Available for file content
        available_for_files = self.budget.available_for_content - prompt_tokens
        
        if available_for_files <= 0:
            # Prompts alone exceed budget, compress them
            system_prompt = PromptCompressor.compress(system_prompt, aggressive=True)
            user_prompt = PromptCompressor.compress(user_prompt, aggressive=True)
            system_tokens = TokenEstimator.estimate_tokens(system_prompt)
            user_tokens = TokenEstimator.estimate_tokens(user_prompt)
            available_for_files = self.budget.available_for_content - system_tokens - user_tokens
        
        # Filter and prioritize files
        filtered_files = {
            path: content
            for path, content in files.items()
            if self.file_filter.should_include(path)
        }
        
        # Chunk all files
        all_chunks: List[ContextChunk] = []
        for path, content in filtered_files.items():
            priority = priorities.get(path, ContentPriority.MEDIUM)
            chunks = self.chunker.chunk_content(
                content=content,
                source=path,
                max_tokens=self.config.max_file_tokens,
                priority=priority,
            )
            all_chunks.extend(chunks)
        
        # Sort by priority
        priority_order = {
            ContentPriority.CRITICAL: 0,
            ContentPriority.HIGH: 1,
            ContentPriority.MEDIUM: 2,
            ContentPriority.LOW: 3,
            ContentPriority.MINIMAL: 4,
        }
        all_chunks.sort(key=lambda c: priority_order[c.priority])
        
        # Select chunks that fit
        selected_chunks: List[ContextChunk] = []
        used_tokens = 0
        
        for chunk in all_chunks:
            if used_tokens + chunk.token_estimate <= available_for_files:
                selected_chunks.append(chunk)
                used_tokens += chunk.token_estimate
        
        # Build context string
        context_parts = []
        
        if system_prompt:
            context_parts.append(f"<system>\n{system_prompt}\n</system>")
        
        if selected_chunks:
            context_parts.append("<context>")
            for chunk in selected_chunks:
                header = f"--- {chunk.source}"
                if chunk.is_partial:
                    header += f" (part {chunk.chunk_index + 1}/{chunk.total_chunks})"
                header += " ---"
                context_parts.append(header)
                context_parts.append(chunk.content)
            context_parts.append("</context>")
        
        if user_prompt:
            context_parts.append(f"<user>\n{user_prompt}\n</user>")
        
        context = "\n\n".join(context_parts)
        
        # Build metadata
        metadata = {
            "total_tokens_estimate": used_tokens + prompt_tokens,
            "budget": {
                "total": self.budget.total_tokens,
                "available": self.budget.available_for_content,
                "used": used_tokens + prompt_tokens,
                "remaining": self.budget.available_for_content - used_tokens - prompt_tokens,
            },
            "files": {
                "total_provided": len(files),
                "filtered": len(filtered_files),
                "chunks_created": len(all_chunks),
                "chunks_included": len(selected_chunks),
            },
            "included_files": list(set(c.source for c in selected_chunks)),
            "excluded_files": [
                path for path in files.keys()
                if path not in set(c.source for c in selected_chunks)
            ],
        }
        
        return context, metadata
    
    def estimate_fit(self, content: str) -> Dict[str, any]:
        """Estimate if content fits in the context window."""
        tokens = TokenEstimator.estimate_tokens(content)
        fits = tokens <= self.budget.available_for_content
        
        return {
            "fits": fits,
            "tokens": tokens,
            "available": self.budget.available_for_content,
            "overflow": max(0, tokens - self.budget.available_for_content),
        }


# Global instance
_optimizer_instance: Optional[ContextOptimizer] = None


def get_context_optimizer() -> ContextOptimizer:
    """Get or create the global context optimizer instance."""
    global _optimizer_instance
    if _optimizer_instance is None:
        _optimizer_instance = ContextOptimizer()
    return _optimizer_instance


def reset_context_optimizer() -> None:
    """Reset the global context optimizer (useful for testing)."""
    global _optimizer_instance
    _optimizer_instance = None
