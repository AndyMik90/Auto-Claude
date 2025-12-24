/**
 * Subprocess runner utilities for GitHub Python runners
 *
 * Provides a consistent abstraction for spawning and managing Python subprocesses
 * with progress tracking, error handling, and result parsing.
 */

import { spawn } from 'child_process';
import type { ChildProcess } from 'child_process';
import path from 'path';
import fs from 'fs';
import type { Project } from '../../../../shared/types';

/**
 * Options for running a Python subprocess
 */
export interface SubprocessOptions {
  pythonPath: string;
  args: string[];
  cwd: string;
  onProgress?: (percent: number, message: string, data?: unknown) => void;
  onStdout?: (line: string) => void;
  onStderr?: (line: string) => void;
  onComplete?: (stdout: string, stderr: string) => unknown;
  onError?: (error: string) => void;
  progressPattern?: RegExp;
}

/**
 * Result from a subprocess execution
 */
export interface SubprocessResult<T = unknown> {
  success: boolean;
  exitCode: number;
  stdout: string;
  stderr: string;
  data?: T;
  error?: string;
}

/**
 * Run a Python subprocess with progress tracking
 *
 * @param options - Subprocess configuration
 * @returns Promise resolving to the subprocess result
 */
export function runPythonSubprocess<T = unknown>(
  options: SubprocessOptions
): Promise<SubprocessResult<T>> {
  return new Promise((resolve) => {
    const child = spawn(options.pythonPath, options.args, {
      cwd: options.cwd,
      env: {
        ...process.env,
        PYTHONPATH: options.cwd,
      },
    });

    let stdout = '';
    let stderr = '';

    // Default progress pattern: [ 30%] message OR [30%] message
    const progressPattern = options.progressPattern ?? /\[\s*(\d+)%\]\s*(.+)/;

    child.stdout.on('data', (data: Buffer) => {
      const text = data.toString();
      stdout += text;

      const lines = text.split('\n');
      for (const line of lines) {
        if (line.trim()) {
          // Call custom stdout handler
          options.onStdout?.(line);

          // Parse progress updates
          const match = line.match(progressPattern);
          if (match && options.onProgress) {
            const percent = parseInt(match[1], 10);
            const message = match[2].trim();
            options.onProgress(percent, message);
          }
        }
      }
    });

    child.stderr.on('data', (data: Buffer) => {
      const text = data.toString();
      stderr += text;

      const lines = text.split('\n');
      for (const line of lines) {
        if (line.trim()) {
          options.onStderr?.(line);
        }
      }
    });

    child.on('close', (code: number) => {
      const exitCode = code ?? 0;

      if (exitCode === 0) {
        try {
          const data = options.onComplete?.(stdout, stderr);
          resolve({
            success: true,
            exitCode,
            stdout,
            stderr,
            data: data as T,
          });
        } catch (error) {
          const errorMessage = error instanceof Error ? error.message : 'Unknown error';
          options.onError?.(errorMessage);
          resolve({
            success: false,
            exitCode,
            stdout,
            stderr,
            error: errorMessage,
          });
        }
      } else {
        const errorMessage = stderr || `Process failed with code ${exitCode}`;
        options.onError?.(errorMessage);
        resolve({
          success: false,
          exitCode,
          stdout,
          stderr,
          error: errorMessage,
        });
      }
    });

    child.on('error', (err: Error) => {
      options.onError?.(err.message);
      resolve({
        success: false,
        exitCode: -1,
        stdout,
        stderr,
        error: err.message,
      });
    });
  });
}

/**
 * Get the Python path for a project's backend
 */
export function getPythonPath(backendPath: string): string {
  return path.join(backendPath, '.venv', 'bin', 'python');
}

/**
 * Get the GitHub runner path for a project
 */
export function getRunnerPath(backendPath: string): string {
  return path.join(backendPath, 'runners', 'github', 'runner.py');
}

/**
 * Get the auto-claude backend path for a project
 */
export function getBackendPath(project: Project): string | null {
  const autoBuildPath = project.autoBuildPath;
  if (!autoBuildPath) return null;

  // Check if this is a development repo (has apps/backend structure)
  const appsBackendPath = path.join(project.path, 'apps', 'backend');
  if (fs.existsSync(path.join(appsBackendPath, 'runners', 'github', 'runner.py'))) {
    return appsBackendPath;
  }

  return null;
}

/**
 * Validate that the GitHub runner exists
 */
export function validateRunner(backendPath: string | null): { valid: boolean; error?: string } {
  if (!backendPath) {
    return {
      valid: false,
      error: 'GitHub runner not found. Make sure the GitHub automation module is installed.',
    };
  }

  const runnerPath = getRunnerPath(backendPath);
  if (!fs.existsSync(runnerPath)) {
    return {
      valid: false,
      error: `GitHub runner not found at: ${runnerPath}`,
    };
  }

  return { valid: true };
}

/**
 * Parse JSON from stdout (finds JSON block in output)
 */
export function parseJSONFromOutput<T>(stdout: string): T {
  const jsonStart = stdout.indexOf('{');
  const jsonEnd = stdout.lastIndexOf('}');

  if (jsonStart >= 0 && jsonEnd > jsonStart) {
    const jsonStr = stdout.substring(jsonStart, jsonEnd + 1);
    return JSON.parse(jsonStr);
  }

  throw new Error('No JSON found in output');
}

/**
 * Build standard GitHub runner arguments
 */
export function buildRunnerArgs(
  runnerPath: string,
  projectPath: string,
  command: string,
  additionalArgs: string[] = [],
  options?: {
    model?: string;
    thinkingLevel?: string;
  }
): string[] {
  const args = [runnerPath, '--project', projectPath];

  if (options?.model) {
    args.push('--model', options.model);
  }

  if (options?.thinkingLevel) {
    args.push('--thinking-level', options.thinkingLevel);
  }

  args.push(command);
  args.push(...additionalArgs);

  return args;
}
