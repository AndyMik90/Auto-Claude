/**
 * IPC (Inter-Process Communication) types for Electron API
 */

import type { IPCResult } from './common';
import type {
  Project,
  ProjectSettings,
  AutoBuildVersionInfo,
  InitializationResult,
  CreateProjectFolderResult,
  FileNode,
  ProjectContextData,
  ProjectIndex,
  GraphitiMemoryStatus,
  ContextSearchResult,
  MemoryEpisode,
  ProjectEnvConfig,
  InfrastructureStatus,
  GraphitiValidationResult,
  GraphitiConnectionTestResult,
  GitStatus
} from './project';
import type {
  Task,
  TaskStatus,
  TaskStartOptions,
  ImplementationPlan,
  ExecutionProgress,
  WorktreeStatus,
  WorktreeDiff,
  WorktreeMergeResult,
  WorktreeDiscardResult,
  WorktreeListResult,
  TaskRecoveryResult,
  TaskRecoveryOptions,
  TaskMetadata,
  TaskLogs,
  TaskLogStreamChunk
} from './task';
import type {
  TerminalCreateOptions,
  TerminalSession,
  TerminalRestoreResult,
  SessionDateInfo,
  SessionDateRestoreResult,
  RateLimitInfo,
  SDKRateLimitInfo,
  RetryWithProfileRequest
} from './terminal';
import type {
  ClaudeProfileSettings,
  ClaudeProfile,
  ClaudeAutoSwitchSettings,
  ClaudeAuthResult,
  ClaudeUsageSnapshot
} from './agent';
import type { AppSettings, SourceEnvConfig, SourceEnvCheckResult, AutoBuildSourceUpdateCheck, AutoBuildSourceUpdateProgress } from './settings';
import type { AppUpdateInfo, AppUpdateProgress, AppUpdateAvailableEvent, AppUpdateDownloadedEvent } from './app-update';
import type {
  ChangelogTask,
  TaskSpecContent,
  ChangelogGenerationRequest,
  ChangelogGenerationResult,
  ChangelogSaveRequest,
  ChangelogSaveResult,
  ChangelogGenerationProgress,
  ExistingChangelog,
  GitBranchInfo,
  GitTagInfo,
  GitCommit,
  GitHistoryOptions,
  BranchDiffOptions,
  ReleaseableVersion,
  ReleasePreflightStatus,
  CreateReleaseRequest,
  CreateReleaseResult,
  ReleaseProgress
} from './changelog';
import type {
  IdeationSession,
  IdeationConfig,
  IdeationStatus,
  IdeationGenerationStatus,
  Idea,
  InsightsSession,
  InsightsSessionSummary,
  InsightsChatStatus,
  InsightsStreamChunk,
  InsightsModelConfig
} from './insights';
import type {
  Roadmap,
  RoadmapFeatureStatus,
  RoadmapGenerationStatus
} from './roadmap';
import type {
  LinearTeam,
  LinearProject,
  LinearIssue,
  LinearImportResult,
  LinearSyncStatus,
  GitHubRepository,
  GitHubIssue,
  GitHubSyncStatus,
  GitHubImportResult,
  GitHubInvestigationResult,
  GitHubInvestigationStatus,
  ForkStatusResult
} from './integrations';

// Electron API exposed via contextBridge
// Tab state interface (persisted in main process)
export interface TabState {
  openProjectIds: string[];
  activeProjectId: string | null;
  tabOrder: string[];
}

export interface ElectronAPI {
  // Project operations
  addProject: (projectPath: string) => Promise<IPCResult<Project>>;
  removeProject: (projectId: string) => Promise<IPCResult>;
  getProjects: () => Promise<IPCResult<Project[]>>;
  updateProjectSettings: (projectId: string, settings: Partial<ProjectSettings>) => Promise<IPCResult>;
  initializeProject: (projectId: string) => Promise<IPCResult<InitializationResult>>;
  updateProjectAutoBuild: (projectId: string) => Promise<IPCResult<InitializationResult>>;
  checkProjectVersion: (projectId: string) => Promise<IPCResult<AutoBuildVersionInfo>>;

  // Tab State (persisted in main process for reliability)
  getTabState: () => Promise<IPCResult<TabState>>;
  saveTabState: (tabState: TabState) => Promise<IPCResult>;

  // Task operations
  getTasks: (projectId: string) => Promise<IPCResult<Task[]>>;
  createTask: (projectId: string, title: string, description: string, metadata?: TaskMetadata) => Promise<IPCResult<Task>>;
  deleteTask: (taskId: string) => Promise<IPCResult>;
  updateTask: (taskId: string, updates: { title?: string; description?: string }) => Promise<IPCResult<Task>>;
  startTask: (taskId: string, options?: TaskStartOptions) => void;
  stopTask: (taskId: string) => void;
  submitReview: (taskId: string, approved: boolean, feedback?: string) => Promise<IPCResult>;
  updateTaskStatus: (taskId: string, status: TaskStatus) => Promise<IPCResult>;
  recoverStuckTask: (taskId: string, options?: TaskRecoveryOptions) => Promise<IPCResult<TaskRecoveryResult>>;
  checkTaskRunning: (taskId: string) => Promise<IPCResult<boolean>>;

  // Workspace management (for human review)
  // Per-spec architecture: Each spec has its own worktree at .worktrees/{spec-name}/
  getWorktreeStatus: (taskId: string) => Promise<IPCResult<WorktreeStatus>>;
  getWorktreeDiff: (taskId: string) => Promise<IPCResult<WorktreeDiff>>;
  mergeWorktree: (taskId: string, options?: { noCommit?: boolean }) => Promise<IPCResult<WorktreeMergeResult>>;
  mergeWorktreePreview: (taskId: string) => Promise<IPCResult<WorktreeMergeResult>>;
  discardWorktree: (taskId: string) => Promise<IPCResult<WorktreeDiscardResult>>;
  listWorktrees: (projectId: string) => Promise<IPCResult<WorktreeListResult>>;

  // Task archive operations
  archiveTasks: (projectId: string, taskIds: string[], version?: string) => Promise<IPCResult<boolean>>;
  unarchiveTasks: (projectId: string, taskIds: string[]) => Promise<IPCResult<boolean>>;

  // Event listeners
  onTaskProgress: (callback: (taskId: string, plan: ImplementationPlan) => void) => () => void;
  onTaskError: (callback: (taskId: string, error: string) => void) => () => void;
  onTaskLog: (callback: (taskId: string, log: string) => void) => () => void;
  onTaskStatusChange: (callback: (taskId: string, status: TaskStatus) => void) => () => void;
  onTaskExecutionProgress: (callback: (taskId: string, progress: ExecutionProgress) => void) => () => void;

  // Terminal operations
  createTerminal: (options: TerminalCreateOptions) => Promise<IPCResult>;
  destroyTerminal: (id: string) => Promise<IPCResult>;
  sendTerminalInput: (id: string, data: string) => void;
  resizeTerminal: (id: string, cols: number, rows: number) => void;
  invokeClaudeInTerminal: (id: string, cwd?: string) => void;
  generateTerminalName: (command: string, cwd?: string) => Promise<IPCResult<string>>;

  // Terminal session management (persistence/restore)
  getTerminalSessions: (projectPath: string) => Promise<IPCResult<TerminalSession[]>>;
  restoreTerminalSession: (session: TerminalSession, cols?: number, rows?: number) => Promise<IPCResult<TerminalRestoreResult>>;
  clearTerminalSessions: (projectPath: string) => Promise<IPCResult>;
  resumeClaudeInTerminal: (id: string, sessionId?: string) => void;
  getTerminalSessionDates: (projectPath?: string) => Promise<IPCResult<SessionDateInfo[]>>;
  getTerminalSessionsForDate: (date: string, projectPath: string) => Promise<IPCResult<TerminalSession[]>>;
  restoreTerminalSessionsFromDate: (date: string, projectPath: string, cols?: number, rows?: number) => Promise<IPCResult<SessionDateRestoreResult>>;
  saveTerminalBuffer: (terminalId: string, serialized: string) => Promise<void>;

  // Terminal event listeners
  onTerminalOutput: (callback: (id: string, data: string) => void) => () => void;
  onTerminalExit: (callback: (id: string, exitCode: number) => void) => () => void;
  onTerminalTitleChange: (callback: (id: string, title: string) => void) => () => void;
  onTerminalClaudeSession: (callback: (id: string, sessionId: string) => void) => () => void;
  onTerminalRateLimit: (callback: (info: RateLimitInfo) => void) => () => void;
  /** Listen for OAuth authentication completion (token is auto-saved to profile, never exposed to frontend) */
  onTerminalOAuthToken: (callback: (info: {
    terminalId: string;
    profileId?: string;
    email?: string;
    success: boolean;
    message?: string;
    detectedAt: string
  }) => void) => () => void;

  // Claude profile management (multi-account support)
  getClaudeProfiles: () => Promise<IPCResult<ClaudeProfileSettings>>;
  saveClaudeProfile: (profile: ClaudeProfile) => Promise<IPCResult<ClaudeProfile>>;
  deleteClaudeProfile: (profileId: string) => Promise<IPCResult>;
  renameClaudeProfile: (profileId: string, newName: string) => Promise<IPCResult>;
  setActiveClaudeProfile: (profileId: string) => Promise<IPCResult>;
  /** Switch terminal to use a different Claude profile (restarts Claude with new config) */
  switchClaudeProfile: (terminalId: string, profileId: string) => Promise<IPCResult>;
  /** Initialize authentication for a Claude profile */
  initializeClaudeProfile: (profileId: string) => Promise<IPCResult>;
  /** Set OAuth token for a profile (used when capturing from terminal) */
  setClaudeProfileToken: (profileId: string, token: string, email?: string) => Promise<IPCResult>;
  /** Get auto-switch settings */
  getAutoSwitchSettings: () => Promise<IPCResult<ClaudeAutoSwitchSettings>>;
  /** Update auto-switch settings */
  updateAutoSwitchSettings: (settings: Partial<ClaudeAutoSwitchSettings>) => Promise<IPCResult>;
  /** Request usage fetch from a terminal (sends /usage command) */
  fetchClaudeUsage: (terminalId: string) => Promise<IPCResult>;
  /** Get the best available profile (for manual switching) */
  getBestAvailableProfile: (excludeProfileId?: string) => Promise<IPCResult<ClaudeProfile | null>>;
  /** Listen for SDK/CLI rate limit events (non-terminal) */
  onSDKRateLimit: (callback: (info: SDKRateLimitInfo) => void) => () => void;
  /** Retry a rate-limited operation with a different profile */
  retryWithProfile: (request: RetryWithProfileRequest) => Promise<IPCResult>;

  // Usage Monitoring (Proactive Account Switching)
  /** Request current usage snapshot */
  requestUsageUpdate: () => Promise<IPCResult<ClaudeUsageSnapshot | null>>;
  /** Listen for usage data updates */
  onUsageUpdated: (callback: (usage: ClaudeUsageSnapshot) => void) => () => void;
  /** Listen for proactive swap notifications */
  onProactiveSwapNotification: (callback: (notification: {
    fromProfile: { id: string; name: string };
    toProfile: { id: string; name: string };
    reason: string;
    usageSnapshot: ClaudeUsageSnapshot;
  }) => void) => () => void;

  // App settings
  getSettings: () => Promise<IPCResult<AppSettings>>;
  saveSettings: (settings: Partial<AppSettings>) => Promise<IPCResult>;
  getCliToolsInfo: () => Promise<IPCResult<{
    python: import('./cli').ToolDetectionResult;
    git: import('./cli').ToolDetectionResult;
    gh: import('./cli').ToolDetectionResult;
  }>>;

  // Dialog operations
  selectDirectory: () => Promise<string | null>;
  createProjectFolder: (location: string, name: string, initGit: boolean) => Promise<IPCResult<CreateProjectFolderResult>>;
  getDefaultProjectLocation: () => Promise<string | null>;

  // App info
  getAppVersion: () => Promise<string>;

  // Roadmap operations
  getRoadmap: (projectId: string) => Promise<IPCResult<Roadmap | null>>;
  getRoadmapStatus: (projectId: string) => Promise<IPCResult<{ isRunning: boolean }>>;
  saveRoadmap: (projectId: string, roadmap: Roadmap) => Promise<IPCResult>;
  generateRoadmap: (projectId: string, enableCompetitorAnalysis?: boolean, refreshCompetitorAnalysis?: boolean) => void;
  refreshRoadmap: (projectId: string, enableCompetitorAnalysis?: boolean, refreshCompetitorAnalysis?: boolean) => void;
  stopRoadmap: (projectId: string) => Promise<IPCResult>;
  updateFeatureStatus: (
    projectId: string,
    featureId: string,
    status: RoadmapFeatureStatus
  ) => Promise<IPCResult>;
  convertFeatureToSpec: (
    projectId: string,
    featureId: string
  ) => Promise<IPCResult<Task>>;

  // Roadmap event listeners
  onRoadmapProgress: (
    callback: (projectId: string, status: RoadmapGenerationStatus) => void
  ) => () => void;
  onRoadmapComplete: (
    callback: (projectId: string, roadmap: Roadmap) => void
  ) => () => void;
  onRoadmapError: (
    callback: (projectId: string, error: string) => void
  ) => () => void;
  onRoadmapStopped: (
    callback: (projectId: string) => void
  ) => () => void;

  // Context operations
  getProjectContext: (projectId: string) => Promise<IPCResult<ProjectContextData>>;
  refreshProjectIndex: (projectId: string) => Promise<IPCResult<ProjectIndex>>;
  getMemoryStatus: (projectId: string) => Promise<IPCResult<GraphitiMemoryStatus>>;
  searchMemories: (projectId: string, query: string) => Promise<IPCResult<ContextSearchResult[]>>;
  getRecentMemories: (projectId: string, limit?: number) => Promise<IPCResult<MemoryEpisode[]>>;

  // Environment configuration operations
  getProjectEnv: (projectId: string) => Promise<IPCResult<ProjectEnvConfig>>;
  updateProjectEnv: (projectId: string, config: Partial<ProjectEnvConfig>) => Promise<IPCResult>;
  checkClaudeAuth: (projectId: string) => Promise<IPCResult<ClaudeAuthResult>>;
  invokeClaudeSetup: (projectId: string) => Promise<IPCResult<ClaudeAuthResult>>;

  // Memory Infrastructure operations (LadybugDB - no Docker required)
  getMemoryInfrastructureStatus: (dbPath?: string) => Promise<IPCResult<InfrastructureStatus>>;
  listMemoryDatabases: (dbPath?: string) => Promise<IPCResult<string[]>>;
  testMemoryConnection: (dbPath?: string, database?: string) => Promise<IPCResult<GraphitiValidationResult>>;

  // Graphiti validation operations
  validateLLMApiKey: (provider: string, apiKey: string) => Promise<IPCResult<GraphitiValidationResult>>;
  testGraphitiConnection: (config: {
    dbPath?: string;
    database?: string;
    llmProvider: string;
    apiKey: string;
  }) => Promise<IPCResult<GraphitiConnectionTestResult>>;

  // Linear integration operations
  getLinearTeams: (projectId: string) => Promise<IPCResult<LinearTeam[]>>;
  getLinearProjects: (projectId: string, teamId: string) => Promise<IPCResult<LinearProject[]>>;
  getLinearIssues: (projectId: string, teamId?: string, projectId_?: string) => Promise<IPCResult<LinearIssue[]>>;
  importLinearIssues: (projectId: string, issueIds: string[]) => Promise<IPCResult<LinearImportResult>>;
  checkLinearConnection: (projectId: string) => Promise<IPCResult<LinearSyncStatus>>;

  // GitHub integration operations
  getGitHubRepositories: (projectId: string) => Promise<IPCResult<GitHubRepository[]>>;
  getGitHubIssues: (projectId: string, state?: 'open' | 'closed' | 'all') => Promise<IPCResult<GitHubIssue[]>>;
  getGitHubIssue: (projectId: string, issueNumber: number) => Promise<IPCResult<GitHubIssue>>;
  checkGitHubConnection: (projectId: string) => Promise<IPCResult<GitHubSyncStatus>>;
  investigateGitHubIssue: (projectId: string, issueNumber: number, selectedCommentIds?: number[]) => void;
  getIssueComments: (projectId: string, issueNumber: number) => Promise<IPCResult<Array<{ id: number; body: string; user: { login: string; avatar_url?: string }; created_at: string; updated_at: string }>>>;
  importGitHubIssues: (projectId: string, issueNumbers: number[]) => Promise<IPCResult<GitHubImportResult>>;
  createGitHubRelease: (
    projectId: string,
    version: string,
    releaseNotes: string,
    options?: { draft?: boolean; prerelease?: boolean }
  ) => Promise<IPCResult<{ url: string }>>;
  forkRepository: (projectId: string, owner: string, repo: string, newName?: string) => void;
  getForkStatus: (projectId: string) => Promise<IPCResult<ForkStatusResult>>;

  // GitHub OAuth operations (gh CLI)
  checkGitHubCli: () => Promise<IPCResult<{ installed: boolean; version?: string }>>;
  checkGitHubAuth: () => Promise<IPCResult<{ authenticated: boolean; username?: string }>>;
  startGitHubAuth: () => Promise<IPCResult<{ success: boolean; message?: string }>>;

  // GitHub investigation event listeners
  onGitHubInvestigationProgress: (callback: (projectId: string, status: GitHubInvestigationStatus) => void) => () => void;
  onGitHubInvestigationComplete: (callback: (projectId: string, result: GitHubInvestigationResult) => void) => () => void;
  onGitHubInvestigationError: (callback: (projectId: string, error: string) => void) => () => void;
  onForkProgress: (callback: (projectId: string, status: ForkStatusResult) => void) => () => void;

  // App update operations
  onAppUpdateAvailable: (callback: (info: AppUpdateInfo) => void) => () => void;
  onAppUpdateProgress: (callback: (progress: AppUpdateProgress) => void) => () => void;
  onAppUpdateDownloaded: (callback: (info: AppUpdateDownloadedEvent) => void) => () => void;
  installAppUpdate: () => void;

  // Changelog operations
  generateChangelog: (projectId: string, request: ChangelogGenerationRequest) => void;
  saveChangelog: (projectId: string, request: ChangelogSaveRequest) => Promise<IPCResult<ChangelogSaveResult>>;
  getExistingChangelogs: (projectId: string) => Promise<IPCResult<ExistingChangelog[]>>;
  loadExistingChangelog: (projectId: string, path: string) => Promise<IPCResult<ChangelogTask>>;
  stopChangelogGeneration: (projectId: string) => Promise<IPCResult>;
  validateRelease: (projectId: string, version: string) => Promise<IPCResult<ReleasePreflightStatus>>;
  getGitHistory: (projectId: string, options: GitHistoryOptions) => Promise<IPCResult<GitCommit[]>>;
  createRelease: (projectId: string, request: CreateReleaseRequest) => void;
  getReleaseHistory: (projectId: string) => Promise<IPCResult<ExistingChangelog[]>>;

  // Changelog event listeners
  onChangelogGenerationProgress: (callback: (projectId: string, progress: ChangelogGenerationProgress) => void) => () => void;
  onChangelogGenerationComplete: (callback: (projectId: string, result: ChangelogGenerationResult) => void) => () => void;
  onChangelogGenerationError: (callback: (projectId: string, error: string) => void) => () => void;
  onReleaseProgress: (callback: (projectId: string, progress: ReleaseProgress) => void) => () => void;
  onReleaseComplete: (callback: (projectId: string, result: CreateReleaseResult) => void) => () => void;
  onReleaseError: (callback: (projectId: string, error: string) => void) => () => void;

  // Insights/Ideation operations
  startIdeationSession: (projectId: string, config: IdeationConfig) => void;
  stopIdeationSession: (projectId: string) => Promise<IPCResult>;
  addIdeationInput: (projectId: string, input: string) => void;
  startInsightsSession: (projectId: string, config: { ideas: Idea[] }) => void;
  stopInsightsSession: (projectId: string) => Promise<IPCResult>;
  sendInsightsMessage: (projectId: string, message: string) => void;

  // Insights/Ideation event listeners
  onIdeationSessionStart: (callback: (projectId: string, session: IdeationSession) => void) => () => void;
  onIdeationGenerationProgress: (callback: (projectId: string, status: IdeationGenerationStatus) => void) => () => void;
  onIdeationSessionEnd: (callback: (projectId: string, ideas: Idea[]) => void) => () => void;
  onIdeationError: (callback: (projectId: string, error: string) => void) => () => void;
  onInsightsSessionStart: (callback: (projectId: string, session: InsightsSession) => void) => () => void;
  onInsightsChatProgress: (callback: (projectId: string, status: InsightsChatStatus) => void) => () => void;
  onInsightsStreamChunk: (callback: (projectId: string, chunk: InsightsStreamChunk) => void) => () => void;
  onInsightsSessionEnd: (callback: (projectId: string, summary: InsightsSessionSummary) => void) => () => void;
  onInsightsError: (callback: (projectId: string, error: string) => void) => () => void;
}