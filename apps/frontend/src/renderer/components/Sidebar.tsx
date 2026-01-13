import { useState, useEffect, useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import {
  Plus,
  Settings,
  Trash2,
  LayoutGrid,
  Terminal,
  Map,
  BookOpen,
  Lightbulb,
  AlertCircle,
  Github,
  GitlabIcon,
  GitPullRequest,
  GitMerge,
  FileText,
  Sparkles,
  GitBranch,
  HelpCircle,
  Wrench
} from 'lucide-react';
import { Button } from './ui/button';
import { ScrollArea } from './ui/scroll-area';
import { Separator } from './ui/separator';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger
} from './ui/tooltip';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle
} from './ui/dialog';
import { cn } from '../lib/utils';
import {
  useProjectStore,
  removeProject
} from '../stores/project-store';
import { useSettingsStore } from '../stores/settings-store';
import { ProjectWizard } from './project-wizard/ProjectWizard';
import { GitSetupModal } from './GitSetupModal';
import { RateLimitIndicator } from './RateLimitIndicator';
import { ClaudeCodeStatusBadge } from './ClaudeCodeStatusBadge';
import type { Project, AutoBuildVersionInfo, GitStatus, ProjectEnvConfig } from '../../shared/types';

export type SidebarView = 'kanban' | 'terminals' | 'roadmap' | 'context' | 'ideation' | 'github-issues' | 'gitlab-issues' | 'github-prs' | 'gitlab-merge-requests' | 'changelog' | 'insights' | 'worktrees' | 'agent-tools';

interface SidebarProps {
  onSettingsClick: () => void;
  onNewTaskClick: () => void;
  activeView?: SidebarView;
  onViewChange?: (view: SidebarView) => void;
}

interface NavItem {
  id: SidebarView;
  labelKey: string;
  icon: React.ElementType;
  shortcut?: string;
}

// Base nav items always shown
const baseNavItems: NavItem[] = [
  { id: 'kanban', labelKey: 'navigation:items.kanban', icon: LayoutGrid, shortcut: 'K' },
  { id: 'terminals', labelKey: 'navigation:items.terminals', icon: Terminal, shortcut: 'A' },
  { id: 'insights', labelKey: 'navigation:items.insights', icon: Sparkles, shortcut: 'N' },
  { id: 'roadmap', labelKey: 'navigation:items.roadmap', icon: Map, shortcut: 'D' },
  { id: 'ideation', labelKey: 'navigation:items.ideation', icon: Lightbulb, shortcut: 'I' },
  { id: 'changelog', labelKey: 'navigation:items.changelog', icon: FileText, shortcut: 'L' },
  { id: 'context', labelKey: 'navigation:items.context', icon: BookOpen, shortcut: 'C' },
  { id: 'agent-tools', labelKey: 'navigation:items.agentTools', icon: Wrench, shortcut: 'M' },
  { id: 'worktrees', labelKey: 'navigation:items.worktrees', icon: GitBranch, shortcut: 'W' }
];

// GitHub nav items shown when GitHub is enabled
const githubNavItems: NavItem[] = [
  { id: 'github-issues', labelKey: 'navigation:items.githubIssues', icon: Github, shortcut: 'G' },
  { id: 'github-prs', labelKey: 'navigation:items.githubPRs', icon: GitPullRequest, shortcut: 'P' }
];

// GitLab nav items shown when GitLab is enabled
const gitlabNavItems: NavItem[] = [
  { id: 'gitlab-issues', labelKey: 'navigation:items.gitlabIssues', icon: GitlabIcon, shortcut: 'B' },
  { id: 'gitlab-merge-requests', labelKey: 'navigation:items.gitlabMRs', icon: GitMerge, shortcut: 'R' }
];

export function Sidebar({
  onSettingsClick,
  onNewTaskClick,
  activeView = 'kanban',
  onViewChange
}: SidebarProps) {
  const { t } = useTranslation(['navigation', 'dialogs', 'common']);
  const projects = useProjectStore((state) => state.projects);
  const selectedProjectId = useProjectStore((state) => state.selectedProjectId);
  const selectProject = useProjectStore((state) => state.selectProject);
  const settings = useSettingsStore((state) => state.settings);

  const [showProjectWizard, setShowProjectWizard] = useState(false);
  const [showGitSetupModal, setShowGitSetupModal] = useState(false);
  const [gitStatus, setGitStatus] = useState<GitStatus | null>(null);
  const [envConfig, setEnvConfig] = useState<ProjectEnvConfig | null>(null);

  const selectedProject = projects.find((p) => p.id === selectedProjectId);

  // Load env config when project changes to check GitHub/GitLab enabled state
  useEffect(() => {
    const loadEnvConfig = async () => {
      if (selectedProject?.autoBuildPath) {
        try {
          const result = await window.electronAPI.getProjectEnv(selectedProject.id);
          if (result.success && result.data) {
            setEnvConfig(result.data);
          } else {
            setEnvConfig(null);
          }
        } catch {
          setEnvConfig(null);
        }
      } else {
        setEnvConfig(null);
      }
    };
    loadEnvConfig();
  }, [selectedProject?.id, selectedProject?.autoBuildPath]);

  // Compute visible nav items based on GitHub/GitLab enabled state
  const visibleNavItems = useMemo(() => {
    const items = [...baseNavItems];

    if (envConfig?.githubEnabled) {
      items.push(...githubNavItems);
    }

    if (envConfig?.gitlabEnabled) {
      items.push(...gitlabNavItems);
    }

    return items;
  }, [envConfig?.githubEnabled, envConfig?.gitlabEnabled]);

  // Keyboard shortcuts
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Don't trigger shortcuts when typing in inputs
      if (
        e.target instanceof HTMLInputElement ||
        e.target instanceof HTMLTextAreaElement ||
        e.target instanceof HTMLSelectElement ||
        (e.target as HTMLElement)?.isContentEditable
      ) {
        return;
      }

      // Only handle shortcuts when a project is selected
      if (!selectedProjectId) return;

      // Check for modifier keys - we want plain key presses only
      if (e.metaKey || e.ctrlKey || e.altKey) return;

      const key = e.key.toUpperCase();

      // Find matching nav item from visible items only
      const matchedItem = visibleNavItems.find((item) => item.shortcut === key);

      if (matchedItem) {
        e.preventDefault();
        onViewChange?.(matchedItem.id);
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [selectedProjectId, onViewChange, visibleNavItems]);

  // Check git status when project changes
  useEffect(() => {
    const checkGit = async () => {
      if (selectedProject) {
        try {
          const result = await window.electronAPI.checkGitStatus(selectedProject.path);
          if (result.success && result.data) {
            setGitStatus(result.data);
            // Show git setup modal if project is not a git repo or has no commits
            if (!result.data.isGitRepo || !result.data.hasCommits) {
              setShowGitSetupModal(true);
            }
          }
        } catch (error) {
          console.error('Failed to check git status:', error);
        }
      } else {
        setGitStatus(null);
      }
    };
    checkGit();
  }, [selectedProject]);

  const handleAddProject = () => {
    setShowProjectWizard(true);
  };

  const handleWizardProjectAdded = (project: Project) => {
    // ProjectWizard handles everything internally, just select the project
    selectProject(project.id);
    setShowProjectWizard(false);
  };

  const handleGitInitialized = async () => {
    // Refresh git status after initialization
    if (selectedProject) {
      try {
        const result = await window.electronAPI.checkGitStatus(selectedProject.path);
        if (result.success && result.data) {
          setGitStatus(result.data);
        }
      } catch (error) {
        console.error('Failed to refresh git status:', error);
      }
    }
  };

  const _handleRemoveProject = async (projectId: string, e: React.MouseEvent) => {
    e.stopPropagation();
    e.preventDefault();
    await removeProject(projectId);
  };


  const handleNavClick = (view: SidebarView) => {
    onViewChange?.(view);
  };

  const renderNavItem = (item: NavItem) => {
    const isActive = activeView === item.id;
    const Icon = item.icon;

    return (
      <button
        key={item.id}
        onClick={() => handleNavClick(item.id)}
        disabled={!selectedProjectId}
        aria-keyshortcuts={item.shortcut}
        className={cn(
          'flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-sm transition-all duration-200',
          'hover:bg-accent hover:text-accent-foreground',
          'disabled:pointer-events-none disabled:opacity-50',
          isActive && 'bg-accent text-accent-foreground'
        )}
      >
        <Icon className="h-4 w-4 shrink-0" />
        <span className="flex-1 text-left">{t(item.labelKey)}</span>
        {item.shortcut && (
          <kbd className="pointer-events-none hidden h-5 select-none items-center gap-1 rounded-md border border-border bg-secondary px-1.5 font-mono text-[10px] font-medium text-muted-foreground sm:flex">
            {item.shortcut}
          </kbd>
        )}
      </button>
    );
  };

  return (
    <TooltipProvider>
      <div className="flex h-full w-64 flex-col bg-sidebar border-r border-border">
        {/* Header with drag area - extra top padding for macOS traffic lights */}
        <div className="electron-drag flex h-14 items-center px-4 pt-6">
          <span className="electron-no-drag text-lg font-bold text-primary">Auto Claude</span>
        </div>

        <Separator className="mt-2" />


        <Separator />

        {/* Navigation */}
        <ScrollArea className="flex-1">
          <div className="px-3 py-4">
            {/* Project Section */}
            <div>
              <h3 className="mb-2 px-3 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                {t('sections.project')}
              </h3>
              <nav className="space-y-1">
                {visibleNavItems.map(renderNavItem)}
              </nav>
            </div>
          </div>
        </ScrollArea>

        <Separator />

        {/* Rate Limit Indicator - shows when Claude is rate limited */}
        <RateLimitIndicator />

        {/* Bottom section with Settings, Help, and New Task */}
        <div className="p-4 space-y-3">
          {/* Claude Code Status Badge */}
          <ClaudeCodeStatusBadge />

          {/* Settings and Help row */}
          <div className="flex items-center gap-2">
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  variant="ghost"
                  size="sm"
                  className="flex-1 justify-start gap-2"
                  onClick={onSettingsClick}
                >
                  <Settings className="h-4 w-4" />
                  {t('actions.settings')}
                </Button>
              </TooltipTrigger>
              <TooltipContent side="top">{t('tooltips.settings')}</TooltipContent>
            </Tooltip>
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={() => window.open('https://github.com/AndyMik90/Auto-Claude/issues', '_blank')}
                  aria-label={t('tooltips.help')}
                >
                  <HelpCircle className="h-4 w-4" />
                </Button>
              </TooltipTrigger>
              <TooltipContent side="top">{t('tooltips.help')}</TooltipContent>
            </Tooltip>
          </div>

          {/* New Task button */}
          <Button
            className="w-full"
            onClick={onNewTaskClick}
            disabled={!selectedProjectId || !selectedProject?.autoBuildPath}
          >
            <Plus className="mr-2 h-4 w-4" />
            {t('actions.newTask')}
          </Button>
          {selectedProject && !selectedProject.autoBuildPath && (
            <p className="mt-2 text-xs text-muted-foreground text-center">
              {t('messages.initializeToCreateTasks')}
            </p>
          )}
        </div>
      </div>

      {/* Add Project Wizard - unified project creation */}
      <ProjectWizard
        open={showProjectWizard}
        onOpenChange={setShowProjectWizard}
        onProjectAdded={handleWizardProjectAdded}
      />

      {/* Git Setup Modal - for existing projects that need git setup */}
      <GitSetupModal
        open={showGitSetupModal}
        onOpenChange={setShowGitSetupModal}
        project={selectedProject || null}
        gitStatus={gitStatus}
        onGitInitialized={handleGitInitialized}
      />
    </TooltipProvider>
  );
}
