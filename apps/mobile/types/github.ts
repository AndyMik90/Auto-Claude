/**
 * GitHub Types
 * Defines types for GitHub issues and pull requests
 */

/**
 * GitHub issue state
 */
export type IssueState = 'open' | 'closed';

/**
 * GitHub PR state
 */
export type PRState = 'open' | 'closed' | 'merged';

/**
 * GitHub PR review state
 */
export type PRReviewState =
  | 'pending'
  | 'approved'
  | 'changes_requested'
  | 'commented'
  | 'dismissed';

/**
 * GitHub label
 */
export interface GitHubLabel {
  id: string;
  name: string;
  color: string;
  description?: string;
}

/**
 * GitHub user
 */
export interface GitHubUser {
  id: string;
  login: string;
  avatarUrl?: string;
  type: 'user' | 'bot' | 'organization';
}

/**
 * GitHub milestone
 */
export interface GitHubMilestone {
  id: string;
  number: number;
  title: string;
  description?: string;
  state: 'open' | 'closed';
  dueDate?: string;
  progress: number; // 0-100 based on open/closed issues
}

/**
 * GitHub comment
 */
export interface GitHubComment {
  id: string;
  author: GitHubUser;
  body: string;
  createdAt: string;
  updatedAt: string;
}

/**
 * GitHub issue
 */
export interface GitHubIssue {
  id: string;
  number: number;
  title: string;
  body: string;
  state: IssueState;

  // Participants
  author: GitHubUser;
  assignees?: GitHubUser[];

  // Labels and milestone
  labels: GitHubLabel[];
  milestone?: GitHubMilestone;

  // Comments
  comments: GitHubComment[];
  commentCount: number;

  // Timestamps
  createdAt: string;
  updatedAt: string;
  closedAt?: string;

  // Repository info
  repositoryOwner: string;
  repositoryName: string;

  // URLs
  htmlUrl: string;

  // AutoClaude actions
  isInvestigating?: boolean;
  isAutoFixing?: boolean;
  linkedTaskId?: string;
}

/**
 * GitHub PR review
 */
export interface PRReview {
  id: string;
  author: GitHubUser;
  state: PRReviewState;
  body?: string;
  submittedAt: string;
}

/**
 * GitHub PR check status
 */
export interface PRCheck {
  id: string;
  name: string;
  status: 'pending' | 'in_progress' | 'completed';
  conclusion?: 'success' | 'failure' | 'neutral' | 'cancelled' | 'skipped' | 'timed_out';
  detailsUrl?: string;
}

/**
 * GitHub pull request
 */
export interface GitHubPR {
  id: string;
  number: number;
  title: string;
  body: string;
  state: PRState;
  isDraft: boolean;

  // Branch info
  headBranch: string;
  baseBranch: string;

  // Participants
  author: GitHubUser;
  assignees?: GitHubUser[];
  reviewers?: GitHubUser[];

  // Labels and milestone
  labels: GitHubLabel[];
  milestone?: GitHubMilestone;

  // Reviews and comments
  reviews: PRReview[];
  comments: GitHubComment[];
  commentCount: number;
  reviewCount: number;

  // Checks
  checks: PRCheck[];
  checksStatus: 'pending' | 'success' | 'failure' | 'neutral';

  // Merge info
  mergeable: boolean;
  mergeableState: 'mergeable' | 'conflicting' | 'unknown';
  additions: number;
  deletions: number;
  changedFiles: number;

  // Timestamps
  createdAt: string;
  updatedAt: string;
  closedAt?: string;
  mergedAt?: string;

  // Repository info
  repositoryOwner: string;
  repositoryName: string;

  // URLs
  htmlUrl: string;

  // AutoClaude actions
  isInvestigating?: boolean;
  isAutoFixing?: boolean;
  linkedTaskId?: string;
}

/**
 * GitHub action trigger request
 */
export interface GitHubActionRequest {
  type: 'investigate' | 'auto_fix' | 'create_task';
  issueId?: string;
  prId?: string;
  options?: Record<string, unknown>;
}

/**
 * GitHub filter options for issues
 */
export interface IssueFilters {
  state?: IssueState[];
  labels?: string[];
  assignee?: string;
  author?: string;
  milestone?: string;
  search?: string;
}

/**
 * GitHub filter options for PRs
 */
export interface PRFilters {
  state?: PRState[];
  labels?: string[];
  author?: string;
  reviewState?: PRReviewState[];
  isDraft?: boolean;
  search?: string;
}

/**
 * GitHub repository summary
 */
export interface GitHubRepository {
  id: string;
  owner: string;
  name: string;
  fullName: string;
  description?: string;
  defaultBranch: string;
  isPrivate: boolean;
  htmlUrl: string;
  openIssuesCount: number;
  openPRsCount: number;
}

/**
 * GitHub integration status
 */
export interface GitHubIntegrationStatus {
  isConnected: boolean;
  username?: string;
  avatarUrl?: string;
  repositories?: GitHubRepository[];
  lastSyncAt?: string;
  error?: string;
}
