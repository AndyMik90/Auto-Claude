import type {
  ChangelogGenerationRequest,
  TaskSpecContent,
  GitCommit
} from '../../shared/types';
import { extractSpecOverview } from './parser';

/**
 * Format instructions for different changelog styles
 */
const FORMAT_TEMPLATES = {
  'keep-a-changelog': (version: string, date: string) => `## [${version}] - ${date}

### Added
- [New features]

### Changed
- [Modifications]

### Fixed
- [Bug fixes]`,

  'simple-list': (version: string, date: string) => `# Release v${version} (${date})

**New Features:**
- [List features]

**Improvements:**
- [List improvements]

**Bug Fixes:**
- [List fixes]`,

  'github-release': (version: string) => `## What's New in v${version}

### New Features
- **Feature Name**: Description

### Improvements
- Description

### Bug Fixes
- Fixed [issue]`
};

/**
 * Audience-specific writing instructions
 */
const AUDIENCE_INSTRUCTIONS = {
  'technical': 'You are a technical documentation specialist creating a changelog for developers. Use precise technical language.',
  'user-facing': 'You are a product manager writing release notes for end users. Use clear, non-technical language focusing on user benefits.',
  'marketing': 'You are a marketing specialist writing release notes. Focus on outcomes and user impact with compelling language.'
};

/**
 * Build changelog prompt from task specs
 */
export function buildChangelogPrompt(
  request: ChangelogGenerationRequest,
  specs: TaskSpecContent[]
): string {
  const audienceInstruction = AUDIENCE_INSTRUCTIONS[request.audience];
  const formatInstruction = FORMAT_TEMPLATES[request.format](request.version, request.date);

  // Build CONCISE task summaries (key to avoiding timeout)
  const taskSummaries = specs.map(spec => {
    const parts: string[] = [`- **${spec.specId}**`];

    // Get workflow type if available
    if (spec.implementationPlan?.workflow_type) {
      parts.push(`(${spec.implementationPlan.workflow_type})`);
    }

    // Extract just the overview/purpose
    if (spec.spec) {
      const overview = extractSpecOverview(spec.spec);
      if (overview) {
        parts.push(`: ${overview}`);
      }
    }

    return parts.join('');
  }).join('\n');

  return `${audienceInstruction}

Format:
${formatInstruction}

Completed tasks:
${taskSummaries}

${request.customInstructions ? `Note: ${request.customInstructions}` : ''}

CRITICAL: Output ONLY the raw changelog content. Do NOT include ANY introductory text, analysis, or explanation. Start directly with the changelog heading (## or #). No "Here's the changelog" or similar phrases.`;
}

/**
 * Build changelog prompt from git commits
 */
export function buildGitPrompt(
  request: ChangelogGenerationRequest,
  commits: GitCommit[]
): string {
  const audienceInstruction = AUDIENCE_INSTRUCTIONS[request.audience];
  const formatInstruction = FORMAT_TEMPLATES[request.format](request.version, request.date);

  // Format commits for the prompt
  // Group by conventional commit type if detected
  const commitLines = commits.map(commit => {
    const hash = commit.hash;
    const subject = commit.subject;
    // Detect conventional commit format: type(scope): message
    const conventionalMatch = subject.match(/^(\w+)(?:\(([^)]+)\))?:\s*(.+)$/);
    if (conventionalMatch) {
      const [, type, scope, message] = conventionalMatch;
      return `- ${hash}: [${type}${scope ? `/${scope}` : ''}] ${message}`;
    }
    return `- ${hash}: ${subject}`;
  }).join('\n');

  // Add context about branch/range if available
  let sourceContext = '';
  if (request.branchDiff) {
    sourceContext = `These commits are from branch "${request.branchDiff.compareBranch}" that are not in "${request.branchDiff.baseBranch}".`;
  } else if (request.gitHistory) {
    switch (request.gitHistory.type) {
      case 'recent':
        sourceContext = `These are the ${commits.length} most recent commits.`;
        break;
      case 'since-date':
        sourceContext = `These are commits since ${request.gitHistory.sinceDate}.`;
        break;
      case 'tag-range':
        sourceContext = `These are commits between tag "${request.gitHistory.fromTag}" and "${request.gitHistory.toTag || 'HEAD'}".`;
        break;
    }
  }

  return `${audienceInstruction}

${sourceContext}

Generate a changelog from these git commits. Group related changes together and categorize them appropriately.

Conventional commit types to recognize:
- feat/feature: New features → Added section
- fix/bugfix: Bug fixes → Fixed section
- docs: Documentation → Changed or separate Documentation section
- style: Styling/formatting → Changed section
- refactor: Code refactoring → Changed section
- perf: Performance → Changed or Performance section
- test: Tests → (usually omit unless significant)
- chore: Maintenance → (usually omit unless significant)

Format:
${formatInstruction}

Git commits (${commits.length} total):
${commitLines}

${request.customInstructions ? `Note: ${request.customInstructions}` : ''}

CRITICAL: Output ONLY the raw changelog content. Do NOT include ANY introductory text, analysis, or explanation. Start directly with the changelog heading (## or #). No "Here's the changelog" or similar phrases. Intelligently group and summarize related commits - don't just list each commit individually.`;
}

/**
 * Create Python script for Claude generation
 */
export function createGenerationScript(prompt: string, claudePath: string): string {
  // Convert prompt to base64 to avoid any string escaping issues in Python
  const base64Prompt = Buffer.from(prompt, 'utf-8').toString('base64');

  // Escape the claude path for Python string
  const escapedClaudePath = claudePath.replace(/\\/g, '\\\\').replace(/'/g, "\\'");

  return `
import subprocess
import sys
import base64

try:
    # Decode the base64 prompt to avoid string escaping issues
    prompt = base64.b64decode('${base64Prompt}').decode('utf-8')

    # Use Claude Code CLI to generate
    # stdin=DEVNULL prevents hanging when claude checks for interactive input
    result = subprocess.run(
        ['${escapedClaudePath}', '-p', prompt, '--output-format', 'text', '--model', 'haiku'],
        capture_output=True,
        text=True,
        stdin=subprocess.DEVNULL,
        timeout=300
    )

    if result.returncode == 0:
        print(result.stdout)
    else:
        # Print more detailed error info
        print(f"Claude CLI error (code {result.returncode}):", file=sys.stderr)
        if result.stderr:
            print(result.stderr, file=sys.stderr)
        if result.stdout:
            print(f"stdout: {result.stdout}", file=sys.stderr)
        sys.exit(1)
except Exception as e:
    print(f"Python error: {type(e).__name__}: {e}", file=sys.stderr)
    sys.exit(1)
`;
}
