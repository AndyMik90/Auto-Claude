/**
 * Shell Escape Utilities
 *
 * Provides safe escaping for shell command arguments to prevent command injection.
 * IMPORTANT: Always use these utilities when interpolating user-controlled values into shell commands.
 */

/**
 * Escape a string for safe use as a shell argument.
 *
 * Platform-aware escaping:
 * - Windows PowerShell: Uses single quotes with '' to escape internal quotes
 * - Unix shells: Uses single quotes with '\'' to escape internal quotes
 *
 * Examples (Unix):
 * - "hello" → 'hello'
 * - "hello world" → 'hello world'
 * - "it's" → 'it'\''s'
 * - "$(rm -rf /)" → '$(rm -rf /)'
 *
 * Examples (Windows):
 * - "hello" → 'hello'
 * - "it's" → 'it''s'
 *
 * @param arg - The argument to escape
 * @returns The escaped argument wrapped in single quotes
 */
export function escapeShellArg(arg: string): string {
  if (process.platform === 'win32') {
    // PowerShell: escape single quotes by doubling them
    const escaped = arg.replace(/'/g, "''");
    return `'${escaped}'`;
  }

  // Unix: Replace single quotes with: end quote, escaped quote, start quote
  // This is the standard POSIX-safe way to handle single quotes
  const escaped = arg.replace(/'/g, "'\\''");
  return `'${escaped}'`;
}

/**
 * Escape a path for use in a cd command.
 *
 * @param path - The path to escape
 * @returns The escaped path safe for use in shell commands
 */
export function escapeShellPath(path: string): string {
  return escapeShellArg(path);
}

/**
 * Build a safe cd command from a path.
 * Uses platform-appropriate quoting and command chaining:
 * - Windows PowerShell: double quotes with `;` separator (&&` not valid in PS 5.1)
 * - Unix shells: single quotes with `&&` separator
 *
 * @param path - The directory path
 * @returns A safe "cd '<path>' && " or "cd '<path>'; " string, or empty string if path is undefined
 */
export function buildCdCommand(path: string | undefined): string {
  if (!path) {
    return '';
  }

  // Windows PowerShell uses double quotes and semicolon for command chaining
  // (PowerShell 5.1 doesn't support &&, only PS 7+ does)
  if (process.platform === 'win32') {
    // Escape PowerShell special characters
    const escaped = escapeShellArgPowerShell(path);
    return `cd "${escaped}"; `;
  }

  return `cd ${escapeShellPath(path)} && `;
}

/**
 * Escape a string for safe use as a PowerShell argument.
 *
 * PowerShell uses different escaping rules than cmd.exe.
 * Inside double quotes, only backtick, $, and " need escaping.
 *
 * @param arg - The argument to escape
 * @returns The escaped argument safe for use in PowerShell double-quoted strings
 */
export function escapeShellArgPowerShell(arg: string): string {
  // Inside PowerShell double-quoted strings:
  // ` is the escape character
  // $ triggers variable expansion
  // " needs escaping
  const escaped = arg
    .replace(/`/g, '``')      // Escape backticks first (escape char itself)
    .replace(/\$/g, '`$')     // Escape dollar signs (variable expansion)
    .replace(/"/g, '`"');     // Escape double quotes

  return escaped;
}

/**
 * Escape a string for use in Windows cmd.exe shell commands.
 * Used for cmd.exe batch commands (not PowerShell).
 *
 * @param arg - The string to escape
 * @returns The escaped string safe for cmd.exe
 */
export function escapeShellArgWindows(arg: string): string {
  // In cmd.exe, we need to escape:
  // - Double quotes with backslash
  // - Percent signs (double them)
  // - Carets (escape character in cmd)
  // - Other special characters: & | < > ^
  return arg
    .replace(/"/g, '\\"')     // Escape double quotes
    .replace(/%/g, '%%')      // Escape percent signs
    .replace(/\^/g, '^^')     // Escape carets
    .replace(/&/g, '^&')      // Escape ampersand
    .replace(/\|/g, '^|')     // Escape pipe
    .replace(/</g, '^<')      // Escape less than
    .replace(/>/g, '^>');     // Escape greater than
}

/**
 * Validate that a path doesn't contain obviously malicious patterns.
 * This is a defense-in-depth measure - escaping should handle all cases,
 * but this can catch obvious attack attempts early.
 *
 * @param path - The path to validate
 * @returns true if the path appears safe, false if it contains suspicious patterns
 */
export function isPathSafe(path: string): boolean {
  // Check for obvious shell metacharacters that shouldn't appear in paths
  // Note: This is defense-in-depth; escaping handles these, but we can log/reject
  const suspiciousPatterns = [
    /\$\(/, // Command substitution $(...)
    /`/,   // Backtick command substitution
    /\|/,  // Pipe
    /;/,   // Command separator
    /&&/,  // AND operator
    /\|\|/, // OR operator
    />/,   // Output redirection
    /</,   // Input redirection
    /\n/,  // Newlines
    /\r/,  // Carriage returns
  ];

  return !suspiciousPatterns.some(pattern => pattern.test(path));
}
