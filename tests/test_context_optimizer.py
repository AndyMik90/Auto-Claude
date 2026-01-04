"""
Tests for Context Optimizer
===========================

Tests the context window optimization functionality for Ollama.
"""

import os
import pytest
from unittest.mock import patch

# Add the backend to the path
import sys
sys.path.insert(0, os.path.join(os.path.dirname(__file__), '..', 'apps', 'backend'))

from integrations.context_optimizer import (
    ContentPriority,
    ContextChunk,
    ContextBudget,
    ContextOptimizerConfig,
    TokenEstimator,
    FileFilter,
    CodeChunker,
    PromptCompressor,
    ContextOptimizer,
    get_context_optimizer,
    reset_context_optimizer,
)


class TestTokenEstimator:
    """Tests for TokenEstimator."""
    
    def test_estimate_empty_string(self):
        """Test token estimation for empty string."""
        assert TokenEstimator.estimate_tokens("") == 0
    
    def test_estimate_short_string(self):
        """Test token estimation for short string."""
        text = "Hello, world!"
        tokens = TokenEstimator.estimate_tokens(text)
        assert tokens > 0
        assert tokens < len(text)  # Should be less than character count
    
    def test_estimate_code(self):
        """Test token estimation for code."""
        code = """
def hello_world():
    print("Hello, World!")
    return True
"""
        tokens = TokenEstimator.estimate_tokens(code)
        assert tokens > 10
        assert tokens < 50
    
    def test_estimate_lines_for_tokens(self):
        """Test line estimation for token budget."""
        lines = TokenEstimator.estimate_lines_for_tokens(1000)
        assert lines > 0
        assert lines < 1000  # Should be less than token count


class TestContextBudget:
    """Tests for ContextBudget."""
    
    def test_from_config_defaults(self):
        """Test budget creation with defaults."""
        budget = ContextBudget.from_config()
        
        assert budget.total_tokens == 8192
        assert budget.reserved_for_response == 2048
        assert budget.available_for_content > 0
    
    def test_from_config_custom(self):
        """Test budget creation with custom values."""
        budget = ContextBudget.from_config(
            context_window=16384,
            response_reserve=4096,
            system_reserve=1000,
        )
        
        assert budget.total_tokens == 16384
        assert budget.reserved_for_response == 4096
        assert budget.available_for_content == 16384 - 4096 - 1000


class TestContextOptimizerConfig:
    """Tests for ContextOptimizerConfig."""
    
    def test_default_config(self):
        """Test default configuration."""
        config = ContextOptimizerConfig()
        
        assert config.context_window == 8192
        assert config.max_file_tokens == 2000
        assert ".py" in config.include_extensions
    
    def test_from_env(self):
        """Test config from environment."""
        with patch.dict(os.environ, {
            "OLLAMA_NUM_CTX": "16384",
            "MAX_FILE_TOKENS": "3000",
        }):
            config = ContextOptimizerConfig.from_env()
            
            assert config.context_window == 16384
            assert config.max_file_tokens == 3000


class TestFileFilter:
    """Tests for FileFilter."""
    
    @pytest.fixture
    def filter(self):
        """Create a file filter for testing."""
        return FileFilter(ContextOptimizerConfig())
    
    def test_include_python_file(self, filter):
        """Test including Python files."""
        assert filter.should_include("src/main.py") is True
    
    def test_include_typescript_file(self, filter):
        """Test including TypeScript files."""
        assert filter.should_include("src/app.tsx") is True
    
    def test_exclude_node_modules(self, filter):
        """Test excluding node_modules."""
        assert filter.should_include("node_modules/package/index.js") is False
    
    def test_exclude_pycache(self, filter):
        """Test excluding __pycache__."""
        assert filter.should_include("src/__pycache__/main.cpython-311.pyc") is False
    
    def test_exclude_binary(self, filter):
        """Test excluding binary files."""
        assert filter.should_include("assets/image.png") is False
    
    def test_filter_files(self, filter):
        """Test filtering a list of files."""
        files = [
            "src/main.py",
            "src/utils.py",
            "node_modules/lib/index.js",
            "assets/logo.png",
        ]
        filtered = filter.filter_files(files)
        
        assert "src/main.py" in filtered
        assert "src/utils.py" in filtered
        assert "node_modules/lib/index.js" not in filtered
        assert "assets/logo.png" not in filtered


class TestCodeChunker:
    """Tests for CodeChunker."""
    
    @pytest.fixture
    def chunker(self):
        """Create a code chunker for testing."""
        return CodeChunker(ContextOptimizerConfig())
    
    def test_small_content_single_chunk(self, chunker):
        """Test that small content returns single chunk."""
        content = "def hello():\n    return 'world'"
        chunks = chunker.chunk_content(content, "test.py", 1000)
        
        assert len(chunks) == 1
        assert chunks[0].content == content
        assert chunks[0].is_partial is False
    
    def test_large_content_multiple_chunks(self, chunker):
        """Test that large content is chunked."""
        # Create content larger than max_tokens
        content = "\n".join([f"def func_{i}():\n    return {i}" for i in range(100)])
        chunks = chunker.chunk_content(content, "test.py", 100)
        
        assert len(chunks) > 1
        for chunk in chunks:
            assert chunk.is_partial is True
    
    def test_chunk_preserves_source(self, chunker):
        """Test that chunks preserve source information."""
        content = "x = 1"
        chunks = chunker.chunk_content(content, "my_file.py", 1000)
        
        assert chunks[0].source == "my_file.py"
    
    def test_chunk_has_priority(self, chunker):
        """Test that chunks have priority."""
        content = "x = 1"
        chunks = chunker.chunk_content(
            content, "test.py", 1000,
            priority=ContentPriority.HIGH
        )
        
        assert chunks[0].priority == ContentPriority.HIGH


class TestPromptCompressor:
    """Tests for PromptCompressor."""
    
    def test_compress_whitespace(self):
        """Test compressing excessive whitespace."""
        text = "Hello\n\n\n\nWorld"
        compressed = PromptCompressor.compress(text)
        
        assert "\n\n\n" not in compressed
    
    def test_compress_filler_words(self):
        """Test removing filler words."""
        text = "Please could you basically just write some code"
        compressed = PromptCompressor.compress(text)
        
        assert "please" not in compressed.lower()
        assert "basically" not in compressed.lower()
    
    def test_aggressive_removes_comments(self):
        """Test aggressive mode removes comments."""
        text = "x = 1  # This is a comment\ny = 2"
        compressed = PromptCompressor.compress(text, aggressive=True)
        
        assert "comment" not in compressed


class TestContextOptimizer:
    """Tests for ContextOptimizer."""
    
    @pytest.fixture
    def optimizer(self):
        """Create a context optimizer for testing."""
        reset_context_optimizer()
        return ContextOptimizer()
    
    def test_build_context_empty(self, optimizer):
        """Test building context with no files."""
        context, metadata = optimizer.build_context({})
        
        assert metadata["files"]["total_provided"] == 0
    
    def test_build_context_with_files(self, optimizer):
        """Test building context with files."""
        files = {
            "src/main.py": "def main():\n    pass",
            "src/utils.py": "def helper():\n    pass",
        }
        context, metadata = optimizer.build_context(files)
        
        assert metadata["files"]["total_provided"] == 2
        assert "main.py" in context or metadata["files"]["chunks_included"] > 0
    
    def test_build_context_with_priorities(self, optimizer):
        """Test building context respects priorities."""
        files = {
            "critical.py": "x = 1",
            "low.py": "y = 2",
        }
        priorities = {
            "critical.py": ContentPriority.CRITICAL,
            "low.py": ContentPriority.LOW,
        }
        context, metadata = optimizer.build_context(files, priorities)
        
        # Critical file should be included
        assert "critical.py" in metadata["included_files"]
    
    def test_build_context_with_prompts(self, optimizer):
        """Test building context with system and user prompts."""
        context, metadata = optimizer.build_context(
            {},
            system_prompt="You are a helpful assistant.",
            user_prompt="Write some code.",
        )
        
        assert "<system>" in context
        assert "<user>" in context
    
    def test_estimate_fit_small(self, optimizer):
        """Test fit estimation for small content."""
        result = optimizer.estimate_fit("Hello, world!")
        
        assert result["fits"] is True
        assert result["overflow"] == 0
    
    def test_estimate_fit_large(self, optimizer):
        """Test fit estimation for large content."""
        # Create content larger than context window
        large_content = "x" * 100000
        result = optimizer.estimate_fit(large_content)
        
        assert result["fits"] is False
        assert result["overflow"] > 0


class TestGlobalOptimizer:
    """Tests for global optimizer instance."""
    
    def test_get_context_optimizer_singleton(self):
        """Test that get_context_optimizer returns singleton."""
        reset_context_optimizer()
        
        opt1 = get_context_optimizer()
        opt2 = get_context_optimizer()
        
        assert opt1 is opt2
    
    def test_reset_context_optimizer(self):
        """Test resetting the global optimizer."""
        opt1 = get_context_optimizer()
        reset_context_optimizer()
        opt2 = get_context_optimizer()
        
        assert opt1 is not opt2


if __name__ == "__main__":
    pytest.main([__file__, "-v"])
