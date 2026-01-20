"""
Tests for model-specific limits and validation in phase_config module.

Ensures that thinking budgets are properly validated against model limits
and that the configuration system correctly handles model-specific constraints.
"""

import logging
import sys
from pathlib import Path

# Add auto-claude to path
sys.path.insert(0, str(Path(__file__).parent.parent / "apps" / "backend"))

from phase_config import (
    get_model_max_output_tokens,
    get_model_max_thinking_tokens,
    get_thinking_budget,
    validate_thinking_budget,
)


class TestModelLimits:
    """Test model-specific token limits and validation."""

    def test_all_models_have_64k_output_limit(self):
        """Test that all Claude 4.5 models have 64,000 max_tokens limit."""
        models = [
            "claude-opus-4-5-20251101",
            "claude-sonnet-4-5-20250929",
            "claude-haiku-4-5-20251001",
        ]

        for model_id in models:
            max_output = get_model_max_output_tokens(model_id)
            assert (
                max_output == 64000
            ), f"{model_id} should have 64000 max_tokens, got {max_output}"

    def test_all_models_have_60k_thinking_limit(self):
        """Test that all models have 60,000 max thinking tokens (4K buffer)."""
        models = [
            "claude-opus-4-5-20251101",
            "claude-sonnet-4-5-20250929",
            "claude-haiku-4-5-20251001",
        ]

        for model_id in models:
            max_thinking = get_model_max_thinking_tokens(model_id)
            assert (
                max_thinking == 60000
            ), f"{model_id} should have 60000 max thinking tokens, got {max_thinking}"

    def test_unknown_model_uses_defaults(self):
        """Test that unknown models default to 64K output and 60K thinking."""
        unknown_model = "claude-unknown-model-v99"

        max_output = get_model_max_output_tokens(unknown_model)
        max_thinking = get_model_max_thinking_tokens(unknown_model)

        assert max_output == 64000, "Unknown model should default to 64000 max_tokens"
        assert (
            max_thinking == 60000
        ), "Unknown model should default to 60000 max thinking tokens"

    def test_validate_thinking_budget_within_limits(self):
        """Test that valid thinking budgets pass validation unchanged."""
        model_id = "claude-opus-4-5-20251101"
        budgets = [1024, 4096, 16384, 50000, 60000]

        for budget in budgets:
            result, was_capped = validate_thinking_budget(budget, model_id)
            assert result == budget, f"Budget {budget} should not be modified"
            assert not was_capped, f"Budget {budget} should not be capped"

    def test_validate_thinking_budget_caps_excessive_budget(self, caplog):
        """Test that thinking budgets exceeding model limits are capped."""
        model_id = "claude-opus-4-5-20251101"
        excessive_budgets = [60001, 63999, 64000, 100000]

        with caplog.at_level(logging.WARNING):
            for budget in excessive_budgets:
                result, was_capped = validate_thinking_budget(budget, model_id)
                assert result == 60000, f"Budget {budget} should be capped to 60000"
                assert was_capped, f"Budget {budget} should be flagged as capped"

            # Should have logged warnings for each excessive budget
            assert len(caplog.records) == len(excessive_budgets)
            for record in caplog.records:
                assert "exceeds model limit" in record.message

    def test_validate_thinking_budget_handles_none(self):
        """Test that None thinking budget passes through validation."""
        model_id = "claude-opus-4-5-20251101"
        result, was_capped = validate_thinking_budget(None, model_id)

        assert result is None, "None budget should pass through unchanged"
        assert not was_capped, "None budget should not be flagged as capped"

    def test_get_thinking_budget_with_model_validation(self, caplog):
        """Test that get_thinking_budget validates against model limits when model_id provided."""
        model_id = "claude-opus-4-5-20251101"

        # Normal levels should work fine
        budget = get_thinking_budget("low", model_id=model_id)
        assert budget == 1024

        budget = get_thinking_budget("medium", model_id=model_id)
        assert budget == 4096

        budget = get_thinking_budget("high", model_id=model_id)
        assert budget == 16384

        # Ultrathink should be capped at 60000 (not exceed it)
        budget = get_thinking_budget("ultrathink", model_id=model_id)
        assert budget == 60000

    def test_get_thinking_budget_without_model_validation(self):
        """Test that get_thinking_budget works without model_id (backward compatibility)."""
        # Should work without model_id parameter
        budget = get_thinking_budget("low")
        assert budget == 1024

        budget = get_thinking_budget("ultrathink")
        assert budget == 60000

    def test_thinking_budget_leaves_buffer_for_sdk(self):
        """Test that max thinking budget leaves adequate buffer for SDK overhead."""
        model_id = "claude-opus-4-5-20251101"
        max_output = get_model_max_output_tokens(model_id)
        max_thinking = get_model_max_thinking_tokens(model_id)

        # Buffer should be at least 4000 tokens (mentioned in model_limits.json)
        buffer = max_output - max_thinking
        assert buffer >= 4000, f"Buffer should be at least 4K tokens, got {buffer}"

    def test_api_constraint_satisfied(self):
        """Test that thinking budget is strictly less than max_tokens (API constraint)."""
        model_id = "claude-opus-4-5-20251101"
        max_output = get_model_max_output_tokens(model_id)
        max_thinking = get_model_max_thinking_tokens(model_id)

        # API constraint: max_tokens > thinking.budget_tokens
        assert (
            max_thinking < max_output
        ), f"thinking budget ({max_thinking}) must be < max_tokens ({max_output})"

        # Also test with ultrathink budget
        ultrathink_budget = get_thinking_budget("ultrathink", model_id=model_id)
        assert (
            ultrathink_budget < max_output
        ), f"ultrathink ({ultrathink_budget}) must be < max_tokens ({max_output})"
