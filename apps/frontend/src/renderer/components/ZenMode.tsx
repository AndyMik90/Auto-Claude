import { useState, useEffect, useCallback, useRef } from 'react';
import { useTranslation } from 'react-i18next';
import { Search, Sparkles, ArrowRight, X, Loader2, Command } from 'lucide-react';
import { Button } from './ui/button';
import { Input } from './ui/input';
import { cn } from '../lib/utils';
import { createTask } from '../stores/task-store';
import { useProjectStore } from '../stores/project-store';
import { useSettingsStore } from '../stores/settings-store';
import type {
  TaskCategory,
  TaskPriority,
  TaskComplexity,
  TaskImpact,
  TaskMetadata
} from '../../shared/types';

interface ZenModeProps {
  onExit: () => void;
  onTaskCreated?: (taskId: string) => void;
}

interface ParsedIntent {
  title: string;
  description: string;
  category?: TaskCategory;
  priority?: TaskPriority;
  complexity?: TaskComplexity;
  impact?: TaskImpact;
  confidence: number;
}

// Recent intents for suggestions (stored in localStorage)
const RECENT_INTENTS_KEY = 'zen-mode-recent-intents';
const MAX_RECENT_INTENTS = 5;

function getRecentIntents(): string[] {
  try {
    const stored = localStorage.getItem(RECENT_INTENTS_KEY);
    return stored ? JSON.parse(stored) : [];
  } catch {
    return [];
  }
}

function saveRecentIntent(intent: string): void {
  const recent = getRecentIntents();
  const filtered = recent.filter(i => i !== intent);
  const updated = [intent, ...filtered].slice(0, MAX_RECENT_INTENTS);
  localStorage.setItem(RECENT_INTENTS_KEY, JSON.stringify(updated));
}

/**
 * ZenMode component - minimalist interface for quick task creation
 *
 * Features:
 * - Central search bar for natural language input
 * - AI-powered intent parsing to auto-populate task fields
 * - Recent intents for quick access
 * - Keyboard shortcuts (Esc to exit, Enter to submit)
 * - Stay in zen mode after task creation (configurable)
 */
export function ZenMode({ onExit, onTaskCreated }: ZenModeProps) {
  const { t } = useTranslation(['zen', 'common']);
  const settings = useSettingsStore((state) => state.settings);

  const selectedProjectId = useProjectStore((state) => state.selectedProjectId);
  const activeProjectId = useProjectStore((state) => state.activeProjectId);
  const projects = useProjectStore((state) => state.projects);

  const projectId = activeProjectId || selectedProjectId;
  const project = projects.find(p => p.id === projectId);

  // Input state
  const [input, setInput] = useState('');
  const [isParsing, setIsParsing] = useState(false);
  const [parsedIntent, setParsedIntent] = useState<ParsedIntent | null>(null);
  const [isCreating, setIsCreating] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showSuggestions, setShowSuggestions] = useState(false);

  // Refs
  const inputRef = useRef<HTMLInputElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  // Recent intents
  const [recentIntents, setRecentIntents] = useState<string[]>([]);

  // Load recent intents on mount
  useEffect(() => {
    setRecentIntents(getRecentIntents());
  }, []);

  // Focus input on mount
  useEffect(() => {
    inputRef.current?.focus();
  }, []);

  // Handle keyboard shortcuts
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Esc - exit zen mode
      if (e.key === 'Escape') {
        e.preventDefault();
        onExit();
      }

      // Cmd/Ctrl+K - exit zen mode (toggle)
      if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
        e.preventDefault();
        onExit();
      }

      // Enter - submit (if we have input)
      if (e.key === 'Enter' && !e.shiftKey && input.trim() && !isCreating) {
        e.preventDefault();
        handleSubmit();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [input, isCreating, onExit]);

  // Parse intent using AI (mock implementation - uses heuristic parsing)
  const parseIntent = useCallback(async (text: string): Promise<ParsedIntent> => {
    // This is a simple heuristic-based parser
    // In production, you'd call the backend AI intent parser

    const lowerText = text.toLowerCase();
    let title = text.slice(0, 60); // Truncate for title
    if (title.length < text.length) title += '...';

    // Category detection
    let category: TaskCategory | undefined;
    if (lowerText.includes('bug') || lowerText.includes('fix') || lowerText.includes('error')) {
      category = 'bug_fix';
    } else if (lowerText.includes('add') || lowerText.includes('implement') || lowerText.includes('create')) {
      category = 'feature';
    } else if (lowerText.includes('refactor') || lowerText.includes('clean up')) {
      category = 'refactoring';
    } else if (lowerText.includes('test')) {
      category = 'testing';
    } else if (lowerText.includes('document')) {
      category = 'documentation';
    }

    // Priority detection
    let priority: TaskPriority | undefined;
    if (lowerText.includes('urgent') || lowerText.includes('asap') || lowerText.includes('critical')) {
      priority = 'urgent';
    } else if (lowerText.includes('important')) {
      priority = 'high';
    } else if (lowerText.includes('low priority') || lowerText.includes('minor')) {
      priority = 'low';
    } else {
      priority = 'medium';
    }

    // Complexity detection
    let complexity: TaskComplexity | undefined;
    if (lowerText.includes('simple') || lowerText.includes('quick') || lowerText.includes('small')) {
      complexity = 'small';
    } else if (lowerText.includes('complex') || lowerText.includes('large')) {
      complexity = 'large';
    } else {
      complexity = 'medium';
    }

    return {
      title,
      description: text,
      category,
      priority,
      complexity,
      confidence: 0.8
    };
  }, []);

  // Handle input change with debounced parsing
  useEffect(() => {
    if (!input.trim()) {
      setParsedIntent(null);
      setShowSuggestions(true);
      return;
    }

    setShowSuggestions(false);
    setIsParsing(true);

    const timer = setTimeout(async () => {
      const parsed = await parseIntent(input);
      setParsedIntent(parsed);
      setIsParsing(false);
    }, 300);

    return () => clearTimeout(timer);
  }, [input, parseIntent]);

  // Handle submit
  const handleSubmit = async () => {
    if (!input.trim() || !projectId || isCreating) return;

    setIsCreating(true);
    setError(null);

    try {
      // Use parsed intent or fallback
      const intent = parsedIntent || {
        title: input.slice(0, 60),
        description: input,
        confidence: 0.5
      };

      // Build metadata
      const metadata: TaskMetadata = {
        sourceType: 'manual'
      };

      if (intent.category) metadata.category = intent.category;
      if (intent.priority) metadata.priority = intent.priority;
      if (intent.complexity) metadata.complexity = intent.complexity;
      if (intent.impact) metadata.impact = intent.impact;

      // Create task
      const task = await createTask(
        projectId,
        intent.title,
        intent.description,
        metadata
      );

      if (task) {
        // Save to recent intents
        saveRecentIntent(input);
        setRecentIntents(getRecentIntents());

        // Reset input
        setInput('');
        setParsedIntent(null);
        setShowSuggestions(true);

        // Callback
        onTaskCreated?.(task.id);

        // Exit zen mode if not staying
        if (!settings.stayInZenAfterCreate) {
          onExit();
        }
      } else {
        setError('Failed to create task. Please try again.');
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unknown error');
    } finally {
      setIsCreating(false);
    }
  };

  // Handle suggestion click
  const handleSuggestionClick = (suggestion: string) => {
    setInput(suggestion);
    inputRef.current?.focus();
    setShowSuggestions(false);
  };

  if (!project) {
    return (
      <div className="flex items-center justify-center h-screen bg-background">
        <div className="text-center space-y-4">
          <Sparkles className="h-12 w-12 mx-auto text-muted-foreground" />
          <p className="text-muted-foreground">Please select a project to use Zen Mode</p>
          <Button onClick={onExit}>Exit Zen Mode</Button>
        </div>
      </div>
    );
  }

  return (
    <div
      ref={containerRef}
      className="flex flex-col items-center justify-center h-screen bg-background px-6"
      onClick={(e) => {
        // Exit if clicking outside the main card
        if (e.target === containerRef.current) {
          onExit();
        }
      }}
    >
      {/* Background decoration */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div className="absolute -top-1/2 -right-1/2 w-full h-full bg-primary/5 rounded-full blur-3xl" />
        <div className="absolute -bottom-1/2 -left-1/2 w-full h-full bg-primary/5 rounded-full blur-3xl" />
      </div>

      {/* Main card */}
      <div
        className="relative w-full max-w-2xl space-y-6"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header with exit button */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Sparkles className="h-5 w-5 text-primary" />
            <h1 className="text-lg font-medium text-foreground">Zen Mode</h1>
          </div>
          <Button
            variant="ghost"
            size="sm"
            onClick={onExit}
            className="gap-2"
          >
            <X className="h-4 w-4" />
            Exit
            <kbd className="ml-2 px-1.5 py-0.5 text-xs bg-muted rounded border border-border">
              Esc
            </kbd>
          </Button>
        </div>

        {/* Search input */}
        <div className="relative">
          <Search className="absolute left-4 top-1/2 -translate-y-1/2 h-5 w-5 text-muted-foreground pointer-events-none" />
          <Input
            ref={inputRef}
            type="text"
            placeholder="Describe what you want to build... (e.g., 'Add dark mode support to settings')"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            disabled={isCreating}
            className={cn(
              "h-14 pl-12 pr-12 text-base",
              "bg-card/80 backdrop-blur-sm border-2",
              "focus:border-primary transition-all duration-200"
            )}
          />
          {isParsing && (
            <Loader2 className="absolute right-4 top-1/2 -translate-y-1/2 h-5 w-5 text-muted-foreground animate-spin" />
          )}
        </div>

        {/* Parsed intent preview */}
        {parsedIntent && !showSuggestions && (
          <div className="bg-card/50 backdrop-blur-sm border border-border rounded-xl p-4 space-y-3 animate-in fade-in slide-in-from-top-2 duration-200 ease-out">
            <div className="flex items-center justify-between">
              <span className="text-sm font-medium text-foreground">AI Interpreted Intent</span>
              <span className="text-xs text-muted-foreground">
                {Math.round(parsedIntent.confidence * 100)}% confidence
              </span>
            </div>

            <div className="grid grid-cols-2 gap-3 text-sm">
              {parsedIntent.category && (
                <div>
                  <span className="text-muted-foreground">Category:</span>
                  <span className="ml-2 font-medium">{parsedIntent.category}</span>
                </div>
              )}
              {parsedIntent.priority && (
                <div>
                  <span className="text-muted-foreground">Priority:</span>
                  <span className="ml-2 font-medium">{parsedIntent.priority}</span>
                </div>
              )}
              {parsedIntent.complexity && (
                <div>
                  <span className="text-muted-foreground">Complexity:</span>
                  <span className="ml-2 font-medium">{parsedIntent.complexity}</span>
                </div>
              )}
            </div>

            <div>
              <span className="text-muted-foreground text-sm">Title:</span>
              <p className="mt-1 font-medium text-foreground">{parsedIntent.title}</p>
            </div>

            <div className="flex items-center gap-2 pt-2">
              <Button
                onClick={handleSubmit}
                disabled={isCreating}
                className="flex-1 gap-2"
              >
                {isCreating ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin" />
                    Creating...
                  </>
                ) : (
                  <>
                    <ArrowRight className="h-4 w-4" />
                    Create Task
                  </>
                )}
              </Button>
              <kbd className="px-2 py-1 text-xs bg-muted rounded border border-border">
                Enter
              </kbd>
            </div>
          </div>
        )}

        {/* Recent suggestions */}
        {showSuggestions && recentIntents.length > 0 && (
          <div className="space-y-2 animate-in fade-in duration-200 ease-out">
            <p className="text-sm text-muted-foreground">Recent:</p>
            <div className="flex flex-wrap gap-2">
              {recentIntents.map((intent, index) => (
                <button
                  key={index}
                  onClick={() => handleSuggestionClick(intent)}
                  className={cn(
                    "px-3 py-1.5 text-sm rounded-lg border border-border",
                    "bg-card/50 hover:bg-card hover:border-primary/50",
                    "transition-all duration-150 text-left max-w-xs truncate"
                  )}
                >
                  {intent}
                </button>
              ))}
            </div>
          </div>
        )}

        {/* Error message */}
        {error && (
          <div className="bg-destructive/10 border border-destructive/30 rounded-lg p-3 text-sm text-destructive">
            {error}
          </div>
        )}

        {/* Help text */}
        {!input && !showSuggestions && (
          <div className="text-center space-y-2 text-sm text-muted-foreground">
            <p>Type a natural language description of what you want to build</p>
            <p className="flex items-center justify-center gap-4">
              <span className="flex items-center gap-1">
                <kbd className="px-1.5 py-0.5 text-xs bg-muted rounded border border-border">Esc</kbd>
                Exit
              </span>
              <span className="flex items-center gap-1">
                <kbd className="px-1.5 py-0.5 text-xs bg-muted rounded border border-border">
                  <Command className="h-3 w-3" />+ K
                </kbd>
                Toggle
              </span>
              <span className="flex items-center gap-1">
                <kbd className="px-1.5 py-0.5 text-xs bg-muted rounded border border-border">Enter</kbd>
                Create
              </span>
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
