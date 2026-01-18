/**
 * JSON Parser Utility
 *
 * Parses JSON content with comprehensive error handling and location reporting.
 * Uses native JSON.parse with error position extraction from SyntaxError messages.
 *
 * Error Location Reporting:
 * - Extracts position from SyntaxError messages (format varies by environment)
 * - Calculates line and column from position offset
 * - Provides human-readable error messages with position information
 * - Returns the original content for fallback display on parse errors
 */

/**
 * Error location information extracted from JSON parse errors.
 */
export interface JsonErrorLocation {
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
 * Result of a JSON parse operation.
 * Either contains the parsed data or error information.
 */
export interface JsonParseResult<T = unknown> {
  /** Whether parsing succeeded */
  success: boolean;
  /** Parsed data (only present if success is true) */
  data?: T;
  /** Error message (only present if success is false) */
  error?: string;
  /** Error location details (only present if success is false) */
  errorLocation?: JsonErrorLocation;
  /** Original raw content (always present for fallback display) */
  rawContent: string;
}

/**
 * Options for JSON parsing.
 */
export interface JsonParseOptions {
  /**
   * Filename to include in error messages (optional).
   * Helps identify which file had the error.
   */
  filename?: string;
  /**
   * Custom reviver function for JSON.parse.
   * Called for each key-value pair during parsing.
   */
  reviver?: (key: string, value: unknown) => unknown;
}

/**
 * Extracts error position from a JSON SyntaxError message.
 *
 * Different JavaScript environments format the error message differently:
 * - V8 (Chrome/Node): "Unexpected token } at position 123"
 * - SpiderMonkey (Firefox): "JSON.parse: expected ',' or '}' at line 5 column 10"
 * - JavaScriptCore (Safari): "JSON Parse error: Unexpected identifier"
 *
 * @param errorMessage - The error message from JSON.parse
 * @param content - The original JSON content for position calculation
 * @returns The extracted error location or undefined
 */
function extractErrorPosition(
  errorMessage: string,
  content: string
): JsonErrorLocation | undefined {
  // Try V8 format: "at position N" or "at character N"
  const positionMatch = errorMessage.match(/at position (\d+)/i);
  if (positionMatch) {
    const position = parseInt(positionMatch[1], 10);
    return positionFromOffset(content, position);
  }

  // Try Firefox/SpiderMonkey format: "at line N column M"
  const lineColMatch = errorMessage.match(/at line (\d+) column (\d+)/i);
  if (lineColMatch) {
    return {
      line: parseInt(lineColMatch[1], 10),
      column: parseInt(lineColMatch[2], 10),
    };
  }

  // Try alternative format: "line N"
  const lineOnlyMatch = errorMessage.match(/line (\d+)/i);
  if (lineOnlyMatch) {
    return {
      line: parseInt(lineOnlyMatch[1], 10),
      column: 1,
    };
  }

  // If we can't extract position, return undefined
  return undefined;
}

/**
 * Converts a character offset to line and column numbers.
 *
 * @param content - The source string
 * @param offset - Character offset (0-based)
 * @returns Location with line and column (1-based)
 */
function positionFromOffset(content: string, offset: number): JsonErrorLocation {
  // Clamp offset to valid range
  const safeOffset = Math.max(0, Math.min(offset, content.length));

  let line = 1;
  let lastNewlinePos = -1;

  for (let i = 0; i < safeOffset; i++) {
    if (content[i] === '\n') {
      line++;
      lastNewlinePos = i;
    }
  }

  const column = safeOffset - lastNewlinePos;

  // Extract a snippet around the error position
  const snippetStart = Math.max(0, safeOffset - 20);
  const snippetEnd = Math.min(content.length, safeOffset + 20);
  const snippet = content.slice(snippetStart, snippetEnd).replace(/\n/g, '\\n');

  return {
    line,
    column,
    position: offset,
    snippet,
  };
}

/**
 * Parses JSON content with comprehensive error handling.
 *
 * @param content - The JSON string to parse
 * @param options - Optional parsing configuration
 * @returns A result object containing either parsed data or error details
 *
 * @example
 * ```ts
 * const result = parseJson('{"key": "value"}');
 * if (result.success) {
 *   console.log(result.data); // { key: 'value' }
 * } else {
 *   console.error(`Error at line ${result.errorLocation?.line}: ${result.error}`);
 * }
 * ```
 *
 * @example Error handling with location
 * ```ts
 * const result = parseJson('{"key": invalid}');
 * if (!result.success) {
 *   const loc = result.errorLocation;
 *   console.error(`Parse error at line ${loc?.line}, column ${loc?.column}`);
 *   // Fall back to showing raw content
 *   console.log('Raw content:', result.rawContent);
 * }
 * ```
 */
export function parseJson<T = unknown>(
  content: string,
  options: JsonParseOptions = {}
): JsonParseResult<T> {
  const { filename, reviver } = options;

  // Handle empty or null content
  if (!content || content.trim() === '') {
    return {
      success: true,
      data: undefined as T,
      rawContent: content || '',
    };
  }

  try {
    const data = JSON.parse(content, reviver) as T;

    return {
      success: true,
      data,
      rawContent: content,
    };
  } catch (error) {
    return handleJsonError<T>(error, content, filename);
  }
}

/**
 * Parses JSON content and returns just the data.
 * Throws an error if parsing fails.
 *
 * Use this when you want to handle errors with try/catch
 * rather than checking result.success.
 *
 * @param content - The JSON string to parse
 * @param options - Optional parsing configuration
 * @returns The parsed data
 * @throws Error with location information if parsing fails
 *
 * @example
 * ```ts
 * try {
 *   const data = parseJsonOrThrow<Config>('{"key": "value"}');
 *   console.log(data.key);
 * } catch (error) {
 *   console.error('Failed to parse JSON:', error.message);
 * }
 * ```
 */
export function parseJsonOrThrow<T = unknown>(
  content: string,
  options: JsonParseOptions = {}
): T {
  const result = parseJson<T>(content, options);

  if (!result.success) {
    const loc = result.errorLocation;
    const locationInfo = loc ? ` at line ${loc.line}, column ${loc.column}` : '';
    throw new Error(`JSON parse error${locationInfo}: ${result.error}`);
  }

  return result.data as T;
}

/**
 * Safely parses JSON content, returning null on failure.
 * Useful when you want to provide a fallback without error handling.
 *
 * @param content - The JSON string to parse
 * @param options - Optional parsing configuration
 * @returns The parsed data or null if parsing fails
 *
 * @example
 * ```ts
 * const config = parseJsonSafe<Config>(content) ?? defaultConfig;
 * ```
 */
export function parseJsonSafe<T = unknown>(
  content: string,
  options: JsonParseOptions = {}
): T | null {
  const result = parseJson<T>(content, options);
  return result.success ? (result.data as T) : null;
}

/**
 * Validates JSON content without returning the parsed data.
 * Useful for syntax checking.
 *
 * @param content - The JSON string to validate
 * @param options - Optional parsing configuration
 * @returns A result object with validation status and any error details
 *
 * @example
 * ```ts
 * const validation = validateJson(userInput);
 * if (!validation.success) {
 *   showError(`Invalid JSON at line ${validation.errorLocation?.line}`);
 * }
 * ```
 */
export function validateJson(
  content: string,
  options: JsonParseOptions = {}
): Omit<JsonParseResult, 'data'> {
  const result = parseJson(content, options);
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
 * const result = parseJson(content);
 * if (!result.success) {
 *   displayError(formatJsonError(result));
 *   // "Parse error at line 5, column 10: Unexpected token"
 * }
 * ```
 */
export function formatJsonError(result: JsonParseResult): string {
  if (result.success) {
    return '';
  }

  const loc = result.errorLocation;
  const locationPart = loc ? `at line ${loc.line}, column ${loc.column}` : '';
  const snippetPart = loc?.snippet ? `\n  near: "${loc.snippet}"` : '';

  return `Parse error ${locationPart}: ${result.error}${snippetPart}`.trim();
}

/**
 * Handles JSON parsing errors and creates a standardized error result.
 *
 * @param error - The caught error
 * @param content - The original JSON content
 * @param filename - Optional filename for error context
 * @returns A JsonParseResult with error details
 */
function handleJsonError<T>(
  error: unknown,
  content: string,
  filename?: string
): JsonParseResult<T> {
  // Handle SyntaxError from JSON.parse
  if (error instanceof SyntaxError) {
    const location = extractErrorPosition(error.message, content);
    const filePrefix = filename ? `${filename}: ` : '';

    // Clean up the error message
    let errorMessage = error.message;
    // Remove redundant "JSON.parse: " prefix if present
    if (errorMessage.startsWith('JSON.parse: ')) {
      errorMessage = errorMessage.slice(12);
    }
    // Remove "JSON Parse error: " prefix if present
    if (errorMessage.startsWith('JSON Parse error: ')) {
      errorMessage = errorMessage.slice(18);
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
 * Options for JSON serialization.
 */
export interface JsonStringifyOptions {
  /** Indentation level (number of spaces or string). Defaults to 2. */
  indent?: number | string;
  /** Replacer function or array of keys to include. */
  replacer?: ((key: string, value: unknown) => unknown) | (string | number)[] | null;
  /** Whether to sort object keys alphabetically. Defaults to false. */
  sortKeys?: boolean;
}

/**
 * Serializes data to a JSON string.
 *
 * @param data - The data to serialize
 * @param options - Optional serialization options
 * @returns The JSON string representation
 *
 * @example
 * ```ts
 * const jsonStr = stringifyJson({ key: 'value', nested: { a: 1 } });
 * // {
 * //   "key": "value",
 * //   "nested": {
 * //     "a": 1
 * //   }
 * // }
 * ```
 *
 * @example With sorted keys
 * ```ts
 * const jsonStr = stringifyJson({ b: 2, a: 1 }, { sortKeys: true });
 * // {
 * //   "a": 1,
 * //   "b": 2
 * // }
 * ```
 */
export function stringifyJson(
  data: unknown,
  options: JsonStringifyOptions = {}
): string {
  const { indent = 2, replacer = null, sortKeys = false } = options;

  // If sortKeys is requested, create a custom replacer
  const effectiveReplacer = sortKeys
    ? createSortedKeysReplacer(replacer)
    : replacer;

  return JSON.stringify(data, effectiveReplacer as Parameters<typeof JSON.stringify>[1], indent);
}

/**
 * Creates a replacer function that sorts object keys.
 *
 * @param originalReplacer - Original replacer function or array
 * @returns A replacer function that sorts keys
 */
function createSortedKeysReplacer(
  originalReplacer: JsonStringifyOptions['replacer']
): (key: string, value: unknown) => unknown {
  return function(this: unknown, key: string, value: unknown): unknown {
    // Apply original replacer if it's a function
    let processedValue = value;
    if (typeof originalReplacer === 'function') {
      processedValue = originalReplacer.call(this, key, value);
    }

    // Sort object keys
    if (processedValue && typeof processedValue === 'object' && !Array.isArray(processedValue)) {
      const sorted: Record<string, unknown> = {};
      const keys = Object.keys(processedValue as Record<string, unknown>).sort();
      for (const k of keys) {
        sorted[k] = (processedValue as Record<string, unknown>)[k];
      }
      return sorted;
    }

    return processedValue;
  };
}

/**
 * Checks if a string is valid JSON without returning the parsed data.
 * More efficient than validateJson when you only need a boolean result.
 *
 * @param content - The string to check
 * @returns True if the content is valid JSON, false otherwise
 *
 * @example
 * ```ts
 * if (isValidJson(userInput)) {
 *   // Safe to parse
 * }
 * ```
 */
export function isValidJson(content: string): boolean {
  if (!content || content.trim() === '') {
    return true; // Empty content is considered valid (undefined)
  }

  try {
    JSON.parse(content);
    return true;
  } catch {
    return false;
  }
}

/**
 * Attempts to repair common JSON errors.
 * Useful for handling human-edited JSON that may have minor issues.
 *
 * Repairs attempted:
 * - Trailing commas in arrays/objects
 * - Missing commas between elements
 * - Single quotes instead of double quotes
 * - Unquoted keys
 *
 * @param content - The potentially malformed JSON string
 * @returns The repaired JSON string (may still be invalid)
 *
 * @example
 * ```ts
 * const repaired = repairJson("{'key': 'value',}");
 * // Returns: '{"key": "value"}'
 * const result = parseJson(repaired);
 * ```
 */
export function repairJson(content: string): string {
  if (!content || content.trim() === '') {
    return content;
  }

  let repaired = content;

  // Replace single quotes with double quotes (careful with apostrophes)
  // Only replace when they appear to be string delimiters
  repaired = repaired.replace(/(?<![a-zA-Z])'([^']*)'(?![a-zA-Z])/g, '"$1"');

  // Remove trailing commas before } or ]
  repaired = repaired.replace(/,(\s*[}\]])/g, '$1');

  // Quote unquoted keys (simple pattern, may not cover all cases)
  repaired = repaired.replace(/([{,]\s*)([a-zA-Z_][a-zA-Z0-9_]*)(\s*:)/g, '$1"$2"$3');

  return repaired;
}
