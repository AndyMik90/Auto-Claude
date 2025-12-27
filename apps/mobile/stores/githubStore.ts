/**
 * GitHub Store
 * Zustand store for GitHub issues and pull requests management
 * Uses persist middleware with AsyncStorage for data persistence
 */

import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import AsyncStorage from '@react-native-async-storage/async-storage';
import type {
  GitHubIssue,
  GitHubPR,
  GitHubLabel,
  GitHubUser,
  IssueFilters,
  PRFilters,
  IssueState,
  PRState,
  GitHubRepository,
  GitHubIntegrationStatus,
} from '../types';

/**
 * Mock GitHub users
 */
const mockUsers: Record<string, GitHubUser> = {
  alice: {
    id: 'user-001',
    login: 'alice-dev',
    avatarUrl: 'https://api.dicebear.com/7.x/avataaars/svg?seed=alice',
    type: 'user',
  },
  bob: {
    id: 'user-002',
    login: 'bob-engineer',
    avatarUrl: 'https://api.dicebear.com/7.x/avataaars/svg?seed=bob',
    type: 'user',
  },
  charlie: {
    id: 'user-003',
    login: 'charlie-ops',
    avatarUrl: 'https://api.dicebear.com/7.x/avataaars/svg?seed=charlie',
    type: 'user',
  },
  dependabot: {
    id: 'bot-001',
    login: 'dependabot[bot]',
    avatarUrl: 'https://api.dicebear.com/7.x/bottts/svg?seed=dependabot',
    type: 'bot',
  },
  autoclaude: {
    id: 'bot-002',
    login: 'autoclaude[bot]',
    avatarUrl: 'https://api.dicebear.com/7.x/bottts/svg?seed=autoclaude',
    type: 'bot',
  },
};

/**
 * Mock GitHub labels
 */
const mockLabels: Record<string, GitHubLabel> = {
  bug: { id: 'label-001', name: 'bug', color: 'd73a4a', description: 'Something is broken' },
  feature: { id: 'label-002', name: 'feature', color: 'a2eeef', description: 'New feature request' },
  enhancement: { id: 'label-003', name: 'enhancement', color: '84b6eb', description: 'Improvement to existing feature' },
  documentation: { id: 'label-004', name: 'documentation', color: '0075ca', description: 'Documentation changes' },
  performance: { id: 'label-005', name: 'performance', color: 'fbca04', description: 'Performance related' },
  security: { id: 'label-006', name: 'security', color: 'b60205', description: 'Security vulnerability' },
  'good-first-issue': { id: 'label-007', name: 'good first issue', color: '7057ff', description: 'Good for newcomers' },
  'help-wanted': { id: 'label-008', name: 'help wanted', color: '008672', description: 'Extra attention needed' },
  wontfix: { id: 'label-009', name: 'wontfix', color: 'ffffff', description: 'Will not be fixed' },
  critical: { id: 'label-010', name: 'critical', color: 'b60205', description: 'Critical priority' },
  urgent: { id: 'label-011', name: 'urgent', color: 'd93f0b', description: 'Urgent priority' },
  'needs-review': { id: 'label-012', name: 'needs review', color: 'fbca04', description: 'Awaiting code review' },
};

/**
 * Mock GitHub issues (10+)
 */
const mockIssues: GitHubIssue[] = [
  {
    id: 'issue-001',
    number: 142,
    title: 'Memory leak when switching between chat sessions rapidly',
    body: '## Description\n\nWhen rapidly switching between chat sessions (clicking through 5-10 sessions quickly), memory usage increases significantly and doesn\'t get released.\n\n## Steps to Reproduce\n1. Open the chat view\n2. Create 5+ chat sessions\n3. Click through them rapidly\n4. Monitor memory in Dev Tools\n\n## Expected Behavior\nMemory should stabilize after switching.\n\n## Actual Behavior\nMemory keeps growing until the app becomes unresponsive.',
    state: 'open',
    author: mockUsers.alice,
    assignees: [mockUsers.bob],
    labels: [mockLabels.bug, mockLabels.critical, mockLabels.performance],
    comments: [],
    commentCount: 3,
    createdAt: '2025-01-15T09:30:00Z',
    updatedAt: '2025-01-16T14:22:00Z',
    repositoryOwner: 'autoclaude',
    repositoryName: 'companion-app',
    htmlUrl: 'https://github.com/autoclaude/companion-app/issues/142',
    isInvestigating: true,
  },
  {
    id: 'issue-002',
    number: 138,
    title: 'Add dark mode support for terminal viewer',
    body: 'The terminal viewer should support a dark mode theme that matches the rest of the app when dark mode is enabled.\n\nCurrently the terminal uses a hardcoded color scheme.',
    state: 'open',
    author: mockUsers.charlie,
    labels: [mockLabels.feature, mockLabels.enhancement],
    comments: [],
    commentCount: 1,
    createdAt: '2025-01-14T11:00:00Z',
    updatedAt: '2025-01-14T11:00:00Z',
    repositoryOwner: 'autoclaude',
    repositoryName: 'companion-app',
    htmlUrl: 'https://github.com/autoclaude/companion-app/issues/138',
  },
  {
    id: 'issue-003',
    number: 135,
    title: 'WebSocket disconnects after 5 minutes of inactivity',
    body: '## Bug Report\n\nThe WebSocket connection drops after approximately 5 minutes of user inactivity. This causes real-time updates to stop working.\n\n## Environment\n- iOS 17.2\n- App version 1.0.0\n\n## Workaround\nPull-to-refresh restores the connection.',
    state: 'open',
    author: mockUsers.bob,
    assignees: [mockUsers.alice],
    labels: [mockLabels.bug, mockLabels.urgent],
    comments: [],
    commentCount: 5,
    createdAt: '2025-01-13T16:45:00Z',
    updatedAt: '2025-01-16T10:00:00Z',
    repositoryOwner: 'autoclaude',
    repositoryName: 'companion-app',
    htmlUrl: 'https://github.com/autoclaude/companion-app/issues/135',
    isAutoFixing: true,
    linkedTaskId: 'task-005',
  },
  {
    id: 'issue-004',
    number: 131,
    title: 'Implement drag-and-drop for task reordering within columns',
    body: 'Allow users to reorder tasks within the same Kanban column using drag-and-drop.\n\nThis is a prerequisite for #132 (cross-column drag-and-drop).',
    state: 'open',
    author: mockUsers.alice,
    labels: [mockLabels.feature, mockLabels['good-first-issue']],
    comments: [],
    commentCount: 2,
    createdAt: '2025-01-12T14:30:00Z',
    updatedAt: '2025-01-12T14:30:00Z',
    repositoryOwner: 'autoclaude',
    repositoryName: 'companion-app',
    htmlUrl: 'https://github.com/autoclaude/companion-app/issues/131',
  },
  {
    id: 'issue-005',
    number: 127,
    title: 'API documentation is outdated for /tasks endpoint',
    body: 'The API documentation for the `/tasks` endpoint is missing the new `complexity` and `impact` fields that were added in v1.2.0.',
    state: 'open',
    author: mockUsers.charlie,
    labels: [mockLabels.documentation],
    comments: [],
    commentCount: 0,
    createdAt: '2025-01-10T09:00:00Z',
    updatedAt: '2025-01-10T09:00:00Z',
    repositoryOwner: 'autoclaude',
    repositoryName: 'companion-app',
    htmlUrl: 'https://github.com/autoclaude/companion-app/issues/127',
  },
  {
    id: 'issue-006',
    number: 123,
    title: 'Security: Rate limiting not applied to authentication endpoints',
    body: '## Security Issue\n\nThe login and token refresh endpoints do not have rate limiting applied. This could allow brute force attacks.\n\n**Severity**: High\n\n**Recommendation**: Apply rate limiting of 5 requests per minute per IP.',
    state: 'open',
    author: mockUsers.bob,
    labels: [mockLabels.security, mockLabels.critical],
    comments: [],
    commentCount: 4,
    createdAt: '2025-01-08T08:15:00Z',
    updatedAt: '2025-01-15T12:00:00Z',
    repositoryOwner: 'autoclaude',
    repositoryName: 'companion-app',
    htmlUrl: 'https://github.com/autoclaude/companion-app/issues/123',
    linkedTaskId: 'task-001',
  },
  {
    id: 'issue-007',
    number: 119,
    title: 'Add biometric authentication option',
    body: 'Allow users to authenticate using Face ID / Touch ID on iOS and fingerprint on Android instead of entering API key each time.',
    state: 'open',
    author: mockUsers.alice,
    labels: [mockLabels.feature, mockLabels.security],
    comments: [],
    commentCount: 6,
    createdAt: '2025-01-06T11:30:00Z',
    updatedAt: '2025-01-14T09:45:00Z',
    repositoryOwner: 'autoclaude',
    repositoryName: 'companion-app',
    htmlUrl: 'https://github.com/autoclaude/companion-app/issues/119',
  },
  {
    id: 'issue-008',
    number: 115,
    title: 'Support for multiple project workspaces',
    body: 'Users should be able to manage multiple project workspaces and easily switch between them.\n\n## Requirements\n- Add project selector in header\n- Track recently accessed projects\n- Persist project preference across sessions',
    state: 'closed',
    author: mockUsers.charlie,
    labels: [mockLabels.feature],
    comments: [],
    commentCount: 8,
    createdAt: '2025-01-03T15:00:00Z',
    updatedAt: '2025-01-12T16:30:00Z',
    closedAt: '2025-01-12T16:30:00Z',
    repositoryOwner: 'autoclaude',
    repositoryName: 'companion-app',
    htmlUrl: 'https://github.com/autoclaude/companion-app/issues/115',
  },
  {
    id: 'issue-009',
    number: 112,
    title: 'Crash on iPad when rotating device during onboarding',
    body: 'The app crashes when rotating an iPad from portrait to landscape during the QR code scanning step of onboarding.\n\n**Device**: iPad Pro 12.9" (5th generation)\n**iOS Version**: 17.1',
    state: 'closed',
    author: mockUsers.bob,
    labels: [mockLabels.bug],
    comments: [],
    commentCount: 3,
    createdAt: '2025-01-02T10:00:00Z',
    updatedAt: '2025-01-05T14:00:00Z',
    closedAt: '2025-01-05T14:00:00Z',
    repositoryOwner: 'autoclaude',
    repositoryName: 'companion-app',
    htmlUrl: 'https://github.com/autoclaude/companion-app/issues/112',
  },
  {
    id: 'issue-010',
    number: 108,
    title: 'Push notifications not received on Android 14',
    body: 'Push notifications are not being received on devices running Android 14. Works fine on Android 13 and below.\n\nLikely related to the new notification permission changes in Android 14.',
    state: 'open',
    author: mockUsers.alice,
    assignees: [mockUsers.charlie],
    labels: [mockLabels.bug, mockLabels['help-wanted']],
    comments: [],
    commentCount: 2,
    createdAt: '2024-12-28T09:30:00Z',
    updatedAt: '2025-01-10T11:00:00Z',
    repositoryOwner: 'autoclaude',
    repositoryName: 'companion-app',
    htmlUrl: 'https://github.com/autoclaude/companion-app/issues/108',
  },
  {
    id: 'issue-011',
    number: 104,
    title: 'Improve error messages for API failures',
    body: 'Current error messages are too generic (e.g., "Something went wrong"). We should provide more helpful error messages that guide users on what to do.',
    state: 'closed',
    author: mockUsers.charlie,
    labels: [mockLabels.enhancement, mockLabels['good-first-issue']],
    comments: [],
    commentCount: 4,
    createdAt: '2024-12-20T14:00:00Z',
    updatedAt: '2024-12-27T10:30:00Z',
    closedAt: '2024-12-27T10:30:00Z',
    repositoryOwner: 'autoclaude',
    repositoryName: 'companion-app',
    htmlUrl: 'https://github.com/autoclaude/companion-app/issues/104',
  },
  {
    id: 'issue-012',
    number: 99,
    title: 'Add offline mode with sync when back online',
    body: '## Feature Request\n\nAllow the app to function in a limited capacity when offline:\n- View cached tasks and projects\n- Queue actions to sync when back online\n- Show clear offline indicator',
    state: 'open',
    author: mockUsers.bob,
    labels: [mockLabels.feature, mockLabels.enhancement],
    comments: [],
    commentCount: 7,
    createdAt: '2024-12-15T16:00:00Z',
    updatedAt: '2025-01-08T09:00:00Z',
    repositoryOwner: 'autoclaude',
    repositoryName: 'companion-app',
    htmlUrl: 'https://github.com/autoclaude/companion-app/issues/99',
  },
];

/**
 * Mock GitHub PRs (5+)
 */
const mockPRs: GitHubPR[] = [
  {
    id: 'pr-001',
    number: 143,
    title: 'Fix memory leak in chat session switching',
    body: '## Summary\nFixes #142 by properly cleaning up subscriptions and event listeners when switching chat sessions.\n\n## Changes\n- Added cleanup function to useEffect hooks\n- Implemented proper unsubscription from WebSocket events\n- Added memory profiling tests\n\n## Test Plan\n- [x] Manual testing with 10+ rapid session switches\n- [x] Memory profiling shows stable usage\n- [x] All existing tests pass',
    state: 'open',
    isDraft: false,
    headBranch: 'fix/chat-memory-leak',
    baseBranch: 'main',
    author: mockUsers.bob,
    assignees: [mockUsers.alice],
    reviewers: [mockUsers.charlie],
    labels: [mockLabels.bug, mockLabels['needs-review']],
    reviews: [
      {
        id: 'review-001',
        author: mockUsers.charlie,
        state: 'commented',
        body: 'Looks good overall, but can you add a test case for rapid switching?',
        submittedAt: '2025-01-16T10:30:00Z',
      },
    ],
    comments: [],
    commentCount: 2,
    reviewCount: 1,
    checks: [
      { id: 'check-001', name: 'Tests', status: 'completed', conclusion: 'success' },
      { id: 'check-002', name: 'Lint', status: 'completed', conclusion: 'success' },
      { id: 'check-003', name: 'Build', status: 'completed', conclusion: 'success' },
    ],
    checksStatus: 'success',
    mergeable: true,
    mergeableState: 'mergeable',
    additions: 127,
    deletions: 45,
    changedFiles: 8,
    createdAt: '2025-01-16T08:00:00Z',
    updatedAt: '2025-01-16T14:00:00Z',
    repositoryOwner: 'autoclaude',
    repositoryName: 'companion-app',
    htmlUrl: 'https://github.com/autoclaude/companion-app/pull/143',
    linkedTaskId: 'task-005',
  },
  {
    id: 'pr-002',
    number: 141,
    title: 'Add Kanban drag-and-drop with react-native-gesture-handler',
    body: '## Summary\nImplements cross-column drag-and-drop for the Kanban board using react-native-gesture-handler and react-native-reanimated.\n\n## Features\n- Smooth drag animations\n- Visual feedback during drag\n- Haptic feedback on drop\n- Automatic column scrolling when dragging near edges',
    state: 'open',
    isDraft: false,
    headBranch: 'feature/kanban-dnd',
    baseBranch: 'main',
    author: mockUsers.alice,
    reviewers: [mockUsers.bob, mockUsers.charlie],
    labels: [mockLabels.feature],
    reviews: [
      {
        id: 'review-002',
        author: mockUsers.bob,
        state: 'approved',
        body: 'Great work! The animations are smooth.',
        submittedAt: '2025-01-15T16:00:00Z',
      },
      {
        id: 'review-003',
        author: mockUsers.charlie,
        state: 'changes_requested',
        body: 'Please add accessibility labels for screen readers.',
        submittedAt: '2025-01-15T17:00:00Z',
      },
    ],
    comments: [],
    commentCount: 5,
    reviewCount: 2,
    checks: [
      { id: 'check-004', name: 'Tests', status: 'completed', conclusion: 'success' },
      { id: 'check-005', name: 'Lint', status: 'completed', conclusion: 'failure' },
      { id: 'check-006', name: 'Build', status: 'completed', conclusion: 'success' },
    ],
    checksStatus: 'failure',
    mergeable: true,
    mergeableState: 'mergeable',
    additions: 542,
    deletions: 89,
    changedFiles: 15,
    createdAt: '2025-01-14T10:00:00Z',
    updatedAt: '2025-01-15T17:00:00Z',
    repositoryOwner: 'autoclaude',
    repositoryName: 'companion-app',
    htmlUrl: 'https://github.com/autoclaude/companion-app/pull/141',
    linkedTaskId: 'task-009',
  },
  {
    id: 'pr-003',
    number: 139,
    title: 'chore(deps): bump expo from 52.0.0 to 54.0.0',
    body: 'Bumps [expo](https://github.com/expo/expo) from 52.0.0 to 54.0.0.\n\n<details>\n<summary>Release notes</summary>\n<p>See changelog for details.</p>\n</details>',
    state: 'open',
    isDraft: false,
    headBranch: 'dependabot/npm/expo-54.0.0',
    baseBranch: 'main',
    author: mockUsers.dependabot,
    labels: [],
    reviews: [],
    comments: [],
    commentCount: 0,
    reviewCount: 0,
    checks: [
      { id: 'check-007', name: 'Tests', status: 'in_progress' },
      { id: 'check-008', name: 'Lint', status: 'completed', conclusion: 'success' },
      { id: 'check-009', name: 'Build', status: 'pending' },
    ],
    checksStatus: 'pending',
    mergeable: true,
    mergeableState: 'unknown',
    additions: 234,
    deletions: 198,
    changedFiles: 3,
    createdAt: '2025-01-16T06:00:00Z',
    updatedAt: '2025-01-16T06:00:00Z',
    repositoryOwner: 'autoclaude',
    repositoryName: 'companion-app',
    htmlUrl: 'https://github.com/autoclaude/companion-app/pull/139',
  },
  {
    id: 'pr-004',
    number: 137,
    title: '[WIP] Add biometric authentication',
    body: '## Work in Progress\n\nAdding biometric auth support using expo-local-authentication.\n\n### TODO\n- [x] Basic Face ID / Touch ID flow\n- [ ] Fallback to passcode\n- [ ] Settings toggle\n- [ ] Error handling',
    state: 'open',
    isDraft: true,
    headBranch: 'feature/biometric-auth',
    baseBranch: 'main',
    author: mockUsers.charlie,
    labels: [mockLabels.feature, mockLabels.security],
    reviews: [],
    comments: [],
    commentCount: 1,
    reviewCount: 0,
    checks: [
      { id: 'check-010', name: 'Tests', status: 'completed', conclusion: 'success' },
      { id: 'check-011', name: 'Lint', status: 'completed', conclusion: 'success' },
      { id: 'check-012', name: 'Build', status: 'completed', conclusion: 'success' },
    ],
    checksStatus: 'success',
    mergeable: true,
    mergeableState: 'mergeable',
    additions: 312,
    deletions: 24,
    changedFiles: 9,
    createdAt: '2025-01-13T14:00:00Z',
    updatedAt: '2025-01-15T11:00:00Z',
    repositoryOwner: 'autoclaude',
    repositoryName: 'companion-app',
    htmlUrl: 'https://github.com/autoclaude/companion-app/pull/137',
  },
  {
    id: 'pr-005',
    number: 134,
    title: 'Implement WebSocket reconnection with exponential backoff',
    body: '## Summary\nFixes #135 by implementing proper reconnection logic for the WebSocket connection.\n\n## Changes\n- Added exponential backoff (1s, 2s, 4s, 8s, max 30s)\n- Connection status indicator in header\n- Auto-reconnect on app foreground',
    state: 'merged',
    isDraft: false,
    headBranch: 'fix/websocket-reconnect',
    baseBranch: 'main',
    author: mockUsers.alice,
    reviewers: [mockUsers.bob],
    labels: [mockLabels.bug],
    reviews: [
      {
        id: 'review-004',
        author: mockUsers.bob,
        state: 'approved',
        body: 'LGTM! Tested on both iOS and Android.',
        submittedAt: '2025-01-12T15:00:00Z',
      },
    ],
    comments: [],
    commentCount: 3,
    reviewCount: 1,
    checks: [
      { id: 'check-013', name: 'Tests', status: 'completed', conclusion: 'success' },
      { id: 'check-014', name: 'Lint', status: 'completed', conclusion: 'success' },
      { id: 'check-015', name: 'Build', status: 'completed', conclusion: 'success' },
    ],
    checksStatus: 'success',
    mergeable: false,
    mergeableState: 'mergeable',
    additions: 189,
    deletions: 67,
    changedFiles: 6,
    createdAt: '2025-01-11T09:00:00Z',
    updatedAt: '2025-01-12T16:00:00Z',
    mergedAt: '2025-01-12T16:00:00Z',
    repositoryOwner: 'autoclaude',
    repositoryName: 'companion-app',
    htmlUrl: 'https://github.com/autoclaude/companion-app/pull/134',
  },
  {
    id: 'pr-006',
    number: 130,
    title: 'refactor: Consolidate API client with proper error handling',
    body: '## Summary\nRefactors the API client to:\n- Centralize error handling\n- Add retry logic for transient failures\n- Improve TypeScript types\n- Add request/response logging in dev mode',
    state: 'merged',
    isDraft: false,
    headBranch: 'refactor/api-client',
    baseBranch: 'main',
    author: mockUsers.bob,
    reviewers: [mockUsers.alice, mockUsers.charlie],
    labels: [mockLabels.enhancement],
    reviews: [
      {
        id: 'review-005',
        author: mockUsers.alice,
        state: 'approved',
        submittedAt: '2025-01-09T14:00:00Z',
      },
      {
        id: 'review-006',
        author: mockUsers.charlie,
        state: 'approved',
        submittedAt: '2025-01-09T15:30:00Z',
      },
    ],
    comments: [],
    commentCount: 4,
    reviewCount: 2,
    checks: [
      { id: 'check-016', name: 'Tests', status: 'completed', conclusion: 'success' },
      { id: 'check-017', name: 'Lint', status: 'completed', conclusion: 'success' },
      { id: 'check-018', name: 'Build', status: 'completed', conclusion: 'success' },
    ],
    checksStatus: 'success',
    mergeable: false,
    mergeableState: 'mergeable',
    additions: 456,
    deletions: 312,
    changedFiles: 12,
    createdAt: '2025-01-08T11:00:00Z',
    updatedAt: '2025-01-09T16:00:00Z',
    mergedAt: '2025-01-09T16:00:00Z',
    repositoryOwner: 'autoclaude',
    repositoryName: 'companion-app',
    htmlUrl: 'https://github.com/autoclaude/companion-app/pull/130',
    linkedTaskId: 'task-006',
  },
];

/**
 * Mock repository
 */
const mockRepository: GitHubRepository = {
  id: 'repo-001',
  owner: 'autoclaude',
  name: 'companion-app',
  fullName: 'autoclaude/companion-app',
  description: 'Mobile companion app for AutoClaude',
  defaultBranch: 'main',
  isPrivate: false,
  htmlUrl: 'https://github.com/autoclaude/companion-app',
  openIssuesCount: 8,
  openPRsCount: 4,
};

/**
 * GitHub Store State Interface
 */
interface GitHubState {
  /** All issues in the store */
  issues: GitHubIssue[];

  /** All pull requests in the store */
  pullRequests: GitHubPR[];

  /** Currently selected issue ID */
  selectedIssueId: string | null;

  /** Currently selected PR ID */
  selectedPRId: string | null;

  /** Issue filters */
  issueFilters: IssueFilters;

  /** PR filters */
  prFilters: PRFilters;

  /** Repository info */
  repository: GitHubRepository | null;

  /** Integration status */
  integrationStatus: GitHubIntegrationStatus;

  /** Loading state */
  isLoading: boolean;

  /** Error message */
  error: string | null;

  /** Active tab (issues or prs) */
  activeTab: 'issues' | 'prs';
}

/**
 * GitHub Store Actions Interface
 */
interface GitHubActions {
  /** Select an issue */
  selectIssue: (id: string | null) => void;

  /** Select a PR */
  selectPR: (id: string | null) => void;

  /** Get issue by ID */
  getIssueById: (id: string) => GitHubIssue | undefined;

  /** Get PR by ID */
  getPRById: (id: string) => GitHubPR | undefined;

  /** Get issue by number */
  getIssueByNumber: (number: number) => GitHubIssue | undefined;

  /** Get PR by number */
  getPRByNumber: (number: number) => GitHubPR | undefined;

  /** Set issue filters */
  setIssueFilters: (filters: IssueFilters) => void;

  /** Clear issue filters */
  clearIssueFilters: () => void;

  /** Set PR filters */
  setPRFilters: (filters: PRFilters) => void;

  /** Clear PR filters */
  clearPRFilters: () => void;

  /** Get filtered issues */
  getFilteredIssues: () => GitHubIssue[];

  /** Get filtered PRs */
  getFilteredPRs: () => GitHubPR[];

  /** Set active tab */
  setActiveTab: (tab: 'issues' | 'prs') => void;

  /** Trigger investigation on issue */
  investigateIssue: (id: string) => void;

  /** Stop investigation on issue */
  stopInvestigation: (id: string) => void;

  /** Trigger auto-fix on issue */
  autoFixIssue: (id: string) => void;

  /** Stop auto-fix on issue */
  stopAutoFix: (id: string) => void;

  /** Trigger investigation on PR */
  investigatePR: (id: string) => void;

  /** Stop investigation on PR */
  stopPRInvestigation: (id: string) => void;

  /** Update issue */
  updateIssue: (id: string, updates: Partial<GitHubIssue>) => void;

  /** Update PR */
  updatePR: (id: string, updates: Partial<GitHubPR>) => void;

  /** Set loading state */
  setLoading: (loading: boolean) => void;

  /** Set error */
  setError: (error: string | null) => void;

  /** Reset store */
  resetStore: () => void;

  /** Get issue counts by state */
  getIssueCounts: () => Record<IssueState, number>;

  /** Get PR counts by state */
  getPRCounts: () => Record<PRState, number>;
}

/**
 * Combined GitHub Store Type
 */
type GitHubStore = GitHubState & GitHubActions;

/**
 * Initial state
 */
const initialState: GitHubState = {
  issues: mockIssues,
  pullRequests: mockPRs,
  selectedIssueId: null,
  selectedPRId: null,
  issueFilters: {},
  prFilters: {},
  repository: mockRepository,
  integrationStatus: {
    isConnected: true,
    username: 'autoclaude-user',
    avatarUrl: 'https://api.dicebear.com/7.x/avataaars/svg?seed=user',
    repositories: [mockRepository],
    lastSyncAt: new Date().toISOString(),
  },
  isLoading: false,
  error: null,
  activeTab: 'issues',
};

/**
 * GitHub Store
 */
export const useGitHubStore = create<GitHubStore>()(
  persist(
    (set, get) => ({
      ...initialState,

      selectIssue: (id: string | null): void => {
        set({ selectedIssueId: id });
      },

      selectPR: (id: string | null): void => {
        set({ selectedPRId: id });
      },

      getIssueById: (id: string): GitHubIssue | undefined => {
        return get().issues.find((issue) => issue.id === id);
      },

      getPRById: (id: string): GitHubPR | undefined => {
        return get().pullRequests.find((pr) => pr.id === id);
      },

      getIssueByNumber: (number: number): GitHubIssue | undefined => {
        return get().issues.find((issue) => issue.number === number);
      },

      getPRByNumber: (number: number): GitHubPR | undefined => {
        return get().pullRequests.find((pr) => pr.number === number);
      },

      setIssueFilters: (filters: IssueFilters): void => {
        set({ issueFilters: filters });
      },

      clearIssueFilters: (): void => {
        set({ issueFilters: {} });
      },

      setPRFilters: (filters: PRFilters): void => {
        set({ prFilters: filters });
      },

      clearPRFilters: (): void => {
        set({ prFilters: {} });
      },

      getFilteredIssues: (): GitHubIssue[] => {
        const { issues, issueFilters } = get();

        return issues.filter((issue) => {
          // State filter
          if (issueFilters.state && issueFilters.state.length > 0) {
            if (!issueFilters.state.includes(issue.state)) return false;
          }

          // Labels filter
          if (issueFilters.labels && issueFilters.labels.length > 0) {
            const issueLabels = issue.labels.map((l) => l.name);
            if (!issueFilters.labels.some((l) => issueLabels.includes(l))) {
              return false;
            }
          }

          // Assignee filter
          if (issueFilters.assignee) {
            const hasAssignee = issue.assignees?.some(
              (a) => a.login === issueFilters.assignee
            );
            if (!hasAssignee) return false;
          }

          // Author filter
          if (issueFilters.author) {
            if (issue.author.login !== issueFilters.author) return false;
          }

          // Search filter
          if (issueFilters.search) {
            const searchLower = issueFilters.search.toLowerCase();
            const matchesTitle = issue.title.toLowerCase().includes(searchLower);
            const matchesBody = issue.body.toLowerCase().includes(searchLower);
            const matchesLabels = issue.labels.some((l) =>
              l.name.toLowerCase().includes(searchLower)
            );
            if (!matchesTitle && !matchesBody && !matchesLabels) return false;
          }

          return true;
        });
      },

      getFilteredPRs: (): GitHubPR[] => {
        const { pullRequests, prFilters } = get();

        return pullRequests.filter((pr) => {
          // State filter
          if (prFilters.state && prFilters.state.length > 0) {
            if (!prFilters.state.includes(pr.state)) return false;
          }

          // Labels filter
          if (prFilters.labels && prFilters.labels.length > 0) {
            const prLabels = pr.labels.map((l) => l.name);
            if (!prFilters.labels.some((l) => prLabels.includes(l))) {
              return false;
            }
          }

          // Author filter
          if (prFilters.author) {
            if (pr.author.login !== prFilters.author) return false;
          }

          // Draft filter
          if (prFilters.isDraft !== undefined) {
            if (pr.isDraft !== prFilters.isDraft) return false;
          }

          // Search filter
          if (prFilters.search) {
            const searchLower = prFilters.search.toLowerCase();
            const matchesTitle = pr.title.toLowerCase().includes(searchLower);
            const matchesBody = pr.body.toLowerCase().includes(searchLower);
            const matchesLabels = pr.labels.some((l) =>
              l.name.toLowerCase().includes(searchLower)
            );
            const matchesBranch =
              pr.headBranch.toLowerCase().includes(searchLower) ||
              pr.baseBranch.toLowerCase().includes(searchLower);
            if (!matchesTitle && !matchesBody && !matchesLabels && !matchesBranch) {
              return false;
            }
          }

          return true;
        });
      },

      setActiveTab: (tab: 'issues' | 'prs'): void => {
        set({ activeTab: tab });
      },

      investigateIssue: (id: string): void => {
        set((state) => ({
          issues: state.issues.map((issue) =>
            issue.id === id
              ? { ...issue, isInvestigating: true, updatedAt: new Date().toISOString() }
              : issue
          ),
        }));
      },

      stopInvestigation: (id: string): void => {
        set((state) => ({
          issues: state.issues.map((issue) =>
            issue.id === id
              ? { ...issue, isInvestigating: false, updatedAt: new Date().toISOString() }
              : issue
          ),
        }));
      },

      autoFixIssue: (id: string): void => {
        set((state) => ({
          issues: state.issues.map((issue) =>
            issue.id === id
              ? { ...issue, isAutoFixing: true, updatedAt: new Date().toISOString() }
              : issue
          ),
        }));
      },

      stopAutoFix: (id: string): void => {
        set((state) => ({
          issues: state.issues.map((issue) =>
            issue.id === id
              ? { ...issue, isAutoFixing: false, updatedAt: new Date().toISOString() }
              : issue
          ),
        }));
      },

      investigatePR: (id: string): void => {
        set((state) => ({
          pullRequests: state.pullRequests.map((pr) =>
            pr.id === id
              ? { ...pr, isInvestigating: true, updatedAt: new Date().toISOString() }
              : pr
          ),
        }));
      },

      stopPRInvestigation: (id: string): void => {
        set((state) => ({
          pullRequests: state.pullRequests.map((pr) =>
            pr.id === id
              ? { ...pr, isInvestigating: false, updatedAt: new Date().toISOString() }
              : pr
          ),
        }));
      },

      updateIssue: (id: string, updates: Partial<GitHubIssue>): void => {
        set((state) => ({
          issues: state.issues.map((issue) =>
            issue.id === id
              ? { ...issue, ...updates, updatedAt: new Date().toISOString() }
              : issue
          ),
        }));
      },

      updatePR: (id: string, updates: Partial<GitHubPR>): void => {
        set((state) => ({
          pullRequests: state.pullRequests.map((pr) =>
            pr.id === id
              ? { ...pr, ...updates, updatedAt: new Date().toISOString() }
              : pr
          ),
        }));
      },

      setLoading: (loading: boolean): void => {
        set({ isLoading: loading });
      },

      setError: (error: string | null): void => {
        set({ error });
      },

      resetStore: (): void => {
        set(initialState);
      },

      getIssueCounts: (): Record<IssueState, number> => {
        const issues = get().issues;
        return {
          open: issues.filter((i) => i.state === 'open').length,
          closed: issues.filter((i) => i.state === 'closed').length,
        };
      },

      getPRCounts: (): Record<PRState, number> => {
        const prs = get().pullRequests;
        return {
          open: prs.filter((p) => p.state === 'open').length,
          closed: prs.filter((p) => p.state === 'closed').length,
          merged: prs.filter((p) => p.state === 'merged').length,
        };
      },
    }),
    {
      name: 'autoclaude-github-storage',
      storage: createJSONStorage(() => AsyncStorage),
      partialize: (state) => ({
        issueFilters: state.issueFilters,
        prFilters: state.prFilters,
        activeTab: state.activeTab,
      }),
    }
  )
);

/**
 * Selector hooks
 */

/** Get the currently selected issue */
export const useSelectedIssue = (): GitHubIssue | undefined => {
  const { issues, selectedIssueId } = useGitHubStore();
  return issues.find((issue) => issue.id === selectedIssueId);
};

/** Get the currently selected PR */
export const useSelectedPR = (): GitHubPR | undefined => {
  const { pullRequests, selectedPRId } = useGitHubStore();
  return pullRequests.find((pr) => pr.id === selectedPRId);
};

/** Get open issue count */
export const useOpenIssueCount = (): number => {
  return useGitHubStore((state) => state.issues.filter((i) => i.state === 'open').length);
};

/** Get open PR count */
export const useOpenPRCount = (): number => {
  return useGitHubStore(
    (state) => state.pullRequests.filter((p) => p.state === 'open').length
  );
};

/** Get total issue count */
export const useTotalIssueCount = (): number => {
  return useGitHubStore((state) => state.issues.length);
};

/** Get total PR count */
export const useTotalPRCount = (): number => {
  return useGitHubStore((state) => state.pullRequests.length);
};

/** Get active tab */
export const useActiveTab = (): 'issues' | 'prs' => {
  return useGitHubStore((state) => state.activeTab);
};

/** Get integration status */
export const useGitHubIntegrationStatus = (): GitHubIntegrationStatus => {
  return useGitHubStore((state) => state.integrationStatus);
};
