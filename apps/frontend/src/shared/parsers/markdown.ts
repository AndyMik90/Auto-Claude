/**
 * Markdown Parser Utility
 *
 * Extracts structure from Markdown content for navigation and display purposes.
 * Provides heading extraction and table of contents (TOC) generation.
 *
 * Features:
 * - Heading extraction with level detection (h1-h6)
 * - Automatic slug generation for anchor links
 * - Table of contents generation with nested structure
 * - Line number tracking for source navigation
 */

/**
 * Represents a heading extracted from Markdown content.
 */
export interface MarkdownHeading {
  /** The heading level (1-6) */
  level: number;
  /** The heading text content (without the # markers) */
  text: string;
  /** URL-safe slug for anchor links */
  slug: string;
  /** Line number in the source (1-based) */
  line: number;
}

/**
 * Represents a table of contents entry with nested children.
 */
export interface TocEntry {
  /** The heading text */
  text: string;
  /** URL-safe slug for anchor links */
  slug: string;
  /** The heading level (1-6) */
  level: number;
  /** Nested child entries */
  children: TocEntry[];
}

/**
 * Options for heading extraction.
 */
export interface HeadingExtractionOptions {
  /**
   * Minimum heading level to include (1-6).
   * Defaults to 1 (include all headings).
   */
  minLevel?: number;
  /**
   * Maximum heading level to include (1-6).
   * Defaults to 6 (include all headings).
   */
  maxLevel?: number;
  /**
   * Whether to include headings inside code blocks.
   * Defaults to false (skip code block content).
   */
  includeCodeBlocks?: boolean;
}

/**
 * Options for TOC generation.
 */
export interface TocOptions extends HeadingExtractionOptions {
  /**
   * Whether to create a flat list or nested structure.
   * Defaults to false (nested structure).
   */
  flat?: boolean;
  /**
   * Maximum depth of nesting for nested TOC.
   * Defaults to 6 (all levels).
   */
  maxDepth?: number;
}

/**
 * Result of Markdown processing.
 */
export interface MarkdownParseResult {
  /** Extracted headings */
  headings: MarkdownHeading[];
  /** Generated table of contents */
  toc: TocEntry[];
  /** Whether the content was successfully processed */
  success: boolean;
  /** Error message if processing failed */
  error?: string;
}

/**
 * Generates a URL-safe slug from a heading text.
 * Follows GitHub-style slug generation rules.
 *
 * @param text - The heading text to convert to a slug
 * @returns A URL-safe slug string
 *
 * @example
 * ```ts
 * generateSlug('Hello World!'); // 'hello-world'
 * generateSlug('API Reference'); // 'api-reference'
 * generateSlug('Section 1.2.3'); // 'section-123'
 * ```
 */
export function generateSlug(text: string): string {
  return text
    .toLowerCase()
    .trim()
    // Remove special characters except spaces and hyphens
    .replace(/[^\w\s-]/g, '')
    // Replace spaces with hyphens
    .replace(/\s+/g, '-')
    // Remove consecutive hyphens
    .replace(/-+/g, '-')
    // Remove leading/trailing hyphens
    .replace(/^-+|-+$/g, '');
}

/**
 * Ensures unique slugs by appending a numeric suffix if needed.
 *
 * @param slug - The base slug
 * @param existingSlugs - Set of slugs already used
 * @returns A unique slug
 */
function ensureUniqueSlug(slug: string, existingSlugs: Set<string>): string {
  if (!existingSlugs.has(slug)) {
    return slug;
  }

  let counter = 1;
  let uniqueSlug = `${slug}-${counter}`;
  while (existingSlugs.has(uniqueSlug)) {
    counter++;
    uniqueSlug = `${slug}-${counter}`;
  }
  return uniqueSlug;
}

/**
 * Checks if a line is inside a code block.
 *
 * @param lines - All lines of content
 * @param lineIndex - Current line index (0-based)
 * @returns Whether the line is inside a fenced code block
 */
function isInsideCodeBlock(lines: string[], lineIndex: number): boolean {
  let insideCodeBlock = false;
  let codeBlockMarker = '';

  for (let i = 0; i < lineIndex; i++) {
    const line = lines[i];
    const trimmedLine = line.trim();

    // Check for code block markers (``` or ~~~)
    if (trimmedLine.startsWith('```') || trimmedLine.startsWith('~~~')) {
      const marker = trimmedLine.slice(0, 3);

      if (!insideCodeBlock) {
        insideCodeBlock = true;
        codeBlockMarker = marker;
      } else if (trimmedLine === codeBlockMarker || trimmedLine.startsWith(codeBlockMarker)) {
        insideCodeBlock = false;
        codeBlockMarker = '';
      }
    }
  }

  return insideCodeBlock;
}

/**
 * Extracts headings from Markdown content.
 *
 * @param content - The Markdown string to parse
 * @param options - Optional extraction configuration
 * @returns An array of extracted headings
 *
 * @example
 * ```ts
 * const headings = extractHeadings('# Title\n\n## Section 1\n\n### Subsection');
 * // Returns:
 * // [
 * //   { level: 1, text: 'Title', slug: 'title', line: 1 },
 * //   { level: 2, text: 'Section 1', slug: 'section-1', line: 3 },
 * //   { level: 3, text: 'Subsection', slug: 'subsection', line: 5 }
 * // ]
 * ```
 *
 * @example Filtering by level
 * ```ts
 * const headings = extractHeadings(content, { minLevel: 2, maxLevel: 3 });
 * // Only returns h2 and h3 headings
 * ```
 */
export function extractHeadings(
  content: string,
  options: HeadingExtractionOptions = {}
): MarkdownHeading[] {
  const {
    minLevel = 1,
    maxLevel = 6,
    includeCodeBlocks = false,
  } = options;

  // Handle empty content
  if (!content || content.trim() === '') {
    return [];
  }

  const headings: MarkdownHeading[] = [];
  const existingSlugs = new Set<string>();
  const lines = content.split('\n');

  // Match ATX-style headings: # Heading, ## Heading, etc.
  const headingRegex = /^(#{1,6})\s+(.+?)(?:\s+#*)?$/;

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const trimmedLine = line.trim();

    // Skip empty lines
    if (!trimmedLine) {
      continue;
    }

    // Skip lines inside code blocks unless explicitly included
    if (!includeCodeBlocks && isInsideCodeBlock(lines, i)) {
      continue;
    }

    const match = trimmedLine.match(headingRegex);
    if (match) {
      const level = match[1].length;
      const text = match[2].trim();

      // Filter by level range
      if (level < minLevel || level > maxLevel) {
        continue;
      }

      // Generate unique slug
      const baseSlug = generateSlug(text);
      const slug = ensureUniqueSlug(baseSlug, existingSlugs);
      existingSlugs.add(slug);

      headings.push({
        level,
        text,
        slug,
        line: i + 1, // Convert to 1-based line number
      });
    }
  }

  return headings;
}

/**
 * Generates a table of contents from Markdown content.
 *
 * @param content - The Markdown string to parse
 * @param options - Optional TOC generation configuration
 * @returns An array of TOC entries (nested structure by default)
 *
 * @example Basic usage
 * ```ts
 * const toc = generateToc('# Title\n\n## Section 1\n\n### Subsection');
 * // Returns nested structure:
 * // [
 * //   {
 * //     text: 'Title',
 * //     slug: 'title',
 * //     level: 1,
 * //     children: [
 * //       {
 * //         text: 'Section 1',
 * //         slug: 'section-1',
 * //         level: 2,
 * //         children: [
 * //           { text: 'Subsection', slug: 'subsection', level: 3, children: [] }
 * //         ]
 * //       }
 * //     ]
 * //   }
 * // ]
 * ```
 *
 * @example Flat TOC
 * ```ts
 * const toc = generateToc(content, { flat: true });
 * // Returns flat array without nesting
 * ```
 */
export function generateToc(
  content: string,
  options: TocOptions = {}
): TocEntry[] {
  const { flat = false, maxDepth = 6, ...headingOptions } = options;

  const headings = extractHeadings(content, headingOptions);

  if (headings.length === 0) {
    return [];
  }

  // Convert headings to TOC entries
  const entries: TocEntry[] = headings.map((h) => ({
    text: h.text,
    slug: h.slug,
    level: h.level,
    children: [],
  }));

  // Return flat list if requested
  if (flat) {
    return entries;
  }

  // Build nested structure
  return buildNestedToc(entries, maxDepth);
}

/**
 * Builds a nested TOC structure from a flat list of entries.
 *
 * @param entries - Flat array of TOC entries
 * @param maxDepth - Maximum nesting depth
 * @returns Nested array of TOC entries
 */
function buildNestedToc(entries: TocEntry[], maxDepth: number): TocEntry[] {
  if (entries.length === 0) {
    return [];
  }

  const result: TocEntry[] = [];
  const stack: TocEntry[] = [];

  for (const entry of entries) {
    // Create a fresh copy to avoid mutating the original
    const newEntry: TocEntry = {
      text: entry.text,
      slug: entry.slug,
      level: entry.level,
      children: [],
    };

    // Pop entries from stack until we find a parent
    while (stack.length > 0 && stack[stack.length - 1].level >= newEntry.level) {
      stack.pop();
    }

    // Check if we've exceeded max depth
    if (stack.length >= maxDepth) {
      // Add as sibling of the last item at max depth
      const parent = stack[maxDepth - 1];
      if (parent) {
        parent.children.push(newEntry);
      } else {
        result.push(newEntry);
      }
    } else if (stack.length === 0) {
      // No parent, add to root
      result.push(newEntry);
    } else {
      // Add as child of the top of the stack
      stack[stack.length - 1].children.push(newEntry);
    }

    // Push current entry onto stack
    stack.push(newEntry);
  }

  return result;
}

/**
 * Parses Markdown content and extracts structure information.
 *
 * @param content - The Markdown string to parse
 * @param options - Optional parsing configuration
 * @returns A result object with headings, TOC, and status
 *
 * @example
 * ```ts
 * const result = parseMarkdown(content);
 * if (result.success) {
 *   console.log('Headings:', result.headings);
 *   console.log('TOC:', result.toc);
 * }
 * ```
 */
export function parseMarkdown(
  content: string,
  options: TocOptions = {}
): MarkdownParseResult {
  try {
    const headings = extractHeadings(content, options);
    const toc = generateToc(content, options);

    return {
      headings,
      toc,
      success: true,
    };
  } catch (error) {
    return {
      headings: [],
      toc: [],
      success: false,
      error: error instanceof Error ? error.message : 'Unknown parsing error',
    };
  }
}

/**
 * Formats a TOC entry as Markdown list item.
 *
 * @param entry - The TOC entry to format
 * @param indent - Current indentation level
 * @returns Formatted Markdown string
 */
function formatTocEntry(entry: TocEntry, indent: number = 0): string {
  const indentation = '  '.repeat(indent);
  const line = `${indentation}- [${entry.text}](#${entry.slug})`;
  const children = entry.children
    .map((child) => formatTocEntry(child, indent + 1))
    .join('\n');

  return children ? `${line}\n${children}` : line;
}

/**
 * Renders a table of contents as Markdown.
 *
 * @param toc - The TOC entries to render
 * @param title - Optional title for the TOC section
 * @returns Formatted Markdown string
 *
 * @example
 * ```ts
 * const toc = generateToc(content);
 * const markdown = renderTocAsMarkdown(toc, 'Table of Contents');
 * // Returns:
 * // ## Table of Contents
 * //
 * // - [Title](#title)
 * //   - [Section 1](#section-1)
 * //     - [Subsection](#subsection)
 * ```
 */
export function renderTocAsMarkdown(
  toc: TocEntry[],
  title?: string
): string {
  if (toc.length === 0) {
    return '';
  }

  const tocContent = toc.map((entry) => formatTocEntry(entry)).join('\n');

  if (title) {
    return `## ${title}\n\n${tocContent}`;
  }

  return tocContent;
}

/**
 * Gets the first heading from Markdown content.
 * Useful for extracting document title.
 *
 * @param content - The Markdown string to parse
 * @returns The first heading or null if none found
 *
 * @example
 * ```ts
 * const title = getFirstHeading('# My Document\n\nContent here');
 * console.log(title?.text); // 'My Document'
 * ```
 */
export function getFirstHeading(content: string): MarkdownHeading | null {
  const headings = extractHeadings(content, { maxLevel: 6 });
  return headings.length > 0 ? headings[0] : null;
}

/**
 * Gets the document title (first h1 heading).
 *
 * @param content - The Markdown string to parse
 * @returns The title text or null if no h1 found
 *
 * @example
 * ```ts
 * const title = getDocumentTitle('# My Document\n\n## Section');
 * console.log(title); // 'My Document'
 * ```
 */
export function getDocumentTitle(content: string): string | null {
  const headings = extractHeadings(content, { minLevel: 1, maxLevel: 1 });
  return headings.length > 0 ? headings[0].text : null;
}

/**
 * Counts headings by level.
 *
 * @param content - The Markdown string to parse
 * @returns Object with heading counts per level
 *
 * @example
 * ```ts
 * const counts = countHeadingsByLevel('# Title\n\n## A\n\n## B\n\n### C');
 * // Returns: { 1: 1, 2: 2, 3: 1, 4: 0, 5: 0, 6: 0 }
 * ```
 */
export function countHeadingsByLevel(
  content: string
): Record<1 | 2 | 3 | 4 | 5 | 6, number> {
  const headings = extractHeadings(content);

  const counts: Record<1 | 2 | 3 | 4 | 5 | 6, number> = {
    1: 0,
    2: 0,
    3: 0,
    4: 0,
    5: 0,
    6: 0,
  };

  for (const heading of headings) {
    counts[heading.level as 1 | 2 | 3 | 4 | 5 | 6]++;
  }

  return counts;
}

/**
 * Extracts text content from a Markdown string, removing all formatting.
 * Useful for previews or search indexing.
 *
 * @param content - The Markdown string to process
 * @param maxLength - Optional maximum length for the result
 * @returns Plain text content
 *
 * @example
 * ```ts
 * const text = extractPlainText('**Bold** and *italic* text');
 * console.log(text); // 'Bold and italic text'
 * ```
 */
export function extractPlainText(content: string, maxLength?: number): string {
  if (!content) {
    return '';
  }

  let text = content
    // Remove code blocks
    .replace(/```[\s\S]*?```/g, '')
    .replace(/`[^`]+`/g, '')
    // Remove headings markers
    .replace(/^#{1,6}\s+/gm, '')
    // Remove emphasis markers
    .replace(/\*\*([^*]+)\*\*/g, '$1')
    .replace(/\*([^*]+)\*/g, '$1')
    .replace(/__([^_]+)__/g, '$1')
    .replace(/_([^_]+)_/g, '$1')
    // Remove links, keep text
    .replace(/\[([^\]]+)\]\([^)]+\)/g, '$1')
    // Remove images
    .replace(/!\[([^\]]*)\]\([^)]+\)/g, '$1')
    // Remove horizontal rules
    .replace(/^[-*_]{3,}$/gm, '')
    // Remove blockquotes
    .replace(/^>\s*/gm, '')
    // Remove list markers
    .replace(/^[\s]*[-*+]\s+/gm, '')
    .replace(/^[\s]*\d+\.\s+/gm, '')
    // Normalize whitespace
    .replace(/\n{3,}/g, '\n\n')
    .trim();

  if (maxLength && text.length > maxLength) {
    text = text.slice(0, maxLength - 3) + '...';
  }

  return text;
}
