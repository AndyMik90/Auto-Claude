import { useTranslation } from 'react-i18next';
import { Github, RefreshCw, Search, Filter, Wand2, Loader2, Layers, ExternalLink, GitFork, X, Check } from 'lucide-react';
import { Badge } from '../../ui/badge';
import { Button } from '../../ui/button';
import { Input } from '../../ui/input';
import { Switch } from '../../ui/switch';
import { Label } from '../../ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue
} from '../../ui/select';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '../../ui/tooltip';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuTrigger,
} from '../../ui/dropdown-menu';
import { Separator } from '../../ui/separator';
import { cn } from '../../../lib/utils';
import type { IssueListHeaderProps } from '../types';

export function IssueListHeader({
  repoFullName,
  configuredRepos = [],
  openIssuesCount,
  isLoading,
  searchQuery,
  filterState,
  onSearchChange,
  onFilterChange,
  onRefresh,
  repositories = [],
  selectedRepos = [],
  onReposChange,
  hasActiveFilters = false,
  onClearFilters,
  autoFixEnabled,
  autoFixRunning,
  autoFixProcessing,
  onAutoFixToggle,
  onAnalyzeAndGroup,
  isAnalyzing,
}: IssueListHeaderProps) {
  const { t } = useTranslation('common');

  return (
    <div className="shrink-0 p-4 border-b border-border">
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-3">
          <div className="p-2 rounded-lg bg-muted">
            <Github className="h-5 w-5" />
          </div>
          <div>
            <h2 className="text-lg font-semibold text-foreground">
              GitHub Issues
            </h2>
            {configuredRepos.length > 0 ? (
              <div className="flex items-center gap-2 flex-wrap">
                {configuredRepos.map((repo, index) => (
                  <a
                    key={repo}
                    href={`https://github.com/${repo}/issues`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-xs text-muted-foreground hover:text-foreground flex items-center gap-1"
                  >
                    {repo}
                    <ExternalLink className="h-3 w-3" />
                    {index < configuredRepos.length - 1 && <span className="text-muted-foreground/50 ml-1">|</span>}
                  </a>
                ))}
              </div>
            ) : (
              <p className="text-xs text-muted-foreground">
                {repoFullName}
              </p>
            )}
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Badge variant="outline" className="text-xs">
            {openIssuesCount} open
          </Badge>
          <Button
            variant="ghost"
            size="icon"
            onClick={onRefresh}
            disabled={isLoading}
            aria-label={t('buttons.refresh')}
          >
            <RefreshCw className={`h-4 w-4 ${isLoading ? 'animate-spin' : ''}`} aria-hidden="true" />
          </Button>
        </div>
      </div>

      {/* Issue Management Actions */}
      <div className="flex items-center gap-3 mb-4">
        {/* Analyze & Group Button (Proactive) */}
        {onAnalyzeAndGroup && (
          <TooltipProvider>
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={onAnalyzeAndGroup}
                  disabled={isAnalyzing || isLoading}
                  className="flex-1"
                >
                  {isAnalyzing ? (
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  ) : (
                    <Layers className="h-4 w-4 mr-2" />
                  )}
                  Analyze & Group Issues
                </Button>
              </TooltipTrigger>
              <TooltipContent side="bottom" className="max-w-xs">
                <p>Analyze up to 200 open issues, group similar ones, and review proposed batches before creating tasks.</p>
              </TooltipContent>
            </Tooltip>
          </TooltipProvider>
        )}

        {/* Auto-Fix Toggle (Reactive) */}
        {onAutoFixToggle && (
          <div className="flex items-center gap-2 p-2 rounded-lg bg-muted/50 border border-border">
            <TooltipProvider>
              <Tooltip>
                <TooltipTrigger asChild>
                  <div className="flex items-center gap-2">
                    {autoFixRunning ? (
                      <Loader2 className="h-4 w-4 text-primary animate-spin" />
                    ) : (
                      <Wand2 className="h-4 w-4 text-muted-foreground" />
                    )}
                    <Label htmlFor="auto-fix-toggle" className="text-sm cursor-pointer whitespace-nowrap">
                      Auto-Fix New
                    </Label>
                    <Switch
                      id="auto-fix-toggle"
                      checked={autoFixEnabled ?? false}
                      onCheckedChange={onAutoFixToggle}
                      disabled={autoFixRunning}
                    />
                  </div>
                </TooltipTrigger>
                <TooltipContent side="bottom" className="max-w-xs">
                  <p>Automatically fix new issues as they come in.</p>
                  {autoFixRunning && autoFixProcessing !== undefined && autoFixProcessing > 0 && (
                    <p className="mt-1 text-primary">Processing {autoFixProcessing} issue{autoFixProcessing > 1 ? 's' : ''}...</p>
                  )}
                </TooltipContent>
              </Tooltip>
            </TooltipProvider>
          </div>
        )}
      </div>

      {/* Filters */}
      <div className="flex items-center gap-3">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search issues..."
            value={searchQuery}
            onChange={(e) => onSearchChange(e.target.value)}
            className="pl-9"
          />
        </div>

        {/* Repository Filter - only show if multiple repos */}
        {repositories.length > 1 && onReposChange && (
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button
                variant="outline"
                size="sm"
                className={cn(
                  "h-9 border-dashed bg-transparent",
                  selectedRepos.length > 0 && "border-solid bg-accent/50"
                )}
              >
                <GitFork className="mr-2 h-4 w-4 text-muted-foreground" />
                <span className="truncate">{t('prReview.repositories')}</span>
                {selectedRepos.length > 0 && (
                  <>
                    <Separator orientation="vertical" className="mx-2 h-4" />
                    <Badge variant="secondary" className="rounded-sm px-1 font-normal">
                      {selectedRepos.length}
                    </Badge>
                  </>
                )}
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="start" className="w-[240px] p-0">
              <div className="px-3 py-2 border-b border-border/50">
                <div className="text-xs font-semibold text-muted-foreground">
                  {t('prReview.repositories')}
                </div>
              </div>
              <div className="max-h-[300px] overflow-y-auto p-1">
                {repositories.map((repo) => {
                  const isSelected = selectedRepos.includes(repo);
                  return (
                    <div
                      key={repo}
                      role="option"
                      aria-selected={isSelected}
                      className={cn(
                        "relative flex cursor-pointer select-none items-center rounded-sm px-2 py-2 text-sm outline-none transition-colors hover:bg-accent hover:text-accent-foreground",
                        isSelected && "bg-accent/50"
                      )}
                      onClick={() => {
                        if (isSelected) {
                          onReposChange(selectedRepos.filter(r => r !== repo));
                        } else {
                          onReposChange([...selectedRepos, repo]);
                        }
                      }}
                    >
                      <div className={cn(
                        "mr-2 flex h-4 w-4 items-center justify-center rounded-sm border border-primary/30",
                        isSelected ? "bg-primary border-primary text-primary-foreground" : "opacity-50 [&_svg]:invisible"
                      )}>
                        <Check className="h-3 w-3" />
                      </div>
                      <div className="flex items-center gap-2 min-w-0">
                        <GitFork className="h-4 w-4 text-muted-foreground shrink-0" />
                        <span className="truncate text-sm">{repo}</span>
                      </div>
                    </div>
                  );
                })}
              </div>
              {selectedRepos.length > 0 && (
                <div className="p-1 border-t border-border/50 bg-muted/20">
                  <Button
                    variant="ghost"
                    size="sm"
                    className="w-full justify-center text-xs h-7 hover:bg-destructive/10 hover:text-destructive"
                    onClick={() => onReposChange([])}
                  >
                    {t('prReview.clearFilters')}
                  </Button>
                </div>
              )}
            </DropdownMenuContent>
          </DropdownMenu>
        )}

        <Select value={filterState} onValueChange={onFilterChange}>
          <SelectTrigger className="w-32">
            <Filter className="h-4 w-4 mr-2" />
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="open">Open</SelectItem>
            <SelectItem value="closed">Closed</SelectItem>
            <SelectItem value="all">All</SelectItem>
          </SelectContent>
        </Select>

        {/* Reset All Filters */}
        {hasActiveFilters && onClearFilters && (
          <Button
            variant="ghost"
            size="sm"
            onClick={onClearFilters}
            className="h-9 px-2 text-muted-foreground hover:text-foreground"
          >
            <X className="h-4 w-4" />
          </Button>
        )}
      </div>
    </div>
  );
}
