/**
 * Rate limit detection utility for Claude CLI/SDK calls.
 * Detects rate limit errors in stdout/stderr output and provides context.
 */

import { getClaudeProfileManager } from './claude-profile-manager';

/**
 * Regex pattern to detect Claude Code rate limit messages
 * Matches: "Limit reached · resets Dec 17 at 6am (Europe/Oslo)"
 */
const RATE_LIMIT_PATTERN = /Limit reached\s*[·•]\s*resets\s+(.+?)(?:\s*$|\n)/im;

/**
 * Additional patterns that might indicate rate limiting
 */
const RATE_LIMIT_INDICATORS = [
  /rate\s*limit/i,
  /usage\s*limit/i,
  /limit\s*reached/i,
  /exceeded.*limit/i,
  /too\s*many\s*requests/i
];

/**
 * Patterns that indicate authentication failures
 * These patterns detect when Claude CLI/SDK fails due to missing or invalid auth
 */
const AUTH_FAILURE_PATTERNS = [
  /authentication\s*(is\s*)?required/i,
  /not\s*(yet\s*)?authenticated/i,
  /login\s*(is\s*)?required/i,
  /oauth\s*token\s*(is\s*)?(invalid|expired|missing)/i,
  /unauthorized/i,
  /please\s*(log\s*in|login|authenticate)/i,
  /invalid\s*(credentials|token|api\s*key)/i,
  /auth(entication)?\s*(failed|error|failure)/i,
  /session\s*(expired|invalid)/i,
  /access\s*denied/i,
  /permission\s*denied/i,
  /401\s*unauthorized/i,
  /credentials\s*(are\s*)?(missing|invalid|expired)/i,
  // Match "OAuth token has expired" format from Claude API
  /oauth\s*token\s+has\s+expired/i,
  // Match Claude API authentication_error type in JSON responses
  /["']?type["']?\s*:\s*["']?authentication_error["']?/i,
  // Match plain "API Error: 401" without requiring "unauthorized"
  /API\s*Error:\s*401/i,
  // Match "Please obtain a new token" message from Claude API
  /please\s*(obtain|get|refresh)\s*(a\s*)?new\s*token/i
];

/**
 * Result of rate limit detection
 */
export interface RateLimitDetectionResult {
  /** Whether a rate limit was detected */
  isRateLimited: boolean;
  /** The reset time string if detected (e.g., "Dec 17 at 6am (Europe/Oslo)") */
  resetTime?: string;
  /** Type of limit: 'session' (5-hour) or 'weekly' (7-day) */
  limitType?: 'session' | 'weekly';
  /** The profile ID that hit the limit (if known) */
  profileId?: string;
  /** Best alternative profile to switch to */
  suggestedProfile?: {
    id: string;
    name: string;
  };
  /** Original error message */
  originalError?: string;
}

/**
 * Result of authentication failure detection
 */
export interface AuthFailureDetectionResult {
  /** Whether an authentication failure was detected */
  isAuthFailure: boolean;
  /** The profile ID that failed to authenticate (if known) */
  profileId?: string;
  /** The type of auth failure detected */
  failureType?: 'missing' | 'invalid' | 'expired' | 'unknown';
  /** User-friendly message describing the failure */
  message?: string;
  /** Original error message from the process output */
  originalError?: string;
}

/**
 * Classify rate limit type based on reset time string
 */
function classifyLimitType(resetTimeStr: string): 'session' | 'weekly' {
  // Weekly limits mention specific dates like "Dec 17" or "Nov 1"
  // Session limits are typically just times like "11:59pm"
  const hasDate = /[A-Za-z]{3}\s+\d+/i.test(resetTimeStr);
  const hasWeeklyIndicator = resetTimeStr.toLowerCase().includes('week');

  return (hasDate || hasWeeklyIndicator) ? 'weekly' : 'session';
}

/**
 * Detect rate limit from output (stdout + stderr combined)
 */
export function detectRateLimit(
  output: string,
  profileId?: string
): RateLimitDetectionResult {
  // Check for the primary rate limit pattern
  const match = output.match(RATE_LIMIT_PATTERN);

  if (match) {
    const resetTime = match[1].trim();
    const limitType = classifyLimitType(resetTime);

    // Record the rate limit event in the profile manager
    const profileManager = getClaudeProfileManager();
    const effectiveProfileId = profileId || profileManager.getActiveProfile().id;

    try {
      profileManager.recordRateLimitEvent(effectiveProfileId, resetTime);
    } catch (err) {
      console.error('[RateLimitDetector] Failed to record rate limit event:', err);
    }

    // Find best alternative profile
    const bestProfile = profileManager.getBestAvailableProfile(effectiveProfileId);

    return {
      isRateLimited: true,
      resetTime,
      limitType,
      profileId: effectiveProfileId,
      suggestedProfile: bestProfile ? {
        id: bestProfile.id,
        name: bestProfile.name
      } : undefined,
      originalError: output
    };
  }

  // Check for secondary rate limit indicators
  for (const pattern of RATE_LIMIT_INDICATORS) {
    if (pattern.test(output)) {
      const profileManager = getClaudeProfileManager();
      const effectiveProfileId = profileId || profileManager.getActiveProfile().id;
      const bestProfile = profileManager.getBestAvailableProfile(effectiveProfileId);

      return {
        isRateLimited: true,
        profileId: effectiveProfileId,
        suggestedProfile: bestProfile ? {
          id: bestProfile.id,
          name: bestProfile.name
        } : undefined,
        originalError: output
      };
    }
  }

  return { isRateLimited: false };
}

/**
 * Check if output contains rate limit error
 */
export function isRateLimitError(output: string): boolean {
  return detectRateLimit(output).isRateLimited;
}

/**
 * Extract reset time from rate limit message
 */
export function extractResetTime(output: string): string | null {
  const match = output.match(RATE_LIMIT_PATTERN);
  return match ? match[1].trim() : null;
}

/**
 * Classify the type of authentication failure based on the error message
 */
function classifyAuthFailureType(output: string): 'missing' | 'invalid' | 'expired' | 'unknown' {
  const lowerOutput = output.toLowerCase();

  if (/missing|not\s*(yet\s*)?authenticated|required/.test(lowerOutput)) {
    return 'missing';
  }
  // Check for expired tokens - includes "has expired", "obtain a new token", etc.
  if (/expired|session\s*expired|obtain\s*(a\s*)?new\s*token|refresh\s*(your\s*)?(existing\s*)?token/.test(lowerOutput)) {
    return 'expired';
  }
  // Check for invalid auth - includes 401, authentication_error, unauthorized
  if (/invalid|unauthorized|denied|401|authentication_error/.test(lowerOutput)) {
    return 'invalid';
  }
  return 'unknown';
}

/**
 * Get a user-friendly message for the authentication failure
 */
function getAuthFailureMessage(failureType: 'missing' | 'invalid' | 'expired' | 'unknown'): string {
  switch (failureType) {
    case 'missing':
      return 'Claude authentication required. Please go to Settings > Claude Profiles and authenticate your account.';
    case 'expired':
      return 'Your Claude session has expired. Please re-authenticate in Settings > Claude Profiles.';
    case 'invalid':
      return 'Invalid Claude credentials. Please check your OAuth token or re-authenticate in Settings > Claude Profiles.';
    case 'unknown':
    default:
      return 'Claude authentication failed. Please verify your authentication in Settings > Claude Profiles.';
  }
}

/**
 * Detect authentication failure from output (stdout + stderr combined)
 */
export function detectAuthFailure(
  output: string,
  profileId?: string
): AuthFailureDetectionResult {
  // First, make sure this isn't a rate limit error (those should be handled separately)
  if (detectRateLimit(output).isRateLimited) {
    return { isAuthFailure: false };
  }

  // Check for authentication failure patterns
  for (const pattern of AUTH_FAILURE_PATTERNS) {
    if (pattern.test(output)) {
      const profileManager = getClaudeProfileManager();
      const effectiveProfileId = profileId || profileManager.getActiveProfile().id;
      const failureType = classifyAuthFailureType(output);

      return {
        isAuthFailure: true,
        profileId: effectiveProfileId,
        failureType,
        message: getAuthFailureMessage(failureType),
        originalError: output
      };
    }
  }

  return { isAuthFailure: false };
}

/**
 * Check if output contains authentication failure error
 */
export function isAuthFailureError(output: string): boolean {
  return detectAuthFailure(output).isAuthFailure;
}

/**
 * Get environment variables for a specific Claude profile.
 *
 * IMPORTANT: Always uses CLAUDE_CONFIG_DIR to let Claude CLI read fresh tokens from Keychain.
 * We do NOT use cached OAuth tokens (CLAUDE_CODE_OAUTH_TOKEN) because:
 * 1. OAuth tokens expire in 8-12 hours
 * 2. Claude CLI's token refresh mechanism works (updates Keychain)
 * 3. Cached tokens don't benefit from Claude CLI's automatic refresh
 *
 * By using CLAUDE_CONFIG_DIR, Claude CLI reads fresh tokens from Keychain each time,
 * which includes any refreshed tokens. This solves the 401 errors after a few hours.
 *
 * See: docs/LONG_LIVED_AUTH_PLAN.md for full context.
 *
 * @param profileId - Optional profile ID. If not provided, uses active profile.
 * @returns Environment variables for Claude CLI invocation
 */
export function getProfileEnv(profileId?: string): Record<string, string> {
  const profileManager = getClaudeProfileManager();

  // Delegate to profile manager's implementation to avoid code duplication
  if (profileId) {
    return profileManager.getProfileEnv(profileId);
  }
  return profileManager.getActiveProfileEnv();
}

/**
 * Get the active Claude profile ID
 */
export function getActiveProfileId(): string {
  return getClaudeProfileManager().getActiveProfile().id;
}

/**
 * Information about a rate limit event for the UI
 */
export interface SDKRateLimitInfo {
  /** Source of the rate limit (which feature hit it) */
  source: 'changelog' | 'task' | 'roadmap' | 'ideation' | 'title-generator' | 'other';
  /** Project ID if applicable */
  projectId?: string;
  /** Task ID if applicable */
  taskId?: string;
  /** The reset time string */
  resetTime?: string;
  /** Type of limit */
  limitType?: 'session' | 'weekly';
  /** Profile that hit the limit */
  profileId: string;
  /** Profile name for display */
  profileName?: string;
  /** Suggested alternative profile */
  suggestedProfile?: {
    id: string;
    name: string;
  };
  /** When detected */
  detectedAt: Date;
  /** Original error message */
  originalError?: string;

  // Auto-swap information
  /** Whether this rate limit was automatically handled via account swap */
  wasAutoSwapped?: boolean;
  /** Profile that was swapped to (if auto-swapped) */
  swappedToProfile?: {
    id: string;
    name: string;
  };
  /** Why the swap occurred: 'proactive' (before limit) or 'reactive' (after limit hit) */
  swapReason?: 'proactive' | 'reactive';
}

/**
 * Create SDK rate limit info object for emitting to UI
 */
export function createSDKRateLimitInfo(
  source: SDKRateLimitInfo['source'],
  detection: RateLimitDetectionResult,
  options?: {
    projectId?: string;
    taskId?: string;
  }
): SDKRateLimitInfo {
  const profileManager = getClaudeProfileManager();
  const profile = detection.profileId
    ? profileManager.getProfile(detection.profileId)
    : profileManager.getActiveProfile();

  return {
    source,
    projectId: options?.projectId,
    taskId: options?.taskId,
    resetTime: detection.resetTime,
    limitType: detection.limitType,
    profileId: detection.profileId || profileManager.getActiveProfile().id,
    profileName: profile?.name,
    suggestedProfile: detection.suggestedProfile,
    detectedAt: new Date(),
    originalError: detection.originalError
  };
}
