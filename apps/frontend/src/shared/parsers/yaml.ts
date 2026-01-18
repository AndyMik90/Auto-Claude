/**
 * YAML Parser Utility
 *
 * Parses YAML content with comprehensive error handling and location reporting.
 * Uses js-yaml for YAML 1.2 compliant parsing.
 *
 * Error Location Reporting:
 * - Extracts line and column from YAMLException.mark
 * - Provides human-readable error messages with position information
 * - Returns the original content for fallback display on parse errors
 */

import * as yaml from 'js-yaml';
import type { Schema, DumpOptions, YAMLException as YAMLExceptionType } from 'js-yaml';

// Runtime reference to YAMLException class for instanceof checks
const YAMLExceptionClass = yaml.YAMLException;

/**
 * Error location information extracted from YAML parse errors.
 */
export interface YamlErrorLocation {
  /** Line number (1-based for display) */
  line: number;
  /** Column number (1-based for display) */
  column: number;
  /** Position offset in the source string */
  position?: number;
  /** The problematic snippet of text, if available */
  snippet?: string;
}

/**
 * Result of a YAML parse operation.
 * Either contains the parsed data or error information.
 */
export interface YamlParseResult<T = unknown> {
  /** Whether parsing succeeded */
  success: boolean;
  /** Parsed data (only present if success is true) */
  data?: T;
  /** Error message (only present if success is false) */
  error?: string;
  /** Error location details (only present if success is false) */
  errorLocation?: YamlErrorLocation;
  /** Original raw content (always present for fallback display) */
  rawContent: string;
}

/**
 * Options for YAML parsing.
 */
export interface YamlParseOptions {
  /**
   * Filename to include in error messages (optional).
   * Helps identify which file had the error.
   */
  filename?: string;
  /**
   * Schema to use for parsing.
   * Defaults to DEFAULT_SCHEMA (safe parsing).
   */
  schema?: Schema;
  /**
   * Whether to allow duplicate keys.
   * Defaults to false (duplicate keys throw an error).
   */
  allowDuplicateKeys?: boolean;
}

/**
 * Parses YAML content with comprehensive error handling.
 *
 * @param content - The YAML string to parse
 * @param options - Optional parsing configuration
 * @returns A result object containing either parsed data or error details
 *
 * @example
 * ```ts
 * const result = parseYaml('key: value');
 * if (result.success) {
 *   console.log(result.data); // { key: 'value' }
 * } else {
 *   console.error(`Error at line ${result.errorLocation?.line}: ${result.error}`);
 * }
 * ```
 *
 * @example Error handling with location
 * ```ts
 * const result = parseYaml('invalid: yaml: content');
 * if (!result.success) {
 *   const loc = result.errorLocation;
 *   console.error(`Parse error at line ${loc?.line}, column ${loc?.column}`);
 *   // Fall back to showing raw content
 *   console.log('Raw content:', result.rawContent);
 * }
 * ```
 */
export function parseYaml<T = unknown>(
  content: string,
  options: YamlParseOptions = {}
): YamlParseResult<T> {
  const { filename, schema, allowDuplicateKeys = false } = options;

  // Handle empty or null content
  if (!content || content.trim() === '') {
    return {
      success: true,
      data: undefined as T,
      rawContent: content || '',
    };
  }

  try {
    const data = yaml.load(content, {
      filename,
      schema,
      json: false,
      // Note: js-yaml doesn't have allowDuplicateKeys in load options
      // but we document it for potential future use
    }) as T;

    return {
      success: true,
      data,
      rawContent: content,
    };
  } catch (error) {
    return handleYamlError<T>(error, content, filename);
  }
}

/**
 * Parses YAML content and returns just the data.
 * Throws an error if parsing fails.
 *
 * Use this when you want to handle errors with try/catch
 * rather than checking result.success.
 *
 * @param content - The YAML string to parse
 * @param options - Optional parsing configuration
 * @returns The parsed data
 * @throws Error with location information if parsing fails
 *
 * @example
 * ```ts
 * try {
 *   const data = parseYamlOrThrow<Config>('key: value');
 *   console.log(data.key);
 * } catch (error) {
 *   console.error('Failed to parse YAML:', error.message);
 * }
 * ```
 */
export function parseYamlOrThrow<T = unknown>(
  content: string,
  options: YamlParseOptions = {}
): T {
  const result = parseYaml<T>(content, options);

  if (!result.success) {
    const loc = result.errorLocation;
    const locationInfo = loc ? ` at line ${loc.line}, column ${loc.column}` : '';
    throw new Error(`YAML parse error${locationInfo}: ${result.error}`);
  }

  return result.data as T;
}

/**
 * Safely parses YAML content, returning null on failure.
 * Useful when you want to provide a fallback without error handling.
 *
 * @param content - The YAML string to parse
 * @param options - Optional parsing configuration
 * @returns The parsed data or null if parsing fails
 *
 * @example
 * ```ts
 * const config = parseYamlSafe<Config>(content) ?? defaultConfig;
 * ```
 */
export function parseYamlSafe<T = unknown>(
  content: string,
  options: YamlParseOptions = {}
): T | null {
  const result = parseYaml<T>(content, options);
  return result.success ? (result.data as T) : null;
}

/**
 * Validates YAML content without returning the parsed data.
 * Useful for syntax checking.
 *
 * @param content - The YAML string to validate
 * @param options - Optional parsing configuration
 * @returns A result object with validation status and any error details
 *
 * @example
 * ```ts
 * const validation = validateYaml(userInput);
 * if (!validation.success) {
 *   showError(`Invalid YAML at line ${validation.errorLocation?.line}`);
 * }
 * ```
 */
export function validateYaml(
  content: string,
  options: YamlParseOptions = {}
): Omit<YamlParseResult, 'data'> {
  const result = parseYaml(content, options);
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const { data, ...validationResult } = result;
  return validationResult;
}

/**
 * Formats a parse error with location information for display.
 *
 * @param result - A failed parse result
 * @returns A formatted error message string
 *
 * @example
 * ```ts
 * const result = parseYaml(content);
 * if (!result.success) {
 *   displayError(formatYamlError(result));
 *   // "Parse error at line 5, column 10: unexpected token"
 * }
 * ```
 */
export function formatYamlError(result: YamlParseResult): string {
  if (result.success) {
    return '';
  }

  const loc = result.errorLocation;
  const locationPart = loc ? `at line ${loc.line}, column ${loc.column}` : '';
  const snippetPart = loc?.snippet ? `\n  ${loc.snippet}` : '';

  return `Parse error ${locationPart}: ${result.error}${snippetPart}`.trim();
}

/**
 * Extracts error location from a YAMLException.
 *
 * @param error - The YAMLException from js-yaml
 * @returns The extracted location information or undefined
 */
function extractErrorLocation(error: YAMLExceptionType): YamlErrorLocation | undefined {
  // js-yaml provides error location in the 'mark' property
  const mark = error.mark;

  if (!mark) {
    return undefined;
  }

  return {
    // Convert 0-based to 1-based for display
    line: (mark.line ?? 0) + 1,
    column: (mark.column ?? 0) + 1,
    position: mark.position,
    snippet: mark.snippet,
  };
}

/**
 * Handles YAML parsing errors and creates a standardized error result.
 *
 * @param error - The caught error
 * @param content - The original YAML content
 * @param filename - Optional filename for error context
 * @returns A YamlParseResult with error details
 */
function handleYamlError<T>(
  error: unknown,
  content: string,
  filename?: string
): YamlParseResult<T> {
  // Handle js-yaml specific errors
  if (error instanceof YAMLExceptionClass) {
    const location = extractErrorLocation(error as YAMLExceptionType);
    const filePrefix = filename ? `${filename}: ` : '';

    // Extract the core error reason from the message
    // js-yaml messages are like "unexpected token"
    let errorMessage = error.reason || error.message;

    // Clean up the message if it contains the full formatted error
    if (errorMessage.includes('YAMLException:')) {
      errorMessage = errorMessage.split('YAMLException:')[1]?.trim() || errorMessage;
    }

    return {
      success: false,
      error: `${filePrefix}${errorMessage}`,
      errorLocation: location,
      rawContent: content,
    };
  }

  // Handle generic errors
  if (error instanceof Error) {
    return {
      success: false,
      error: error.message,
      rawContent: content,
    };
  }

  // Handle unknown error types
  return {
    success: false,
    error: 'Unknown parsing error',
    rawContent: content,
  };
}

/**
 * Serializes data to a YAML string.
 *
 * @param data - The data to serialize
 * @param options - Optional serialization options
 * @returns The YAML string representation
 *
 * @example
 * ```ts
 * const yamlStr = stringifyYaml({ key: 'value', nested: { a: 1 } });
 * // key: value
 * // nested:
 * //   a: 1
 * ```
 */
export function stringifyYaml(
  data: unknown,
  options: DumpOptions = {}
): string {
  const defaultOptions: DumpOptions = {
    indent: 2,
    lineWidth: 80,
    noRefs: true,
    sortKeys: false,
    ...options,
  };

  return yaml.dump(data, defaultOptions);
}
