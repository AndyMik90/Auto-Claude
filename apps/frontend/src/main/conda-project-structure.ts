/**
 * Conda Project Structure Detection
 *
 * Detects whether a project is pure Python or mixed with other languages.
 * Used to determine where Python environments and workspace files should be placed.
 *
 * For pure Python projects: environments go at project root
 * For mixed projects (e.g., dotnet+python): environments go in src/python subdirectory
 */

import { existsSync, readdirSync, statSync } from 'fs';
import path from 'path';
import type { ProjectStructure, ProjectType } from '../shared/types/conda';

/**
 * Python project indicator files that suggest a pure Python project when at root
 */
const PYTHON_ROOT_INDICATORS = [
  'pyproject.toml',
  'setup.py',
  'setup.cfg',
  'requirements.txt',
  'Pipfile',
  'poetry.lock',
];

/**
 * File patterns that indicate other languages in the project
 */
const LANGUAGE_INDICATORS: Record<string, string[]> = {
  dotnet: ['*.csproj', '*.fsproj', '*.vbproj', '*.sln'],
  node: ['package.json'],
  java: ['pom.xml', 'build.gradle', 'build.gradle.kts'],
  go: ['go.mod'],
  rust: ['Cargo.toml'],
  ruby: ['Gemfile'],
};

/**
 * Check if a file exists at the given path
 */
function fileExists(filePath: string): boolean {
  try {
    return existsSync(filePath);
  } catch {
    return false;
  }
}

/**
 * Check if any files matching a glob pattern exist in the directory
 * Simple implementation: checks for common file extensions
 */
function hasFilesWithExtension(directory: string, extension: string): boolean {
  try {
    const files = readdirSync(directory);
    return files.some((file: string) => file.endsWith(extension));
  } catch {
    return false;
  }
}

/**
 * Find all requirements files in a directory
 */
function findRequirementsFiles(directory: string): string[] {
  const found: string[] = [];

  try {
    const files = readdirSync(directory);

    // Check for requirements*.txt files
    for (const file of files) {
      if (file.startsWith('requirements') && file.endsWith('.txt')) {
        found.push(path.join(directory, file));
      }
    }

    // Check for requirements/ directory
    const reqDir = path.join(directory, 'requirements');
    if (fileExists(reqDir)) {
      try {
        const stat = statSync(reqDir);
        if (stat.isDirectory()) {
          const reqFiles = readdirSync(reqDir);
          for (const file of reqFiles) {
            if (file.endsWith('.txt')) {
              found.push(path.join(reqDir, file));
            }
          }
        }
      } catch {
        // Ignore errors
      }
    }
  } catch {
    // Ignore errors
  }

  return found;
}

/**
 * Check if the project has .NET files (*.csproj, *.sln, etc.)
 */
function detectDotnet(projectPath: string): boolean {
  // Check root directory for .sln files
  if (hasFilesWithExtension(projectPath, '.sln')) {
    return true;
  }
  if (hasFilesWithExtension(projectPath, '.csproj')) {
    return true;
  }
  if (hasFilesWithExtension(projectPath, '.fsproj')) {
    return true;
  }
  if (hasFilesWithExtension(projectPath, '.vbproj')) {
    return true;
  }

  // Check common dotnet source directories
  const srcDir = path.join(projectPath, 'src');
  if (fileExists(srcDir)) {
    if (hasFilesWithExtension(srcDir, '.csproj')) {
      return true;
    }
    // Check subdirectories of src for .csproj files
    try {
      const srcSubdirs = readdirSync(srcDir);
      for (const subdir of srcSubdirs) {
        const subdirPath = path.join(srcDir, subdir);
        try {
          const stat = statSync(subdirPath);
          if (stat.isDirectory() && hasFilesWithExtension(subdirPath, '.csproj')) {
            return true;
          }
        } catch {
          continue;
        }
      }
    } catch {
      // Ignore errors reading directory
    }
  }

  return false;
}

/**
 * Detect other languages present in the project
 */
function detectOtherLanguages(projectPath: string): string[] {
  const detected: string[] = [];

  for (const [language, indicators] of Object.entries(LANGUAGE_INDICATORS)) {
    if (language === 'dotnet') {
      // Dotnet is handled separately with hasDotnet
      continue;
    }

    // Check for non-glob indicators
    for (const indicator of indicators) {
      if (!indicator.includes('*') && fileExists(path.join(projectPath, indicator))) {
        if (!detected.includes(language)) {
          detected.push(language);
        }
        break;
      }
    }
  }

  return detected;
}

/**
 * Check if the project has a src/python directory structure
 * This indicates a mixed project where Python code is in a subdirectory
 */
function hasSrcPythonStructure(projectPath: string): boolean {
  const srcPythonPath = path.join(projectPath, 'src', 'python');
  if (!fileExists(srcPythonPath)) {
    return false;
  }

  // Verify it looks like a Python project directory
  return PYTHON_ROOT_INDICATORS.some((indicator) =>
    fileExists(path.join(srcPythonPath, indicator))
  );
}

/**
 * Check if the project is a pure Python project (Python files at root)
 */
function isPurePythonProject(projectPath: string): boolean {
  // Check for Python project indicators at root
  const hasPythonAtRoot = PYTHON_ROOT_INDICATORS.some((indicator) =>
    fileExists(path.join(projectPath, indicator))
  );

  if (!hasPythonAtRoot) {
    return false;
  }

  // If there's a src/python structure, it's likely a mixed project
  if (hasSrcPythonStructure(projectPath)) {
    return false;
  }

  // If there are other major languages, it might be mixed
  const hasDotnet = detectDotnet(projectPath);
  if (hasDotnet) {
    return false;
  }

  return true;
}

/**
 * Find pyproject.toml in a directory
 */
function findPyprojectToml(directory: string): string | undefined {
  const pyprojectPath = path.join(directory, 'pyproject.toml');
  return fileExists(pyprojectPath) ? pyprojectPath : undefined;
}

/**
 * Detect the project structure to determine where Python environments should go.
 *
 * @param projectPath - Absolute path to the project root
 * @returns ProjectStructure with type, pythonRoot, and detected languages
 */
export function detectProjectStructure(projectPath: string): ProjectStructure {
  const hasDotnet = detectDotnet(projectPath);
  const hasOtherLanguages = detectOtherLanguages(projectPath);

  // Check for src/python structure (indicates mixed project)
  if (hasSrcPythonStructure(projectPath)) {
    const pythonRoot = path.join(projectPath, 'src', 'python');
    return {
      type: 'mixed',
      pythonRoot,
      hasDotnet,
      hasOtherLanguages,
      requirementsFiles: findRequirementsFiles(pythonRoot),
      pyprojectPath: findPyprojectToml(pythonRoot),
    };
  }

  // Check if it's a pure Python project
  if (isPurePythonProject(projectPath)) {
    return {
      type: 'pure-python',
      pythonRoot: projectPath,
      hasDotnet: false,
      hasOtherLanguages,
      requirementsFiles: findRequirementsFiles(projectPath),
      pyprojectPath: findPyprojectToml(projectPath),
    };
  }

  // Default: if we detect other languages but no src/python,
  // still use project root for Python (user may add Python later)
  // But mark it as mixed if other languages are present
  const isMixed = hasDotnet || hasOtherLanguages.length > 0;
  const projectType: ProjectType = isMixed ? 'mixed' : 'pure-python';

  return {
    type: projectType,
    pythonRoot: projectPath,
    hasDotnet,
    hasOtherLanguages,
    requirementsFiles: findRequirementsFiles(projectPath),
    pyprojectPath: findPyprojectToml(projectPath),
  };
}

/**
 * Get the path where Python environments (.envs directory) should be placed.
 *
 * @param projectPath - Absolute path to the project root
 * @param projectName - Name of the project (used in environment directory name)
 * @returns Absolute path to the environment directory (e.g., /project/.envs/myproject)
 */
export function getPythonEnvPath(projectPath: string, projectName: string): string {
  const structure = detectProjectStructure(projectPath);
  return path.join(structure.pythonRoot, '.envs', projectName);
}

/**
 * Get the path where activation scripts should be placed.
 *
 * @param projectPath - Absolute path to the project root
 * @returns Absolute path to the scripts directory (e.g., /project/.envs/scripts)
 */
export function getScriptsPath(projectPath: string): string {
  const structure = detectProjectStructure(projectPath);
  return path.join(structure.pythonRoot, '.envs', 'scripts');
}

/**
 * Get the path where the VS Code workspace file should be placed.
 *
 * @param projectPath - Absolute path to the project root
 * @param projectName - Name of the project (used in workspace filename)
 * @returns Absolute path to the workspace file (e.g., /project/myproject.code-workspace)
 */
export function getWorkspaceFilePath(projectPath: string, projectName: string): string {
  const structure = detectProjectStructure(projectPath);
  return path.join(structure.pythonRoot, `${projectName}.code-workspace`);
}
