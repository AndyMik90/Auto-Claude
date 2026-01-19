"""
iFlow Tool Definitions and Execution
=====================================

OpenAI-compatible tool definitions for iFlow agent clients.
Implements local execution of tools that mirror Claude Agent SDK capabilities.

Tools implemented:
- Read: Read file contents
- Write: Write/create files
- Edit: Find and replace in files
- Bash: Execute shell commands
- Glob: Find files by pattern
- Grep: Search file contents
"""

import json
import logging
import os
import re
import subprocess
from dataclasses import dataclass
from fnmatch import fnmatch
from pathlib import Path
from typing import Any

logger = logging.getLogger(__name__)


# =============================================================================
# Tool Schemas (OpenAI Function Calling Format)
# =============================================================================

TOOL_SCHEMAS = [
    {
        "type": "function",
        "function": {
            "name": "Read",
            "description": "Read the contents of a file. Returns the file content with line numbers.",
            "parameters": {
                "type": "object",
                "properties": {
                    "file_path": {
                        "type": "string",
                        "description": "The absolute or relative path to the file to read"
                    },
                    "offset": {
                        "type": "integer",
                        "description": "Line number to start reading from (1-indexed). Optional."
                    },
                    "limit": {
                        "type": "integer",
                        "description": "Maximum number of lines to read. Optional."
                    }
                },
                "required": ["file_path"]
            }
        }
    },
    {
        "type": "function",
        "function": {
            "name": "Write",
            "description": "Write content to a file. Creates the file if it doesn't exist, overwrites if it does.",
            "parameters": {
                "type": "object",
                "properties": {
                    "file_path": {
                        "type": "string",
                        "description": "The absolute or relative path to the file to write"
                    },
                    "content": {
                        "type": "string",
                        "description": "The content to write to the file"
                    }
                },
                "required": ["file_path", "content"]
            }
        }
    },
    {
        "type": "function",
        "function": {
            "name": "Edit",
            "description": "Edit a file by replacing old_string with new_string. The old_string must be unique in the file.",
            "parameters": {
                "type": "object",
                "properties": {
                    "file_path": {
                        "type": "string",
                        "description": "The absolute or relative path to the file to edit"
                    },
                    "old_string": {
                        "type": "string",
                        "description": "The exact string to find and replace"
                    },
                    "new_string": {
                        "type": "string",
                        "description": "The string to replace old_string with"
                    },
                    "replace_all": {
                        "type": "boolean",
                        "description": "If true, replace all occurrences. Default is false (replace first only)."
                    }
                },
                "required": ["file_path", "old_string", "new_string"]
            }
        }
    },
    {
        "type": "function",
        "function": {
            "name": "Bash",
            "description": "Execute a bash command and return the output. Use for git, npm, build commands, etc.",
            "parameters": {
                "type": "object",
                "properties": {
                    "command": {
                        "type": "string",
                        "description": "The bash command to execute"
                    },
                    "timeout": {
                        "type": "integer",
                        "description": "Timeout in seconds. Default is 120."
                    }
                },
                "required": ["command"]
            }
        }
    },
    {
        "type": "function",
        "function": {
            "name": "Glob",
            "description": "Find files matching a glob pattern. Returns list of matching file paths.",
            "parameters": {
                "type": "object",
                "properties": {
                    "pattern": {
                        "type": "string",
                        "description": "Glob pattern to match (e.g., '**/*.py', 'src/**/*.ts')"
                    },
                    "path": {
                        "type": "string",
                        "description": "Base directory to search in. Optional, defaults to current directory."
                    }
                },
                "required": ["pattern"]
            }
        }
    },
    {
        "type": "function",
        "function": {
            "name": "Grep",
            "description": "Search for a pattern in files. Returns matching lines with file paths and line numbers.",
            "parameters": {
                "type": "object",
                "properties": {
                    "pattern": {
                        "type": "string",
                        "description": "Regular expression pattern to search for"
                    },
                    "path": {
                        "type": "string",
                        "description": "File or directory to search in. Optional, defaults to current directory."
                    },
                    "glob": {
                        "type": "string",
                        "description": "Glob pattern to filter files (e.g., '*.py'). Optional."
                    }
                },
                "required": ["pattern"]
            }
        }
    },
]


# =============================================================================
# Tool Execution Context
# =============================================================================

@dataclass
class ToolContext:
    """Context for tool execution with security constraints."""

    project_dir: Path
    spec_dir: Path
    allowed_paths: list[Path] | None = None
    bash_validator: Any | None = None  # Security hook for bash commands

    def __post_init__(self):
        """Initialize allowed paths if not provided."""
        if self.allowed_paths is None:
            self.allowed_paths = [
                self.project_dir.resolve(),
                self.spec_dir.resolve(),
            ]

    def is_path_allowed(self, path: Path) -> bool:
        """Check if a path is within allowed directories."""
        try:
            resolved = path.resolve()
            return any(
                str(resolved).startswith(str(allowed))
                for allowed in self.allowed_paths
            )
        except Exception:
            return False

    def resolve_path(self, file_path: str) -> Path:
        """
        Resolve a file path to absolute path.

        Logic:
        - If path is absolute, use as-is
        - If path contains '.auto-claude/specs', extract and use spec_dir + filename only
        - If it's a known spec file (by name), use spec_dir
        - Otherwise resolve relative to project_dir
        """
        path = Path(file_path)
        path_str = str(file_path)

        if path.is_absolute():
            return path.resolve()

        # Check if this is a spec-related file
        spec_files = {
            'spec.md', 'implementation_plan.json', 'requirements.json',
            'context.json', 'project_index.json', 'complexity_assessment.json',
            'task_metadata.json', 'task_logs.json', 'graph_hints.json',
            'research.json', 'critique_report.json', 'qa_report.md',
            'build-progress.txt', 'qa_report.md',
        }

        file_name = path.name

        # IMPORTANT: If path already contains .auto-claude/specs, extract just the filename
        # to avoid creating nested directories like .auto-claude/specs/XXX/.auto-claude/specs/XXX/
        if '.auto-claude/specs' in path_str or '.auto-claude\\specs' in path_str:
            if self.spec_dir and file_name in spec_files:
                logger.debug(f"[iFlow Tools] Extracting filename from nested path: {path_str} -> {file_name}")
                return (self.spec_dir / file_name).resolve()

        # If it's a known spec file by name, use spec_dir directly
        if file_name in spec_files:
            if self.spec_dir:
                return (self.spec_dir / file_name).resolve()

        # Default: resolve relative to project_dir
        return (self.project_dir / path).resolve()


# =============================================================================
# Tool Execution Functions
# =============================================================================

def execute_read(args: dict, context: ToolContext) -> dict:
    """
    Execute Read tool - read file contents.

    Args:
        args: {"file_path": str, "offset": int?, "limit": int?}
        context: Tool execution context

    Returns:
        {"success": bool, "content": str, "error": str?}
    """
    file_path = args.get("file_path", "")
    offset = args.get("offset", 1)
    limit = args.get("limit")

    # Validate required parameter
    if not file_path or not file_path.strip():
        return {
            "success": False,
            "error": "Missing required parameter: file_path. Please specify the file to read."
        }

    try:
        path = context.resolve_path(file_path)

        if not context.is_path_allowed(path):
            return {
                "success": False,
                "error": f"Access denied: {file_path} is outside allowed directories"
            }

        if not path.exists():
            return {
                "success": False,
                "error": f"File not found: {file_path}"
            }

        if not path.is_file():
            return {
                "success": False,
                "error": f"Not a file: {file_path}"
            }

        # Read file with line numbers
        with open(path, "r", encoding="utf-8", errors="replace") as f:
            lines = f.readlines()

        # Apply offset and limit
        start_idx = max(0, offset - 1)
        if limit:
            end_idx = start_idx + limit
            lines = lines[start_idx:end_idx]
        else:
            lines = lines[start_idx:]

        # Format with line numbers
        content_lines = []
        for i, line in enumerate(lines, start=offset):
            content_lines.append(f"{i:6d}→{line.rstrip()}")

        content = "\n".join(content_lines)

        return {
            "success": True,
            "content": content
        }

    except Exception as e:
        return {
            "success": False,
            "error": f"Read failed: {str(e)}"
        }


def execute_write(args: dict, context: ToolContext) -> dict:
    """
    Execute Write tool - write content to file.

    Args:
        args: {"file_path": str, "content": str}
        context: Tool execution context

    Returns:
        {"success": bool, "message": str, "error": str?}
    """
    file_path = args.get("file_path", "")
    content = args.get("content", "")

    # Validate required parameters
    if not file_path or not file_path.strip():
        return {
            "success": False,
            "error": "Missing required parameter: file_path. Please specify the file to write to."
        }
    # Note: content can be empty string (valid for creating empty file)

    try:
        path = context.resolve_path(file_path)

        if not context.is_path_allowed(path):
            return {
                "success": False,
                "error": f"Access denied: {file_path} is outside allowed directories"
            }

        # PROTECTION: Validate implementation_plan.json writes to prevent corruption
        if path.name == "implementation_plan.json":
            try:
                new_plan = json.loads(content)

                # Check if this is a valid plan structure (must have phases)
                if "phases" not in new_plan:
                    # Check if existing file has phases - if so, this is a destructive write
                    if path.exists():
                        try:
                            with open(path, "r", encoding="utf-8") as f:
                                existing_plan = json.load(f)
                            if "phases" in existing_plan and existing_plan["phases"]:
                                return {
                                    "success": False,
                                    "error": (
                                        "BLOCKED: Cannot overwrite implementation_plan.json with invalid structure. "
                                        "The new content is missing 'phases' array. "
                                        "To update subtask status, use Edit tool with proper JSON path like: "
                                        '"old_string": \'"status": "pending"\', "new_string": \'"status": "completed"\''
                                    )
                                }
                        except (json.JSONDecodeError, OSError):
                            pass  # Existing file is invalid, allow overwrite

                # Validate phases structure if present
                if "phases" in new_plan:
                    phases = new_plan["phases"]
                    if not isinstance(phases, list):
                        return {
                            "success": False,
                            "error": "Invalid implementation_plan.json: 'phases' must be an array"
                        }
                    # Check each phase has subtasks
                    for i, phase in enumerate(phases):
                        if not isinstance(phase, dict):
                            return {
                                "success": False,
                                "error": f"Invalid implementation_plan.json: phase {i} must be an object"
                            }
                        if "subtasks" not in phase and "chunks" not in phase:
                            logger.warning(f"[iFlow Tools] Phase {i} has no subtasks/chunks")

            except json.JSONDecodeError as e:
                return {
                    "success": False,
                    "error": f"Invalid JSON for implementation_plan.json: {str(e)}"
                }

        # Create parent directories if needed
        path.parent.mkdir(parents=True, exist_ok=True)

        # Write file
        with open(path, "w", encoding="utf-8") as f:
            f.write(content)

        return {
            "success": True,
            "message": f"Successfully wrote {len(content)} bytes to {file_path}"
        }

    except Exception as e:
        return {
            "success": False,
            "error": f"Write failed: {str(e)}"
        }


def execute_edit(args: dict, context: ToolContext) -> dict:
    """
    Execute Edit tool - find and replace in file.

    Args:
        args: {"file_path": str, "old_string": str, "new_string": str, "replace_all": bool?}
        context: Tool execution context

    Returns:
        {"success": bool, "message": str, "error": str?}
    """
    file_path = args.get("file_path", "")
    old_string = args.get("old_string", "")
    new_string = args.get("new_string", "")
    replace_all = args.get("replace_all", False)

    # Validate required parameters
    if not file_path or not file_path.strip():
        return {
            "success": False,
            "error": "Missing required parameter: file_path. Please specify the file to edit."
        }
    if not old_string:
        return {
            "success": False,
            "error": "Missing required parameter: old_string. Please specify the text to find and replace."
        }
    # Note: new_string can be empty (valid for deleting text)

    try:
        path = context.resolve_path(file_path)

        if not context.is_path_allowed(path):
            return {
                "success": False,
                "error": f"Access denied: {file_path} is outside allowed directories"
            }

        if not path.exists():
            return {
                "success": False,
                "error": f"File not found: {file_path}"
            }

        # Read current content
        with open(path, "r", encoding="utf-8") as f:
            content = f.read()

        # Check if old_string exists
        if old_string not in content:
            return {
                "success": False,
                "error": f"String not found in file: {old_string[:100]}..."
            }

        # Check uniqueness if not replace_all
        if not replace_all and content.count(old_string) > 1:
            return {
                "success": False,
                "error": f"String appears {content.count(old_string)} times. Use replace_all=true or provide more context."
            }

        # Perform replacement
        if replace_all:
            new_content = content.replace(old_string, new_string)
            count = content.count(old_string)
        else:
            new_content = content.replace(old_string, new_string, 1)
            count = 1

        # Write back
        with open(path, "w", encoding="utf-8") as f:
            f.write(new_content)

        return {
            "success": True,
            "message": f"Replaced {count} occurrence(s) in {file_path}"
        }

    except Exception as e:
        return {
            "success": False,
            "error": f"Edit failed: {str(e)}"
        }


def execute_bash(args: dict, context: ToolContext) -> dict:
    """
    Execute Bash tool - run shell command.

    Args:
        args: {"command": str, "timeout": int?}
        context: Tool execution context

    Returns:
        {"success": bool, "stdout": str, "stderr": str, "exit_code": int, "error": str?}
    """
    command = args.get("command", "")
    timeout = args.get("timeout", 120)

    # Validate required parameters
    if not command or not command.strip():
        return {
            "success": False,
            "error": "Missing required parameter: command. Please specify the bash command to execute."
        }

    try:
        # Security validation if hook is provided
        if context.bash_validator:
            validation_result = context.bash_validator(command)
            if validation_result and not validation_result.get("allowed", True):
                return {
                    "success": False,
                    "error": f"Command blocked by security policy: {validation_result.get('reason', 'Unknown')}"
                }

        # Basic security checks
        dangerous_patterns = [
            r'\brm\s+-rf\s+/',  # rm -rf /
            r'\bsudo\b',  # sudo commands
            r'\b(chmod|chown)\s+.*/',  # chmod/chown on root
            r'>\s*/dev/',  # writing to /dev
            r'\bkill\s+-9\s+1\b',  # kill init
            r'\bmkfs\b',  # format filesystem
            r'\bdd\s+.*of=/',  # dd to root
        ]

        for pattern in dangerous_patterns:
            if re.search(pattern, command):
                return {
                    "success": False,
                    "error": f"Command blocked: potentially dangerous operation"
                }

        # Execute command
        result = subprocess.run(
            command,
            shell=True,
            cwd=str(context.project_dir),
            capture_output=True,
            text=True,
            timeout=timeout,
            env={**os.environ, "PYTHONUNBUFFERED": "1"}
        )

        return {
            "success": result.returncode == 0,
            "stdout": result.stdout,
            "stderr": result.stderr,
            "exit_code": result.returncode
        }

    except subprocess.TimeoutExpired:
        return {
            "success": False,
            "error": f"Command timed out after {timeout} seconds"
        }
    except Exception as e:
        return {
            "success": False,
            "error": f"Bash execution failed: {str(e)}"
        }


def execute_glob(args: dict, context: ToolContext) -> dict:
    """
    Execute Glob tool - find files by pattern.

    Args:
        args: {"pattern": str, "path": str?}
        context: Tool execution context

    Returns:
        {"success": bool, "files": list[str], "error": str?}
    """
    pattern = args.get("pattern", "")
    base_path = args.get("path", ".")

    # Validate required parameters
    if not pattern or not pattern.strip():
        return {
            "success": False,
            "error": "Missing required parameter: pattern. Please specify a glob pattern (e.g., '**/*.py', 'src/**/*.ts')."
        }

    try:
        search_dir = context.resolve_path(base_path)

        if not context.is_path_allowed(search_dir):
            return {
                "success": False,
                "error": f"Access denied: {base_path} is outside allowed directories"
            }

        if not search_dir.exists():
            return {
                "success": False,
                "error": f"Directory not found: {base_path}"
            }

        # Use pathlib glob
        matches = []
        for match in search_dir.glob(pattern):
            # Return relative paths
            try:
                rel_path = match.relative_to(context.project_dir)
                matches.append(str(rel_path))
            except ValueError:
                matches.append(str(match))

        # Sort and limit results
        matches.sort()
        if len(matches) > 1000:
            matches = matches[:1000]
            truncated = True
        else:
            truncated = False

        return {
            "success": True,
            "files": matches,
            "count": len(matches),
            "truncated": truncated
        }

    except Exception as e:
        return {
            "success": False,
            "error": f"Glob failed: {str(e)}"
        }


def execute_grep(args: dict, context: ToolContext) -> dict:
    """
    Execute Grep tool - search for pattern in files.

    Args:
        args: {"pattern": str, "path": str?, "glob": str?}
        context: Tool execution context

    Returns:
        {"success": bool, "matches": list[dict], "error": str?}
    """
    pattern = args.get("pattern", "")
    base_path = args.get("path", ".")
    file_glob = args.get("glob", "**/*")

    # Validate required parameters
    if not pattern or not pattern.strip():
        return {
            "success": False,
            "error": "Missing required parameter: pattern. Please specify a regex pattern to search for."
        }

    try:
        search_dir = context.resolve_path(base_path)

        if not context.is_path_allowed(search_dir):
            return {
                "success": False,
                "error": f"Access denied: {base_path} is outside allowed directories"
            }

        regex = re.compile(pattern)
        matches = []
        files_searched = 0

        # Search files
        for file_path in search_dir.glob(file_glob):
            if not file_path.is_file():
                continue

            # Skip binary files and large files
            if file_path.stat().st_size > 1_000_000:  # 1MB limit
                continue

            try:
                with open(file_path, "r", encoding="utf-8", errors="ignore") as f:
                    for line_num, line in enumerate(f, 1):
                        if regex.search(line):
                            try:
                                rel_path = file_path.relative_to(context.project_dir)
                            except ValueError:
                                rel_path = file_path

                            matches.append({
                                "file": str(rel_path),
                                "line": line_num,
                                "content": line.rstrip()[:500]  # Limit line length
                            })

                            # Limit total matches
                            if len(matches) >= 500:
                                break

                files_searched += 1

            except Exception:
                continue  # Skip files that can't be read

            if len(matches) >= 500:
                break

        return {
            "success": True,
            "matches": matches,
            "count": len(matches),
            "files_searched": files_searched,
            "truncated": len(matches) >= 500
        }

    except re.error as e:
        return {
            "success": False,
            "error": f"Invalid regex pattern: {str(e)}"
        }
    except Exception as e:
        return {
            "success": False,
            "error": f"Grep failed: {str(e)}"
        }


# =============================================================================
# Tool Dispatcher
# =============================================================================

TOOL_EXECUTORS = {
    "Read": execute_read,
    "Write": execute_write,
    "Edit": execute_edit,
    "Bash": execute_bash,
    "Glob": execute_glob,
    "Grep": execute_grep,
}


def execute_tool(tool_name: str, args: dict | str | None, context: ToolContext) -> dict:
    """
    Execute a tool by name with given arguments.

    Args:
        tool_name: Name of the tool to execute
        args: Tool arguments as dict (or string/None if parsing failed)
        context: Tool execution context

    Returns:
        Tool execution result as dict
    """
    executor = TOOL_EXECUTORS.get(tool_name)

    if not executor:
        return {
            "success": False,
            "error": f"Unknown tool: {tool_name}"
        }

    # Ensure args is a dict - handle various malformed formats from iFlow models
    if args is None:
        args = {}
    elif isinstance(args, str):
        # Try to parse as JSON if it's a string
        try:
            parsed = json.loads(args) if args else {}
            # Handle double-encoded JSON
            if isinstance(parsed, str):
                try:
                    parsed = json.loads(parsed)
                except json.JSONDecodeError:
                    logger.warning(f"[iFlow Tools] Double-decoded but still string: {parsed[:100]}")
                    parsed = {}
            args = parsed if isinstance(parsed, dict) else {}
        except json.JSONDecodeError:
            logger.warning(f"[iFlow Tools] Invalid JSON arguments for {tool_name}: {args[:200]}")
            # Return empty dict to allow tool to report missing required params
            args = {}

    if not isinstance(args, dict):
        logger.warning(f"[iFlow Tools] Args not a dict after parsing: {type(args).__name__} = {str(args)[:100]}")
        args = {}

    logger.info(f"[iFlow Tools] Executing {tool_name} with args: {_summarize_args(args)}")

    result = executor(args, context)

    if result.get("success"):
        logger.info(f"[iFlow Tools] {tool_name} completed successfully")
    else:
        logger.warning(f"[iFlow Tools] {tool_name} failed: {result.get('error')}")

    return result


def _summarize_args(args: dict | str | None) -> str:
    """Create a summary of tool arguments for logging."""
    if args is None:
        return "<no args>"
    if isinstance(args, str):
        return f"<string: {args[:100]}...>" if len(args) > 100 else f"<string: {args}>"
    if not isinstance(args, dict):
        return f"<{type(args).__name__}: {str(args)[:100]}>"

    summary_parts = []
    for key, value in args.items():
        if isinstance(value, str) and len(value) > 100:
            summary_parts.append(f"{key}=<{len(value)} chars>")
        else:
            summary_parts.append(f"{key}={repr(value)}")
    return ", ".join(summary_parts)


def format_tool_result(tool_name: str, result: dict) -> str:
    """
    Format tool result for inclusion in conversation.

    Args:
        tool_name: Name of the tool
        result: Tool execution result

    Returns:
        Formatted string for the conversation
    """
    if not result.get("success"):
        return f"Error: {result.get('error', 'Unknown error')}"

    if tool_name == "Read":
        return result.get("content", "")

    elif tool_name == "Write":
        return result.get("message", "File written successfully")

    elif tool_name == "Edit":
        return result.get("message", "Edit completed successfully")

    elif tool_name == "Bash":
        output_parts = []
        if result.get("stdout"):
            output_parts.append(result["stdout"])
        if result.get("stderr"):
            output_parts.append(f"stderr: {result['stderr']}")
        output_parts.append(f"Exit code: {result.get('exit_code', 0)}")
        return "\n".join(output_parts)

    elif tool_name == "Glob":
        files = result.get("files", [])
        if not files:
            return "No files found"
        output = "\n".join(files[:100])
        if result.get("truncated"):
            output += f"\n... and {result['count'] - 100} more files"
        return output

    elif tool_name == "Grep":
        matches = result.get("matches", [])
        if not matches:
            return "No matches found"
        output_lines = []
        for m in matches[:50]:
            output_lines.append(f"{m['file']}:{m['line']}: {m['content']}")
        if result.get("truncated"):
            output_lines.append(f"... and more matches (truncated)")
        return "\n".join(output_lines)

    return json.dumps(result)
