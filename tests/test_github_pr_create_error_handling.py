"""
Tests for GitHub PR creation error handling.

This test validates that cmd_pr_create returns structured JSON
for both success and error cases as expected by the frontend.
"""

import asyncio
import json
import sys
from pathlib import Path
from unittest.mock import AsyncMock, MagicMock, patch
from io import StringIO
import argparse

import pytest

# Add backend directories to path
_backend_dir = Path(__file__).parent.parent / "apps" / "backend"
_github_dir = _backend_dir / "runners" / "github"
if str(_github_dir) not in sys.path:
    sys.path.insert(0, str(_github_dir))
if str(_backend_dir) not in sys.path:
    sys.path.insert(0, str(_backend_dir))


@pytest.fixture
def mock_args(tmp_path):
    """Create mock arguments for cmd_pr_create."""
    args = argparse.Namespace()
    args.project = str(tmp_path)
    args.base = "main"
    args.head = "feature/test"
    args.title = "Test PR"
    args.body = "Test description"
    args.draft = "false"
    args.token = None
    args.bot_token = None
    args.repo = "owner/repo"
    args.model = None
    args.thinking_level = None
    return args


@pytest.fixture
def mock_config():
    """Create mock configuration."""
    from models import GitHubRunnerConfig
    return GitHubRunnerConfig(
        repo="owner/repo",
        token="ghp_test_token",
        model="claude-sonnet-4-20250514",
        thinking_level="medium",
    )


class TestPRCreateErrorHandling:
    """Test suite for PR creation error handling."""

    @pytest.mark.asyncio
    async def test_success_returns_structured_json(self, mock_args, mock_config):
        """Test that successful PR creation returns structured JSON."""
        from runner import cmd_pr_create
        
        # Mock successful PR creation
        mock_pr_data = {
            'number': 123,
            'url': 'https://api.github.com/repos/owner/repo/pulls/123',
            'title': 'Test PR',
            'state': 'open',
            'html_url': 'https://github.com/owner/repo/pull/123'
        }
        
        with patch('runner.get_config', return_value=mock_config), \
             patch('runner.GHClient') as mock_gh_client_class:
            
            # Configure mock client
            mock_client = MagicMock()
            mock_client.pr_create = AsyncMock(return_value=mock_pr_data)
            mock_gh_client_class.return_value = mock_client
            
            # Capture stdout
            captured_output = StringIO()
            with patch('sys.stdout', captured_output):
                exit_code = await cmd_pr_create(mock_args)
            
            # Verify exit code
            assert exit_code == 0, "Should return 0 on success"
            
            # Verify JSON output
            output = captured_output.getvalue().strip()
            result = json.loads(output)
            
            assert result['success'] is True, "Should have success=True"
            assert 'data' in result, "Should have 'data' key"
            assert result['data']['number'] == 123, "Should contain PR number"
            assert result['data']['url'] == mock_pr_data['url'], "Should contain PR URL"

    @pytest.mark.asyncio
    async def test_gh_cli_not_found_returns_error_json(self, mock_args, mock_config):
        """Test that FileNotFoundError returns structured error JSON."""
        from runner import cmd_pr_create
        
        with patch('runner.get_config', return_value=mock_config), \
             patch('runner.GHClient') as mock_gh_client_class:
            
            # Configure mock to raise FileNotFoundError
            mock_client = MagicMock()
            mock_client.pr_create = AsyncMock(side_effect=FileNotFoundError("gh not found"))
            mock_gh_client_class.return_value = mock_client
            
            # Capture stdout
            captured_output = StringIO()
            with patch('sys.stdout', captured_output):
                exit_code = await cmd_pr_create(mock_args)
            
            # Verify exit code
            assert exit_code == 1, "Should return 1 on error"
            
            # Verify JSON output
            output = captured_output.getvalue().strip()
            result = json.loads(output)
            
            assert result['success'] is False, "Should have success=False"
            assert 'error' in result, "Should have 'error' key"
            assert 'errorType' in result, "Should have 'errorType' key"
            assert result['errorType'] == 'MISSING_GH_CLI', "Should have correct error type"
            assert 'GitHub CLI (gh) not found' in result['error'], "Should have helpful error message"

    @pytest.mark.asyncio
    async def test_gh_command_error_returns_error_json(self, mock_args, mock_config):
        """Test that GHCommandError returns structured error JSON."""
        from runner import cmd_pr_create
        from gh_client import GHCommandError
        
        with patch('runner.get_config', return_value=mock_config), \
             patch('runner.GHClient') as mock_gh_client_class:
            
            # Configure mock to raise GHCommandError
            mock_client = MagicMock()
            mock_client.pr_create = AsyncMock(
                side_effect=GHCommandError("gh pr create failed: invalid branch")
            )
            mock_gh_client_class.return_value = mock_client
            
            # Capture stdout
            captured_output = StringIO()
            with patch('sys.stdout', captured_output):
                exit_code = await cmd_pr_create(mock_args)
            
            # Verify exit code
            assert exit_code == 1, "Should return 1 on error"
            
            # Verify JSON output
            output = captured_output.getvalue().strip()
            result = json.loads(output)
            
            assert result['success'] is False, "Should have success=False"
            assert 'error' in result, "Should have 'error' key"
            assert 'errorType' in result, "Should have 'errorType' key"
            assert result['errorType'] == 'GH_CLI_ERROR', "Should have correct error type"
            assert 'GitHub CLI error' in result['error'], "Should have error prefix"

    @pytest.mark.asyncio
    async def test_gh_timeout_error_returns_error_json(self, mock_args, mock_config):
        """Test that GHTimeoutError returns structured error JSON."""
        from runner import cmd_pr_create
        from gh_client import GHTimeoutError
        
        with patch('runner.get_config', return_value=mock_config), \
             patch('runner.GHClient') as mock_gh_client_class:
            
            # Configure mock to raise GHTimeoutError
            mock_client = MagicMock()
            mock_client.pr_create = AsyncMock(
                side_effect=GHTimeoutError("gh pr create timed out after 3 attempts")
            )
            mock_gh_client_class.return_value = mock_client
            
            # Capture stdout
            captured_output = StringIO()
            with patch('sys.stdout', captured_output):
                exit_code = await cmd_pr_create(mock_args)
            
            # Verify exit code
            assert exit_code == 1, "Should return 1 on error"
            
            # Verify JSON output
            output = captured_output.getvalue().strip()
            result = json.loads(output)
            
            assert result['success'] is False, "Should have success=False"
            assert 'error' in result, "Should have 'error' key"
            assert 'errorType' in result, "Should have 'errorType' key"
            assert result['errorType'] == 'GH_TIMEOUT_ERROR', "Should have correct error type"
            assert 'timed out' in result['error'], "Should mention timeout"

    @pytest.mark.asyncio
    async def test_rate_limit_error_returns_error_json(self, mock_args, mock_config):
        """Test that RateLimitExceeded returns structured error JSON."""
        from runner import cmd_pr_create
        from rate_limiter import RateLimitExceeded
        
        with patch('runner.get_config', return_value=mock_config), \
             patch('runner.GHClient') as mock_gh_client_class:
            
            # Configure mock to raise RateLimitExceeded
            mock_client = MagicMock()
            mock_client.pr_create = AsyncMock(
                side_effect=RateLimitExceeded("GitHub API rate limit exceeded (HTTP 403)")
            )
            mock_gh_client_class.return_value = mock_client
            
            # Capture stdout
            captured_output = StringIO()
            with patch('sys.stdout', captured_output):
                exit_code = await cmd_pr_create(mock_args)
            
            # Verify exit code
            assert exit_code == 1, "Should return 1 on error"
            
            # Verify JSON output
            output = captured_output.getvalue().strip()
            result = json.loads(output)
            
            assert result['success'] is False, "Should have success=False"
            assert 'error' in result, "Should have 'error' key"
            assert 'errorType' in result, "Should have 'errorType' key"
            assert result['errorType'] == 'RATE_LIMIT_EXCEEDED', "Should have correct error type"
            assert 'rate limit' in result['error'].lower(), "Should mention rate limit"

    @pytest.mark.asyncio
    async def test_json_decode_error_returns_error_json(self, mock_args, mock_config):
        """Test that JSONDecodeError returns structured error JSON."""
        from runner import cmd_pr_create
        
        with patch('runner.get_config', return_value=mock_config), \
             patch('runner.GHClient') as mock_gh_client_class:
            
            # Configure mock to raise JSONDecodeError
            mock_client = MagicMock()
            mock_client.pr_create = AsyncMock(
                side_effect=json.JSONDecodeError("Invalid JSON", "", 0)
            )
            mock_gh_client_class.return_value = mock_client
            
            # Capture stdout
            captured_output = StringIO()
            with patch('sys.stdout', captured_output):
                exit_code = await cmd_pr_create(mock_args)
            
            # Verify exit code
            assert exit_code == 1, "Should return 1 on error"
            
            # Verify JSON output
            output = captured_output.getvalue().strip()
            result = json.loads(output)
            
            assert result['success'] is False, "Should have success=False"
            assert 'error' in result, "Should have 'error' key"
            assert 'errorType' in result, "Should have 'errorType' key"
            assert result['errorType'] == 'JSON_PARSE_ERROR', "Should have correct error type"
            assert 'parse' in result['error'].lower(), "Should mention parsing"

    @pytest.mark.asyncio
    async def test_unexpected_error_returns_error_json(self, mock_args, mock_config):
        """Test that unexpected errors return structured error JSON."""
        from runner import cmd_pr_create
        
        with patch('runner.get_config', return_value=mock_config), \
             patch('runner.GHClient') as mock_gh_client_class:
            
            # Configure mock to raise unexpected error
            mock_client = MagicMock()
            mock_client.pr_create = AsyncMock(
                side_effect=ValueError("Unexpected error")
            )
            mock_gh_client_class.return_value = mock_client
            
            # Capture stdout
            captured_output = StringIO()
            with patch('sys.stdout', captured_output):
                exit_code = await cmd_pr_create(mock_args)
            
            # Verify exit code
            assert exit_code == 1, "Should return 1 on error"
            
            # Verify JSON output
            output = captured_output.getvalue().strip()
            result = json.loads(output)
            
            assert result['success'] is False, "Should have success=False"
            assert 'error' in result, "Should have 'error' key"
            assert 'errorType' in result, "Should have 'errorType' key"
            assert result['errorType'] == 'UNEXPECTED_ERROR', "Should have correct error type"
            assert 'Unexpected error' in result['error'], "Should contain error message"

    @pytest.mark.asyncio
    async def test_draft_argument_parsing_boolean(self, mock_args, mock_config):
        """Test that draft argument is correctly parsed from boolean."""
        from runner import cmd_pr_create
        
        mock_pr_data = {
            'number': 123,
            'url': 'https://api.github.com/repos/owner/repo/pulls/123',
            'title': 'Test PR',
            'state': 'open'
        }
        
        # Test with boolean True
        mock_args.draft = True
        
        with patch('runner.get_config', return_value=mock_config), \
             patch('runner.GHClient') as mock_gh_client_class:
            
            mock_client = MagicMock()
            mock_client.pr_create = AsyncMock(return_value=mock_pr_data)
            mock_gh_client_class.return_value = mock_client
            
            captured_output = StringIO()
            with patch('sys.stdout', captured_output):
                exit_code = await cmd_pr_create(mock_args)
            
            # Verify pr_create was called with draft=True
            mock_client.pr_create.assert_called_once()
            call_args = mock_client.pr_create.call_args
            assert call_args.kwargs['draft'] is True, "Should pass draft=True"

    @pytest.mark.asyncio
    async def test_draft_argument_parsing_string(self, mock_args, mock_config):
        """Test that draft argument is correctly parsed from string."""
        from runner import cmd_pr_create
        
        mock_pr_data = {
            'number': 123,
            'url': 'https://api.github.com/repos/owner/repo/pulls/123',
            'title': 'Test PR',
            'state': 'open'
        }
        
        # Test with string 'true'
        mock_args.draft = 'true'
        
        with patch('runner.get_config', return_value=mock_config), \
             patch('runner.GHClient') as mock_gh_client_class:
            
            mock_client = MagicMock()
            mock_client.pr_create = AsyncMock(return_value=mock_pr_data)
            mock_gh_client_class.return_value = mock_client
            
            captured_output = StringIO()
            with patch('sys.stdout', captured_output):
                exit_code = await cmd_pr_create(mock_args)
            
            # Verify pr_create was called with draft=True
            mock_client.pr_create.assert_called_once()
            call_args = mock_client.pr_create.call_args
            assert call_args.kwargs['draft'] is True, "Should parse 'true' string to True"


if __name__ == "__main__":
    pytest.main([__file__, "-v"])
