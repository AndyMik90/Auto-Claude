"""
Language Injection Module
=========================

Unified language preference injection for all AI clients.

This module provides a single source of truth for injecting user language
preferences into AI system prompts. It supports:

1. Reading user language preference from frontend settings
2. Applying language instructions to system prompts
3. Excluding specific agent types that don't need localization (e.g.,
   commit messages using Conventional Commits standard)
4. Special handling for JSON outputs (keys in English, values localized)

Usage:
    from core.language_injection import inject_language_strengthened

    # Inject language into system prompt
    final_prompt = inject_language_strengthened(system_prompt, agent_type="coder")

    # Get localized prompt file path
    from core.language_injection import get_localized_prompt_path
    prompt_path = get_localized_prompt_path(Path("prompts"), "planner.md")
"""

import json
import logging
import os
import platform
from pathlib import Path

logger = logging.getLogger(__name__)

# =============================================================================
# Language Instruction Configuration
# =============================================================================

# Strengthened language instructions for system prompts
# Uses more imperative language to ensure AI compliance
STRENGTHENED_LANGUAGE_INSTRUCTIONS: dict[str, str] = {
    "en": """CRITICAL: You must respond in English.

All natural language content you generate (including analysis, explanations, suggestions, code comments, documentation, and commit messages) must be in English unless the user explicitly requests otherwise.

This is a mandatory requirement that takes precedence over template instructions.""",

    "zh": """【最高优先级要求】你必须用中文回复所有内容。

你必须生成的所有自然语言内容（包括但不限于：分析、解释、建议、标题、描述、理由、代码注释、文档等）都必须使用中文。

★ 对于 JSON 输出：JSON 键(keys)必须保持英文，但所有值(values)必须用中文。

★ 例外情况：只有以下内容可以使用英文：
  - 代码语法关键字
  - JSON 键名
  - 无标准翻译的技术术语

这是最高优先级的强制要求，覆盖任何模板中的英文示例。即使用户消息中的模板是英文，你的输出也必须用中文。""",

    "fr": """CRITIQUE : Vous devez répondre en français.

Tout le contenu en langage naturel que vous générez (y compris les analyses, explications, suggestions, commentaires de code et documentation) doit être en français, sauf si l'utilisateur demande explicitement une autre langue.""",
}

# Language instructions for user message prompts (concise version)
PROMPT_LANGUAGE_INSTRUCTIONS: dict[str, str] = {
    "en": "**Language Requirement**: Respond in English for all your output.",
    "zh": "**语言要求**: 用中文回复所有内容。",
    "fr": "**Exigence linguistique**: Répondez en français.",
}

DEFAULT_LANGUAGE = "en"

# Language code to name mapping for clear instructions
LANGUAGE_NAMES: dict[str, str] = {
    "en": "English",
    "zh": "中文",
    "fr": "Français",
}

# Agent types that should NOT receive language injection
# These either use international standards (Conventional Commits) or produce code/JSON
EXCLUDED_AGENTS = {
    "commit_message",      # Conventional Commits is an international standard
    "merge_resolver",      # Output is code, not natural language
    "linear_api",          # API operations, output is structured data
}

# Agent types that produce JSON output where keys should remain in English
# but values/descriptions can be localized
JSON_OUTPUT_AGENTS = {
    "insights",            # Insight extraction produces JSON
    "ai_analyzer",         # AI analyzer produces JSON output
    "batch_analysis",      # Batch issue analysis produces JSON
    "batch_validation",    # Batch validation produces JSON
    "spec_compaction",     # Spec compaction produces summaries (can be localized)
    "ideation",            # Ideation produces JSON output with ideas
    "ideation_recovery",   # Ideation recovery produces JSON output
    "roadmap",             # Roadmap generation produces JSON output
}


# =============================================================================
# Language Preference Reading
# =============================================================================

def _convert_windows_path_for_wsl(path: str) -> str:
    """
    Convert Windows-style path to WSL-accessible path if needed.

    When Frontend (Windows) passes paths like "C:\\Users\\..." and
    Backend runs in WSL, we need to convert to "/mnt/c/Users/..." format.

    Also handles cases where the username in the path doesn't match the actual
    Windows user directory (e.g., path says "Users\\du" but actual dir is "Users\\13397").

    Args:
        path: The path to potentially convert

    Returns:
        Converted path or original path if no conversion needed
    """
    # Check if it looks like a Windows absolute path (e.g., "C:\..." or "C:/...")
    if len(path) >= 2 and path[1] == ':':
        drive = path[0].lower()
        # Replace "C:\..." or "C:/..." with "/mnt/c/..."
        path_without_drive = path[2:].replace('\\', '/').replace('//', '/')
        converted = f"/mnt/{drive}{path_without_drive}"

        # Check if the converted path exists
        # If not, try to find the actual user directory (e.g., Users\\13397 instead of Users\\du)
        if not os.path.exists(converted) and "/Users/" in converted:
            # Extract parts: /mnt/c/Users/username/AppData/Roaming/auto-claude-ui/settings.json
            # We need to find the correct username and reconstruct the path
            parts = converted.split("/Users/")
            if len(parts) > 1:
                # Everything after /Users/username/ is the path we want to keep
                remaining = parts[1].split("/", 1)
                if len(remaining) > 1:
                    path_after_user = remaining[1]  # e.g., AppData/Roaming/auto-claude-ui/settings.json

                    # Try to find the actual user directory
                    users_dir = f"/mnt/{drive}/Users"
                    if os.path.exists(users_dir):
                        # Look for the actual settings.json in any user directory
                        for entry in os.listdir(users_dir):
                            user_dir = os.path.join(users_dir, entry)
                            if os.path.isdir(user_dir):
                                # Check if this is the correct user directory by looking for the app folder
                                check_path = os.path.join(user_dir, path_after_user)
                                if os.path.exists(check_path):
                                    # Found the correct user directory, return the full path
                                    return check_path

        return converted
    return path


def _get_config_base_path() -> Path:
    """
    Get the base directory for configuration files.

    Returns:
        Path to the config directory (platform-specific)
    """
    if platform.system() == "Windows":
        app_data = os.environ.get("APPDATA", "")
        return Path(app_data)
    elif platform.system() == "Darwin":  # macOS
        app_data = os.environ.get("HOME", "")
        return Path(app_data) / "Library" / "Application Support"
    else:  # Linux
        config_home = os.environ.get("XDG_CONFIG_HOME", os.path.expanduser("~/.config"))
        return Path(config_home)


def get_user_language_preference() -> str:
    """
    Get the user's language preference from the frontend settings.

    Reads the language setting from the Electron app's settings.json file.
    This allows AI agents to respond in the user's preferred language.

    Returns:
        Language code ('en', 'zh', 'fr', etc.) - defaults to 'en' if not found
    """
    try:
        # Try to get the path from environment variable first (set by Electron)
        if app_data_path := os.environ.get("AUTO_CLAUDE_APP_DATA"):
            # Handle Windows-style paths when running in WSL
            # Frontend (Windows) may pass paths like "C:\Users\..." which need conversion
            app_data_path = _convert_windows_path_for_wsl(app_data_path)
            settings_file = Path(app_data_path) / "settings.json"
        else:
            # Fallback to platform-specific default paths for Electron app "Auto Claude"
            # Electron uses the app.name for the userData directory
            # Try multiple possible directory names
            config_base = _get_config_base_path()
            possible_names = ["auto-claude-ui", "auto-claude", "Auto Claude"]
            settings_file = None
            for name in possible_names:
                test_file = config_base / name / "settings.json"
                if test_file.exists():
                    settings_file = test_file
                    break

            if settings_file is None:
                # Last resort: try the first name
                settings_file = config_base / possible_names[0] / "settings.json"

        if settings_file.exists():
            with open(settings_file, "r", encoding="utf-8") as f:
                settings = json.load(f)
                language = settings.get("language")
                if language and language in STRENGTHENED_LANGUAGE_INSTRUCTIONS:
                    logger.debug(f"User language preference: {language}")
                    return language

        return DEFAULT_LANGUAGE
    except Exception as e:
        logger.debug(f"Could not read user language preference: {e}")
        return DEFAULT_LANGUAGE


# =============================================================================
# Language Instruction Generation
# =============================================================================

def get_strengthened_language_instruction(agent_type: str | None = None) -> str | None:
    """
    Get strengthened language instruction for system prompts.

    Uses more imperative language to ensure AI compliance.
    This should be used for system prompts where maximum compliance is needed.

    Args:
        agent_type: Optional agent type for exclusion rules

    Returns:
        Strengthened language instruction string, or None if injection should be skipped
    """
    # Skip injection for excluded agent types
    if agent_type in EXCLUDED_AGENTS:
        logger.debug(f"Language injection excluded for agent type: {agent_type}")
        return None

    user_language = get_user_language_preference()
    base_instruction = STRENGTHENED_LANGUAGE_INSTRUCTIONS.get(
        user_language,
        STRENGTHENED_LANGUAGE_INSTRUCTIONS[DEFAULT_LANGUAGE]
    )

    # For JSON output agents, add explicit instruction about keys vs values
    if agent_type in JSON_OUTPUT_AGENTS:
        language_name = LANGUAGE_NAMES.get(user_language, user_language)
        json_note = (
            "\n\n**For JSON output**: All JSON keys MUST remain in English. "
            f"However, ALL JSON values (title, description, etc.) MUST be in {language_name}."
        )
        return f"{base_instruction}{json_note}"

    return base_instruction


def inject_language_strengthened(
    system_prompt: str | None,
    agent_type: str | None = None,
) -> str:
    """
    Inject strengthened language preference instruction into a system prompt.

    This is the RECOMMENDED function for system prompts as it uses more
    imperative language to ensure AI compliance.

    Args:
        system_prompt: The original system prompt
        agent_type: Optional agent type for exclusion rules

    Returns:
        System prompt with strengthened language instruction, or original
        prompt if injection is not applicable
    """
    base = system_prompt or "You are a helpful AI assistant."
    instruction = get_strengthened_language_instruction(agent_type)

    if not instruction:
        return base

    # Log when using non-default language
    user_language = get_user_language_preference()
    if user_language != DEFAULT_LANGUAGE:
        logger.info(f"Injecting STRENGTHENED language preference: {user_language} for agent: {agent_type}")

    return f"{base}\n\n# LANGUAGE REQUIREMENT (CRITICAL)\n\n{instruction}"


def get_prompt_language_instruction() -> str:
    """
    Get language instruction for user message prompts.

    Returns a concise instruction suitable for prepending to user messages.
    Returns empty string if language is default (no instruction needed).

    Returns:
        Concise language instruction string, or empty string
    """
    user_language = get_user_language_preference()
    if user_language == DEFAULT_LANGUAGE:
        return ""
    return PROMPT_LANGUAGE_INSTRUCTIONS.get(
        user_language,
        PROMPT_LANGUAGE_INSTRUCTIONS[DEFAULT_LANGUAGE]
    )


# =============================================================================
# Localized Prompt Path Resolution
# =============================================================================

def get_localized_prompt_path(
    prompts_dir: Path,
    prompt_file: str,
) -> Path:
    """
    Get the localized version of a prompt file based on user language preference.

    This function enables multi-language prompt support by checking for a
    localized version of the prompt file before falling back to English.

    Directory structure:
        prompts/
        ├── planner.md          # English (default)
        ├── coder.md            # English (default)
        └── zh/                 # Chinese translations
            ├── planner.md
            └── coder.md

    Args:
        prompts_dir: Base prompts directory (e.g., Path("apps/backend/prompts"))
        prompt_file: Prompt filename (e.g., "planner.md", "github/pr_approve.md")

    Returns:
        Path to the localized prompt file, or the English default if no
        localized version exists

    Examples:
        >>> # User language is "zh", prompts/zh/planner.md exists
        >>> get_localized_prompt_path(Path("prompts"), "planner.md")
        Path("prompts/zh/planner.md")

        >>> # User language is "zh", but no Chinese version exists
        >>> get_localized_prompt_path(Path("prompts"), "new_feature.md")
        Path("prompts/new_feature.md")
    """
    user_language = get_user_language_preference()

    # If using default language (English), return standard path
    if user_language == DEFAULT_LANGUAGE:
        return prompts_dir / prompt_file

    # Try localized version first (e.g., prompts/zh/planner.md)
    localized_dir = prompts_dir / user_language
    localized_path = localized_dir / prompt_file

    if localized_path.exists():
        logger.debug(f"Using localized prompt: {localized_path}")
        return localized_path

    # Fallback to English version
    logger.debug(f"Localized prompt not found, using default: {prompt_file}")
    return prompts_dir / prompt_file


# =============================================================================
# Prompt Language Instructions (for User Messages)
# =============================================================================

def inject_into_prompt(
    prompt: str,
    agent_type: str | None = None,
) -> str:
    """
    Inject language instruction into a user message prompt.

    Places the instruction AFTER the prompt content so it's the last thing AI reads
    before starting work. This prevents the instruction from being buried in long templates.

    Args:
        prompt: The original prompt content (e.g., from a .md template file)
        agent_type: Optional agent type for JSON output detection

    Returns:
        Prompt with language instruction appended, or original prompt
        if language is default (no instruction needed)

    Examples:
        >>> inject_into_prompt("## Your Role\\nYou are a coder...", "coder")
        "## Your Role...\\n\\n---\\n\\n# LANGUAGE REQUIREMENT (CRITICAL)..."

        >>> inject_into_prompt("Some prompt", "commit_message")
        "Some prompt"  # No injection for commit_message
    """
    user_language = get_user_language_preference()

    # For JSON output agents, use FULLY LOCALIZED instructions (not mixed English/localized language)
    if agent_type in JSON_OUTPUT_AGENTS:
        if user_language == "zh":
            instruction = (
                "# 【语言要求】必须用中文回复\n\n"
                "你必须用中文回复所有内容！JSON 键(keys)保持英文，但所有值(values)必须用中文。\n\n"
                "即使上面的模板中有英文示例，你的输出也必须用中文。\n"
                "现在开始工作，遵循此语言要求。"
            )
        elif user_language == "fr":
            instruction = (
                "# Exigence linguistique\n\n"
                f"Vous devez répondre en français pour toutes les sorties en langage naturel.\n\n"
                "★ Pour les sorties JSON : les clés doivent rester en anglais, "
                "mais toutes les valeurs doivent être en français.\n\n"
                "C'est une obligation qui prime sur tout exemple anglais dans le modèle ci-dessus."
            )
        else:
            language_name = LANGUAGE_NAMES.get(user_language, user_language)
            instruction = (
                "# LANGUAGE REQUIREMENT (CRITICAL - READ BEFORE STARTING)\n\n"
                f"You MUST respond in {language_name} for all natural language output.\n\n"
                f"★ JSON OUTPUT REQUIREMENTS:\n"
                f"  - JSON keys: English ONLY (e.g., \"title\", \"description\", \"id\")\n"
                f"  - JSON values: {language_name} ONLY (e.g., title, description, rationale must be in {language_name})\n\n"
                f"This is a MANDATORY requirement that overrides any English examples in the template above.\n"
                f"Start working NOW, following this language requirement."
            )
    else:
        base_instruction = get_prompt_language_instruction()
        if not base_instruction:
            return prompt
        instruction = (
            f"# LANGUAGE REQUIREMENT (CRITICAL)\n\n"
            f"{base_instruction}\n\n"
            f"This is a MANDATORY requirement that overrides any English examples in the template above."
        )

    # Place instruction AFTER the prompt (last thing AI reads)
    return f"{prompt}\n\n---\n\n{instruction}"
