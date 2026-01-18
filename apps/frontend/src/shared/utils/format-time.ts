/**
 * Time Formatting Utilities
 *
 * Shared utilities for formatting time differences and durations.
 * Designed for use with i18n translation functions.
 */

/**
 * Format a timestamp as a human-readable "time remaining" string
 *
 * Calculates the time difference between the given timestamp and now,
 * then formats it using the provided translation function.
 *
 * @param timestamp - ISO timestamp string to format
 * @param t - i18next translation function
 * @param options - Optional configuration
 * @returns Formatted time string, or undefined if timestamp is invalid
 *
 * @example
 * formatTimeRemaining('2025-01-20T15:00:00Z', t)
 * // Returns: "Resets in 2h 30m" or "Resets in 3d 5h" depending on time difference
 *
 * @example
 * formatTimeRemaining('2025-01-20T15:00:00Z', t, {
 *   hoursKey: 'usage:resetsInHours',
 *   daysKey: 'usage:resetsInDays'
 * })
 */
export interface FormatTimeRemainingOptions {
  /** Translation key for hours/minutes format (default: 'usage:resetsInHours') */
  hoursKey?: string;
  /** Translation key for days/hours format (default: 'usage:resetsInDays') */
  daysKey?: string;
}

export function formatTimeRemaining(
  timestamp: string | undefined,
  t: (key: string, params?: Record<string, unknown>) => string,
  options: FormatTimeRemainingOptions = {}
): string | undefined {
  if (!timestamp) return undefined;

  const { hoursKey = 'usage:resetsInHours', daysKey = 'usage:resetsInDays' } = options;

  try {
    const date = new Date(timestamp);

    // Handle invalid dates (isNaN check before using getTime())
    if (isNaN(date.getTime())) return undefined;

    const now = new Date();
    const diffMs = date.getTime() - now.getTime();

    // Handle past dates
    if (diffMs < 0) {
      // Return undefined for past dates - caller can provide fallback
      return undefined;
    }

    const diffHours = Math.floor(diffMs / (1000 * 60 * 60));
    const diffMins = Math.floor((diffMs % (1000 * 60 * 60)) / (1000 * 60));

    if (diffHours < 24) {
      return t(hoursKey, { hours: diffHours, minutes: diffMins });
    }

    const diffDays = Math.floor(diffHours / 24);
    const remainingHours = diffHours % 24;
    return t(daysKey, { days: diffDays, hours: remainingHours });
  } catch (_error) {
    return undefined;
  }
}

/**
 * Simple time formatting for main process (no i18n)
 *
 * Used in usage-monitor.ts for backend time formatting.
 * Returns simple "2h 30m" or "3d 5h" format.
 *
 * @param timestamp - ISO timestamp string
 * @returns Formatted time string, or 'Unknown'/'Expired' for special cases
 */
export function formatTimeRemainingSimple(timestamp: string | undefined): string {
  if (!timestamp) return 'Unknown';

  try {
    const date = new Date(timestamp);

    // Handle invalid dates
    if (isNaN(date.getTime())) return 'Unknown';

    const now = new Date();
    const diffMs = date.getTime() - now.getTime();

    // Handle past dates
    if (diffMs < 0) return 'Expired';

    const diffHours = Math.floor(diffMs / (1000 * 60 * 60));
    const diffMins = Math.floor((diffMs % (1000 * 60 * 60)) / (1000 * 60));

    if (diffHours < 24) {
      return `${diffHours}h ${diffMins}m`;
    }

    const diffDays = Math.floor(diffHours / 24);
    const remainingHours = diffHours % 24;
    return `${diffDays}d ${remainingHours}h`;
  } catch (_error) {
    return 'Unknown';
  }
}
