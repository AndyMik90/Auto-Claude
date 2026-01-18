/**
 * File Type Detection Utility
 *
 * Detects file types for artifact viewers based on file extension and content analysis.
 * Supports YAML, Markdown, JSON, and falls back to plain text for unknown types.
 *
 * Used by ArtifactViewer to route content to the appropriate viewer component.
 *
 * Detection Strategy:
 * 1. First checks file extension (most reliable)
 * 2. Falls back to content-based detection if extension is missing or unknown
 * 3. Returns 'text' for unknown types (fallback to RawTextViewer)
 */

/**
 * Supported artifact file types.
 * These map to specific viewer components.
 */
export type ArtifactFileType = 'yaml' | 'json' | 'markdown' | 'text';

/**
 * File extension to type mapping.
 * Includes common variations for each type.
 */
const EXTENSION_MAP: Record<string, ArtifactFileType> = {
  // YAML extensions
  '.yaml': 'yaml',
  '.yml': 'yaml',

  // JSON extensions
  '.json': 'json',
  '.jsonc': 'json', // JSON with comments (treated as JSON)

  // Markdown extensions
  '.md': 'markdown',
  '.markdown': 'markdown',
  '.mdx': 'markdown', // MDX (Markdown + JSX)
  '.mdown': 'markdown',
  '.mkd': 'markdown',

  // Plain text extensions (explicit)
  '.txt': 'text',
  '.text': 'text',
  '.log': 'text',
};

/**
 * Detects the file type from a filename or path.
 *
 * @param filename - The filename or path to analyze
 * @returns The detected file type or 'text' if unknown
 *
 * @example
 * ```ts
 * detectFileTypeFromName('config.yaml')     // 'yaml'
 * detectFileTypeFromName('spec.md')         // 'markdown'
 * detectFileTypeFromName('plan.json')       // 'json'
 * detectFileTypeFromName('readme.txt')      // 'text'
 * detectFileTypeFromName('unknown')         // 'text'
 * ```
 */
export function detectFileTypeFromName(filename: string): ArtifactFileType {
  if (!filename) {
    return 'text';
  }

  // Normalize to lowercase and extract extension
  const normalizedName = filename.toLowerCase().trim();

  // Find the last dot to extract extension
  const lastDotIndex = normalizedName.lastIndexOf('.');
  if (lastDotIndex === -1 || lastDotIndex === normalizedName.length - 1) {
    return 'text';
  }

  const extension = normalizedName.slice(lastDotIndex);

  return EXTENSION_MAP[extension] ?? 'text';
}

/**
 * Detects the file type from content by analyzing patterns.
 *
 * This is a fallback when file extension is not available.
 * Uses heuristics to guess the content type:
 * - JSON: Starts with { or [ (after trimming whitespace)
 * - YAML: Has key: value patterns without JSON structure
 * - Markdown: Has markdown-specific patterns (headers, lists, links)
 * - Text: Default fallback
 *
 * @param content - The file content to analyze
 * @returns The detected file type based on content patterns
 *
 * @example
 * ```ts
 * detectFileTypeFromContent('{"key": "value"}')           // 'json'
 * detectFileTypeFromContent('key: value\nother: data')    // 'yaml'
 * detectFileTypeFromContent('# Heading\n\nParagraph')     // 'markdown'
 * detectFileTypeFromContent('Plain text content')         // 'text'
 * ```
 */
export function detectFileTypeFromContent(content: string): ArtifactFileType {
  if (!content || content.trim() === '') {
    return 'text';
  }

  const trimmedContent = content.trim();

  // Check for JSON (starts with { or [)
  if (isLikelyJson(trimmedContent)) {
    return 'json';
  }

  // Check for YAML patterns
  if (isLikelyYaml(trimmedContent)) {
    return 'yaml';
  }

  // Check for Markdown patterns
  if (isLikelyMarkdown(trimmedContent)) {
    return 'markdown';
  }

  return 'text';
}

/**
 * Detects file type using both filename and content.
 * Prioritizes extension-based detection, falls back to content analysis.
 *
 * @param filename - The filename or path (can be undefined or empty)
 * @param content - The file content (can be undefined or empty)
 * @returns The detected file type
 *
 * @example
 * ```ts
 * // Extension takes priority
 * detectFileType('config.yaml', '{"json": true}')  // 'yaml'
 *
 * // Falls back to content when no extension
 * detectFileType('config', '{"json": true}')       // 'json'
 *
 * // Uses content when extension is unknown
 * detectFileType('file.unknown', '# Heading')      // 'markdown'
 * ```
 */
export function detectFileType(
  filename?: string,
  content?: string
): ArtifactFileType {
  // Try extension-based detection first
  if (filename) {
    const typeFromName = detectFileTypeFromName(filename);
    // If we got a specific type (not 'text'), use it
    if (typeFromName !== 'text') {
      return typeFromName;
    }
  }

  // Fall back to content-based detection
  if (content) {
    return detectFileTypeFromContent(content);
  }

  // Default to text
  return 'text';
}

/**
 * Checks if the file extension indicates a specific type.
 *
 * @param filename - The filename to check
 * @param type - The file type to check for
 * @returns True if the extension matches the type
 *
 * @example
 * ```ts
 * hasFileExtension('config.yaml', 'yaml')  // true
 * hasFileExtension('config.yml', 'yaml')   // true
 * hasFileExtension('config.json', 'yaml')  // false
 * ```
 */
export function hasFileExtension(
  filename: string,
  type: ArtifactFileType
): boolean {
  return detectFileTypeFromName(filename) === type;
}

/**
 * Gets the display name for a file type.
 * Useful for UI labels and accessibility.
 *
 * @param type - The file type
 * @returns Human-readable type name
 *
 * @example
 * ```ts
 * getFileTypeDisplayName('yaml')      // 'YAML'
 * getFileTypeDisplayName('json')      // 'JSON'
 * getFileTypeDisplayName('markdown')  // 'Markdown'
 * getFileTypeDisplayName('text')      // 'Plain Text'
 * ```
 */
export function getFileTypeDisplayName(type: ArtifactFileType): string {
  const displayNames: Record<ArtifactFileType, string> = {
    yaml: 'YAML',
    json: 'JSON',
    markdown: 'Markdown',
    text: 'Plain Text',
  };

  return displayNames[type];
}

/**
 * Gets all recognized extensions for a file type.
 *
 * @param type - The file type
 * @returns Array of extensions (including the dot)
 *
 * @example
 * ```ts
 * getExtensionsForType('yaml')      // ['.yaml', '.yml']
 * getExtensionsForType('markdown')  // ['.md', '.markdown', '.mdx', '.mdown', '.mkd']
 * ```
 */
export function getExtensionsForType(type: ArtifactFileType): string[] {
  return Object.entries(EXTENSION_MAP)
    .filter(([_, t]) => t === type)
    .map(([ext]) => ext);
}

// ============================================================================
// Internal Detection Helpers
// ============================================================================

/**
 * Checks if content looks like JSON.
 * JSON typically starts with { (object) or [ (array).
 */
function isLikelyJson(content: string): boolean {
  // JSON starts with { or [
  const firstChar = content[0];
  if (firstChar !== '{' && firstChar !== '[') {
    return false;
  }

  // Verify it's valid JSON by trying to parse
  try {
    JSON.parse(content);
    return true;
  } catch {
    return false;
  }
}

/**
 * Checks if content looks like YAML.
 * YAML has key: value patterns, document markers, or is a simple scalar.
 */
function isLikelyYaml(content: string): boolean {
  const lines = content.split('\n').map((line) => line.trim());

  // YAML document markers
  if (content.startsWith('---') || content.includes('\n---')) {
    return true;
  }

  // Check for key: value patterns (YAML structure)
  const keyValuePattern = /^[a-zA-Z_][a-zA-Z0-9_]*\s*:/;
  const hasKeyValueLines = lines.some((line) => keyValuePattern.test(line));

  if (hasKeyValueLines) {
    // Make sure it's not just a markdown header with a colon
    // e.g., "Note: Something" in a paragraph shouldn't trigger YAML
    const firstNonEmptyLine = lines.find((line) => line.length > 0);
    if (firstNonEmptyLine && keyValuePattern.test(firstNonEmptyLine)) {
      return true;
    }
  }

  return false;
}

/**
 * Checks if content looks like Markdown.
 * Markdown has specific structural patterns.
 */
function isLikelyMarkdown(content: string): boolean {
  // Markdown patterns to check
  const markdownPatterns = [
    /^#{1,6}\s+\S/m, // ATX-style headers (# Heading)
    /^\*{3,}$/m, // Horizontal rule ***
    /^-{3,}$/m, // Horizontal rule ---
    /^_{3,}$/m, // Horizontal rule ___
    /^\s*[-*+]\s+\S/m, // Unordered list
    /^\s*\d+\.\s+\S/m, // Ordered list
    /^\s*>\s+\S/m, // Block quote
    /\[.+\]\(.+\)/m, // Markdown links [text](url)
    /!\[.*\]\(.+\)/m, // Markdown images ![alt](url)
    /```[\s\S]*?```/m, // Fenced code blocks
    /^\s{4,}\S/m, // Indented code blocks (4+ spaces)
    /`[^`]+`/m, // Inline code
    /\*\*[^*]+\*\*/m, // Bold **text**
    /\*[^*]+\*/m, // Italic *text*
    /__[^_]+__/m, // Bold __text__
    /_[^_]+_/m, // Italic _text_
  ];

  // Count how many patterns match
  const matchCount = markdownPatterns.filter((pattern) =>
    pattern.test(content)
  ).length;

  // If multiple markdown patterns match, it's likely markdown
  // A single match could be coincidental
  return matchCount >= 2;
}
