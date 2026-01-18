"""BMAD Project Analysis workflow.

This module implements the project analysis phase for the BMAD methodology.
It scans the project structure, detects technology stack, and loads any
existing BMAD configuration.

Story Reference: Story 6.2 - Implement BMAD Project Analysis Phase
Architecture Source: architecture.md#BMAD-Plugin-Structure
"""

import json
import logging
from dataclasses import asdict, dataclass, field
from datetime import datetime
from pathlib import Path
from typing import Any

import yaml

logger = logging.getLogger(__name__)


@dataclass
class ProjectTechStack:
    """Detected technology stack for the project.

    Attributes:
        languages: List of detected programming languages
        frameworks: List of detected frameworks
        build_tools: List of detected build tools
        package_managers: List of detected package managers
        testing_frameworks: List of detected testing frameworks
    """

    languages: list[str] = field(default_factory=list)
    frameworks: list[str] = field(default_factory=list)
    build_tools: list[str] = field(default_factory=list)
    package_managers: list[str] = field(default_factory=list)
    testing_frameworks: list[str] = field(default_factory=list)


@dataclass
class ProjectStructure:
    """Structure information about the project.

    Attributes:
        root_dir: Path to the project root
        is_monorepo: Whether the project is a monorepo
        services: List of services/packages found
        config_files: List of configuration files found
        source_dirs: List of source directories
    """

    root_dir: str = ""
    is_monorepo: bool = False
    services: list[str] = field(default_factory=list)
    config_files: list[str] = field(default_factory=list)
    source_dirs: list[str] = field(default_factory=list)


@dataclass
class BMADConfig:
    """BMAD configuration loaded from project.

    Attributes:
        exists: Whether BMAD config file exists
        config_path: Path to the BMAD config file
        personas: List of configured personas
        workflows: List of configured workflows
        settings: Additional settings from config
    """

    exists: bool = False
    config_path: str = ""
    personas: list[str] = field(default_factory=list)
    workflows: list[str] = field(default_factory=list)
    settings: dict[str, Any] = field(default_factory=dict)


@dataclass
class ProjectAnalysis:
    """Complete project analysis result.

    This is the main output of the analyze_project function and is
    serialized to analysis.json artifact.

    Attributes:
        project_name: Name of the project
        tech_stack: Detected technology stack
        structure: Project structure information
        bmad_config: BMAD configuration if exists
        analyzed_at: Timestamp of analysis
        analysis_version: Version of the analysis format
    """

    project_name: str = ""
    tech_stack: ProjectTechStack = field(default_factory=ProjectTechStack)
    structure: ProjectStructure = field(default_factory=ProjectStructure)
    bmad_config: BMADConfig = field(default_factory=BMADConfig)
    analyzed_at: str = ""
    analysis_version: str = "1.0.0"

    def to_dict(self) -> dict[str, Any]:
        """Convert to dictionary for JSON serialization."""
        return asdict(self)


# File pattern indicators for technology detection
TECH_INDICATORS: dict[str, dict[str, list[str]]] = {
    "languages": {
        "python": ["*.py", "requirements.txt", "pyproject.toml", "setup.py"],
        "typescript": ["*.ts", "*.tsx", "tsconfig.json"],
        "javascript": ["*.js", "*.jsx", "*.mjs"],
        "rust": ["*.rs", "Cargo.toml"],
        "go": ["*.go", "go.mod"],
        "java": ["*.java", "pom.xml", "build.gradle"],
    },
    "frameworks": {
        "react": ["package.json:react", "*.tsx", "*.jsx"],
        "vue": ["package.json:vue", "*.vue"],
        "angular": ["package.json:@angular", "angular.json"],
        "django": ["manage.py", "settings.py", "requirements.txt:django"],
        "flask": ["requirements.txt:flask", "app.py"],
        "fastapi": ["requirements.txt:fastapi", "main.py"],
        "express": ["package.json:express"],
        "nextjs": ["package.json:next", "next.config.js"],
        "electron": ["package.json:electron", "main.js"],
    },
    "build_tools": {
        "vite": ["vite.config.ts", "vite.config.js"],
        "webpack": ["webpack.config.js"],
        "rollup": ["rollup.config.js"],
        "esbuild": ["esbuild.config.js"],
        "make": ["Makefile"],
        "cmake": ["CMakeLists.txt"],
    },
    "package_managers": {
        "npm": ["package-lock.json"],
        "yarn": ["yarn.lock"],
        "pnpm": ["pnpm-lock.yaml"],
        "pip": ["requirements.txt"],
        "poetry": ["poetry.lock", "pyproject.toml:poetry"],
        "uv": ["uv.lock"],
        "cargo": ["Cargo.lock"],
    },
    "testing_frameworks": {
        "jest": ["package.json:jest", "jest.config.js"],
        "vitest": ["package.json:vitest", "vitest.config.ts"],
        "pytest": ["pytest.ini", "conftest.py", "requirements.txt:pytest"],
        "mocha": ["package.json:mocha"],
        "cypress": ["cypress.config.js", "cypress.config.ts"],
    },
}


def _detect_file_exists(project_dir: Path, pattern: str) -> bool:
    """Check if a file matching the pattern exists in the project.

    Args:
        project_dir: Root directory of the project
        pattern: File pattern to check (glob pattern or package.json:dependency)

    Returns:
        True if the pattern is matched
    """
    if ":" in pattern:
        # Handle package.json:dependency pattern
        file_part, dependency = pattern.split(":", 1)
        file_path = project_dir / file_part
        if file_path.exists():
            try:
                content = file_path.read_text()
                return dependency in content
            except Exception:
                return False
        return False
    else:
        # Handle glob pattern
        matches = list(project_dir.glob(pattern))
        if matches:
            return True
        # Also check in immediate subdirectories for monorepos
        for subdir in project_dir.iterdir():
            if subdir.is_dir() and not subdir.name.startswith("."):
                if list(subdir.glob(pattern)):
                    return True
        return False


def _detect_tech_stack(project_dir: Path) -> ProjectTechStack:
    """Detect the technology stack of the project.

    Args:
        project_dir: Root directory of the project

    Returns:
        ProjectTechStack with detected technologies
    """
    tech_stack = ProjectTechStack()

    for category, indicators in TECH_INDICATORS.items():
        detected: list[str] = []
        for tech_name, patterns in indicators.items():
            for pattern in patterns:
                if _detect_file_exists(project_dir, pattern):
                    if tech_name not in detected:
                        detected.append(tech_name)
                    break

        # Set the detected items on the appropriate attribute
        setattr(tech_stack, category, detected)

    return tech_stack


def _analyze_structure(project_dir: Path) -> ProjectStructure:
    """Analyze the project structure.

    Args:
        project_dir: Root directory of the project

    Returns:
        ProjectStructure with structure information
    """
    structure = ProjectStructure()
    structure.root_dir = str(project_dir)

    # Check for monorepo indicators
    is_monorepo = False
    services: list[str] = []

    # Check for common monorepo structures
    apps_dir = project_dir / "apps"
    packages_dir = project_dir / "packages"
    services_dir = project_dir / "services"

    for mono_dir in [apps_dir, packages_dir, services_dir]:
        if mono_dir.exists() and mono_dir.is_dir():
            is_monorepo = True
            for subdir in mono_dir.iterdir():
                if subdir.is_dir() and not subdir.name.startswith("."):
                    services.append(f"{mono_dir.name}/{subdir.name}")

    structure.is_monorepo = is_monorepo
    structure.services = services

    # Find configuration files
    config_patterns = [
        "*.yaml",
        "*.yml",
        "*.json",
        "*.toml",
        "*.ini",
        "*.config.js",
        "*.config.ts",
    ]
    config_files: list[str] = []
    for pattern in config_patterns:
        for match in project_dir.glob(pattern):
            if match.is_file() and not match.name.startswith("."):
                config_files.append(match.name)

    structure.config_files = sorted(set(config_files))

    # Find source directories
    source_dirs: list[str] = []
    common_source_dirs = ["src", "lib", "app", "api", "core", "components", "pages"]
    for dirname in common_source_dirs:
        if (project_dir / dirname).is_dir():
            source_dirs.append(dirname)

    structure.source_dirs = source_dirs

    return structure


def _load_bmad_config(project_dir: Path) -> BMADConfig:
    """Load BMAD configuration from the project if it exists.

    Looks for BMAD config in common locations:
    - _bmad/bmm/config.yaml
    - .bmad/config.yaml
    - bmad.yaml
    - bmad.config.yaml

    Args:
        project_dir: Root directory of the project

    Returns:
        BMADConfig with loaded configuration
    """
    bmad_config = BMADConfig()

    # Check for BMAD config in common locations
    config_paths = [
        project_dir / "_bmad" / "bmm" / "config.yaml",
        project_dir / ".bmad" / "config.yaml",
        project_dir / "bmad.yaml",
        project_dir / "bmad.config.yaml",
    ]

    for config_path in config_paths:
        if config_path.exists():
            bmad_config.exists = True
            bmad_config.config_path = str(config_path)

            try:
                # SECURITY: Always use safe_load for YAML parsing
                with open(config_path) as f:
                    config_data = yaml.safe_load(f) or {}

                # Extract personas if defined
                if "personas" in config_data:
                    personas = config_data["personas"]
                    if isinstance(personas, dict):
                        bmad_config.personas = list(personas.keys())
                    elif isinstance(personas, list):
                        bmad_config.personas = personas

                # Extract workflows if defined
                if "workflows" in config_data:
                    workflows = config_data["workflows"]
                    if isinstance(workflows, dict):
                        bmad_config.workflows = list(workflows.keys())
                    elif isinstance(workflows, list):
                        bmad_config.workflows = workflows

                # Store other settings
                for key, value in config_data.items():
                    if key not in ("personas", "workflows"):
                        bmad_config.settings[key] = value

            except yaml.YAMLError as e:
                logger.warning(f"Failed to parse BMAD config at {config_path}: {e}")
            except Exception as e:
                logger.warning(f"Failed to load BMAD config at {config_path}: {e}")

            # Stop after finding the first config
            break

    return bmad_config


def _get_project_name(project_dir: Path) -> str:
    """Get the project name from package.json, pyproject.toml, or directory name.

    Args:
        project_dir: Root directory of the project

    Returns:
        Project name
    """
    # Try package.json first
    package_json = project_dir / "package.json"
    if package_json.exists():
        try:
            with open(package_json) as f:
                data = json.load(f)
                if "name" in data:
                    return data["name"]
        except Exception:
            pass

    # Try pyproject.toml
    pyproject = project_dir / "pyproject.toml"
    if pyproject.exists():
        try:
            import tomllib

            with open(pyproject, "rb") as f:
                data = tomllib.load(f)
                if "project" in data and "name" in data["project"]:
                    return data["project"]["name"]
                if "tool" in data and "poetry" in data["tool"]:
                    return data["tool"]["poetry"].get("name", "")
        except Exception:
            pass

    # Try Cargo.toml
    cargo_toml = project_dir / "Cargo.toml"
    if cargo_toml.exists():
        try:
            with open(cargo_toml) as f:
                content = f.read()
                for line in content.split("\n"):
                    if line.strip().startswith("name"):
                        parts = line.split("=")
                        if len(parts) == 2:
                            return parts[1].strip().strip('"').strip("'")
        except Exception:
            pass

    # Fall back to directory name
    return project_dir.name


def analyze_project(
    project_dir: Path,
    output_dir: Path | None = None,
    progress_callback: callable | None = None,
) -> ProjectAnalysis:
    """Analyze a project and produce analysis.json artifact.

    This is the main entry point for the BMAD project analysis phase.
    It scans the project structure, detects technology stack, and loads
    any existing BMAD configuration.

    Args:
        project_dir: Root directory of the project to analyze
        output_dir: Directory to write analysis.json (if provided)
        progress_callback: Optional callback for progress reporting

    Returns:
        ProjectAnalysis containing complete analysis results

    Example:
        >>> analysis = analyze_project(Path("/path/to/project"))
        >>> print(analysis.tech_stack.languages)
        ['python', 'typescript']

    Story Reference: Story 6.2 - Implement BMAD Project Analysis Phase
    """
    if progress_callback:
        progress_callback("Starting project analysis...", 0.0)

    # Get project name
    if progress_callback:
        progress_callback("Detecting project name...", 10.0)
    project_name = _get_project_name(project_dir)

    # Detect technology stack
    if progress_callback:
        progress_callback("Detecting technology stack...", 30.0)
    tech_stack = _detect_tech_stack(project_dir)

    # Analyze project structure
    if progress_callback:
        progress_callback("Analyzing project structure...", 50.0)
    structure = _analyze_structure(project_dir)

    # Load BMAD configuration
    if progress_callback:
        progress_callback("Loading BMAD configuration...", 70.0)
    bmad_config = _load_bmad_config(project_dir)

    # Create analysis result
    if progress_callback:
        progress_callback("Creating analysis result...", 90.0)

    analysis = ProjectAnalysis(
        project_name=project_name,
        tech_stack=tech_stack,
        structure=structure,
        bmad_config=bmad_config,
        analyzed_at=datetime.now().isoformat(),
        analysis_version="1.0.0",
    )

    # Write output file if output_dir is provided
    if output_dir:
        output_dir.mkdir(parents=True, exist_ok=True)
        output_file = output_dir / "analysis.json"
        try:
            with open(output_file, "w") as f:
                json.dump(analysis.to_dict(), f, indent=2)
            logger.info(f"Analysis written to {output_file}")
        except Exception as e:
            logger.error(f"Failed to write analysis file: {e}")
            raise

    if progress_callback:
        progress_callback("Project analysis complete", 100.0)

    return analysis


def load_analysis(output_dir: Path) -> ProjectAnalysis | None:
    """Load existing analysis from output directory.

    Args:
        output_dir: Directory containing analysis.json

    Returns:
        ProjectAnalysis if file exists, None otherwise
    """
    analysis_file = output_dir / "analysis.json"
    if not analysis_file.exists():
        return None

    try:
        with open(analysis_file) as f:
            data = json.load(f)

        # Reconstruct dataclasses from dict
        tech_stack = ProjectTechStack(**data.get("tech_stack", {}))
        structure = ProjectStructure(**data.get("structure", {}))
        bmad_config = BMADConfig(**data.get("bmad_config", {}))

        return ProjectAnalysis(
            project_name=data.get("project_name", ""),
            tech_stack=tech_stack,
            structure=structure,
            bmad_config=bmad_config,
            analyzed_at=data.get("analyzed_at", ""),
            analysis_version=data.get("analysis_version", "1.0.0"),
        )
    except Exception as e:
        logger.error(f"Failed to load analysis: {e}")
        return None
