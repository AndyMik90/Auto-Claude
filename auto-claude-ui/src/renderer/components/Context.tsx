import { useEffect, useState } from 'react';
import {
  RefreshCw,
  Database,
  FolderTree,
  Brain,
  Search,
  AlertCircle,
  CheckCircle,
  XCircle,
  Code,
  Server,
  Globe,
  Cog,
  FileCode,
  Package,
  GitBranch,
  Clock,
  Lightbulb,
  AlertTriangle
} from 'lucide-react';
import { Button } from './ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from './ui/card';
import { Badge } from './ui/badge';
import { Input } from './ui/input';
import { ScrollArea } from './ui/scroll-area';
import { Tabs, TabsContent, TabsList, TabsTrigger } from './ui/tabs';
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger
} from './ui/tooltip';
import { cn } from '../lib/utils';
import {
  useContextStore,
  loadProjectContext,
  refreshProjectIndex,
  searchMemories
} from '../stores/context-store';
import type { ServiceInfo, MemoryEpisode } from '../../shared/types';

interface ContextProps {
  projectId: string;
}

// Service type icon mapping
const serviceTypeIcons: Record<string, React.ElementType> = {
  backend: Server,
  frontend: Globe,
  worker: Cog,
  scraper: Code,
  library: Package,
  proxy: GitBranch,
  unknown: FileCode
};

// Service type color mapping
const serviceTypeColors: Record<string, string> = {
  backend: 'bg-blue-500/10 text-blue-400 border-blue-500/30',
  frontend: 'bg-purple-500/10 text-purple-400 border-purple-500/30',
  worker: 'bg-amber-500/10 text-amber-400 border-amber-500/30',
  scraper: 'bg-green-500/10 text-green-400 border-green-500/30',
  library: 'bg-gray-500/10 text-gray-400 border-gray-500/30',
  proxy: 'bg-cyan-500/10 text-cyan-400 border-cyan-500/30',
  unknown: 'bg-muted text-muted-foreground border-muted'
};

// Memory type icon mapping
const memoryTypeIcons: Record<string, React.ElementType> = {
  session_insight: Lightbulb,
  codebase_discovery: FolderTree,
  codebase_map: FolderTree,
  pattern: Code,
  gotcha: AlertTriangle
};

export function Context({ projectId }: ContextProps) {
  const {
    projectIndex,
    indexLoading,
    indexError,
    memoryStatus,
    memoryState,
    recentMemories,
    memoriesLoading,
    searchResults,
    searchLoading,
    searchQuery
  } = useContextStore();

  const [activeTab, setActiveTab] = useState('index');
  const [localSearchQuery, setLocalSearchQuery] = useState('');

  // Load context on mount
  useEffect(() => {
    if (projectId) {
      loadProjectContext(projectId);
    }
  }, [projectId]);

  const handleRefreshIndex = async () => {
    await refreshProjectIndex(projectId);
  };

  const handleSearch = async () => {
    if (localSearchQuery.trim()) {
      await searchMemories(projectId, localSearchQuery);
    }
  };

  const handleSearchKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      handleSearch();
    }
  };

  return (
    <div className="flex h-full flex-col overflow-hidden">
      {/* Tabs */}
      <Tabs value={activeTab} onValueChange={setActiveTab} className="flex flex-col h-full">
        <div className="border-b border-border px-6 py-3">
          <TabsList className="grid w-full max-w-md grid-cols-2">
            <TabsTrigger value="index" className="gap-2">
              <FolderTree className="h-4 w-4" />
              Project Index
            </TabsTrigger>
            <TabsTrigger value="memories" className="gap-2">
              <Brain className="h-4 w-4" />
              Memories
            </TabsTrigger>
          </TabsList>
        </div>

        {/* Project Index Tab */}
        <TabsContent value="index" className="flex-1 overflow-hidden m-0">
          <ScrollArea className="h-full">
            <div className="p-6 space-y-6">
              {/* Header with refresh */}
              <div className="flex items-center justify-between">
                <div>
                  <h2 className="text-lg font-semibold text-foreground">Project Structure</h2>
                  <p className="text-sm text-muted-foreground">
                    AI-discovered knowledge about your codebase
                  </p>
                </div>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={handleRefreshIndex}
                      disabled={indexLoading}
                    >
                      <RefreshCw className={cn('h-4 w-4 mr-2', indexLoading && 'animate-spin')} />
                      Refresh
                    </Button>
                  </TooltipTrigger>
                  <TooltipContent>Re-analyze project structure</TooltipContent>
                </Tooltip>
              </div>

              {/* Error state */}
              {indexError && (
                <div className="flex items-center gap-3 p-4 rounded-lg bg-destructive/10 text-destructive">
                  <AlertCircle className="h-5 w-5 shrink-0" />
                  <div>
                    <p className="font-medium">Failed to load project index</p>
                    <p className="text-sm opacity-80">{indexError}</p>
                  </div>
                </div>
              )}

              {/* Loading state */}
              {indexLoading && !projectIndex && (
                <div className="flex items-center justify-center py-12">
                  <RefreshCw className="h-8 w-8 animate-spin text-muted-foreground" />
                </div>
              )}

              {/* No index state */}
              {!indexLoading && !projectIndex && !indexError && (
                <div className="flex flex-col items-center justify-center py-12 text-center">
                  <FolderTree className="h-12 w-12 text-muted-foreground mb-4" />
                  <h3 className="text-lg font-medium text-foreground">No Project Index Found</h3>
                  <p className="text-sm text-muted-foreground mt-2 max-w-sm">
                    Click the Refresh button to analyze your project structure and create an index.
                  </p>
                  <Button onClick={handleRefreshIndex} className="mt-4">
                    <RefreshCw className="h-4 w-4 mr-2" />
                    Analyze Project
                  </Button>
                </div>
              )}

              {/* Project index content */}
              {projectIndex && (
                <div className="space-y-6">
                  {/* Project Overview */}
                  <Card>
                    <CardHeader className="pb-3">
                      <CardTitle className="text-base">Overview</CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-3">
                      <div className="flex items-center gap-2">
                        <Badge variant="outline" className="capitalize">
                          {projectIndex.project_type}
                        </Badge>
                        {Object.keys(projectIndex.services).length > 0 && (
                          <Badge variant="secondary">
                            {Object.keys(projectIndex.services).length} service
                            {Object.keys(projectIndex.services).length !== 1 ? 's' : ''}
                          </Badge>
                        )}
                      </div>
                      <p className="text-sm text-muted-foreground font-mono truncate">
                        {projectIndex.project_root}
                      </p>
                    </CardContent>
                  </Card>

                  {/* Services */}
                  {Object.keys(projectIndex.services).length > 0 && (
                    <div className="space-y-4">
                      <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider">
                        Services
                      </h3>
                      <div className="grid gap-4 md:grid-cols-2">
                        {Object.entries(projectIndex.services).map(([name, service]) => (
                          <ServiceCard key={name} name={name} service={service} />
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Infrastructure */}
                  {Object.keys(projectIndex.infrastructure).length > 0 && (
                    <div className="space-y-4">
                      <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider">
                        Infrastructure
                      </h3>
                      <Card>
                        <CardContent className="pt-6">
                          <div className="grid gap-4 sm:grid-cols-2">
                            {projectIndex.infrastructure.docker_compose && (
                              <InfoItem label="Docker Compose" value={projectIndex.infrastructure.docker_compose} />
                            )}
                            {projectIndex.infrastructure.ci && (
                              <InfoItem label="CI/CD" value={projectIndex.infrastructure.ci} />
                            )}
                            {projectIndex.infrastructure.deployment && (
                              <InfoItem label="Deployment" value={projectIndex.infrastructure.deployment} />
                            )}
                            {projectIndex.infrastructure.docker_services &&
                              projectIndex.infrastructure.docker_services.length > 0 && (
                                <div className="sm:col-span-2">
                                  <span className="text-xs text-muted-foreground">Docker Services</span>
                                  <div className="flex flex-wrap gap-1 mt-1">
                                    {projectIndex.infrastructure.docker_services.map((svc) => (
                                      <Badge key={svc} variant="secondary" className="text-xs">
                                        {svc}
                                      </Badge>
                                    ))}
                                  </div>
                                </div>
                              )}
                          </div>
                        </CardContent>
                      </Card>
                    </div>
                  )}

                  {/* Conventions */}
                  {Object.keys(projectIndex.conventions).length > 0 && (
                    <div className="space-y-4">
                      <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider">
                        Conventions
                      </h3>
                      <Card>
                        <CardContent className="pt-6">
                          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                            {projectIndex.conventions.python_linting && (
                              <InfoItem label="Python Linting" value={projectIndex.conventions.python_linting} />
                            )}
                            {projectIndex.conventions.js_linting && (
                              <InfoItem label="JS Linting" value={projectIndex.conventions.js_linting} />
                            )}
                            {projectIndex.conventions.formatting && (
                              <InfoItem label="Formatting" value={projectIndex.conventions.formatting} />
                            )}
                            {projectIndex.conventions.git_hooks && (
                              <InfoItem label="Git Hooks" value={projectIndex.conventions.git_hooks} />
                            )}
                            {projectIndex.conventions.typescript && (
                              <InfoItem label="TypeScript" value="Enabled" />
                            )}
                          </div>
                        </CardContent>
                      </Card>
                    </div>
                  )}
                </div>
              )}
            </div>
          </ScrollArea>
        </TabsContent>

        {/* Memories Tab */}
        <TabsContent value="memories" className="flex-1 overflow-hidden m-0">
          <ScrollArea className="h-full">
            <div className="p-6 space-y-6">
              {/* Memory Status */}
              <Card>
                <CardHeader className="pb-3">
                  <div className="flex items-center justify-between">
                    <CardTitle className="text-base flex items-center gap-2">
                      <Database className="h-4 w-4" />
                      Graph Memory Status
                    </CardTitle>
                    {memoryStatus?.available ? (
                      <Badge variant="outline" className="bg-success/10 text-success border-success/30">
                        <CheckCircle className="h-3 w-3 mr-1" />
                        Connected
                      </Badge>
                    ) : (
                      <Badge variant="outline" className="bg-muted text-muted-foreground">
                        <XCircle className="h-3 w-3 mr-1" />
                        Not Available
                      </Badge>
                    )}
                  </div>
                </CardHeader>
                <CardContent className="space-y-3">
                  {memoryStatus?.available ? (
                    <>
                      <div className="grid gap-3 sm:grid-cols-3 text-sm">
                        <InfoItem label="Database" value={memoryStatus.database || 'auto_build_memory'} />
                        <InfoItem label="Host" value={`${memoryStatus.host}:${memoryStatus.port}`} />
                        {memoryState && (
                          <InfoItem label="Episodes" value={memoryState.episode_count.toString()} />
                        )}
                      </div>
                      {memoryState?.last_session && (
                        <p className="text-xs text-muted-foreground">
                          Last session: #{memoryState.last_session}
                        </p>
                      )}
                    </>
                  ) : (
                    <div className="text-sm text-muted-foreground">
                      <p>{memoryStatus?.reason || 'Graphiti memory is not configured'}</p>
                      <p className="mt-2 text-xs">
                        To enable graph memory, set <code className="bg-muted px-1 py-0.5 rounded">GRAPHITI_ENABLED=true</code> and configure FalkorDB.
                      </p>
                    </div>
                  )}
                </CardContent>
              </Card>

              {/* Search */}
              <div className="space-y-4">
                <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider">
                  Search Memories
                </h3>
                <div className="flex gap-2">
                  <Input
                    placeholder="Search for patterns, insights, gotchas..."
                    value={localSearchQuery}
                    onChange={(e) => setLocalSearchQuery(e.target.value)}
                    onKeyDown={handleSearchKeyDown}
                  />
                  <Button onClick={handleSearch} disabled={searchLoading}>
                    <Search className={cn('h-4 w-4', searchLoading && 'animate-pulse')} />
                  </Button>
                </div>

                {/* Search Results */}
                {searchResults.length > 0 && (
                  <div className="space-y-3">
                    <p className="text-sm text-muted-foreground">
                      {searchResults.length} result{searchResults.length !== 1 ? 's' : ''} found
                    </p>
                    {searchResults.map((result, idx) => (
                      <Card key={idx} className="bg-muted/50">
                        <CardContent className="pt-4">
                          <div className="flex items-center gap-2 mb-2">
                            <Badge variant="outline" className="text-xs capitalize">
                              {result.type.replace('_', ' ')}
                            </Badge>
                            <span className="text-xs text-muted-foreground">
                              Score: {result.score.toFixed(2)}
                            </span>
                          </div>
                          <pre className="text-xs text-muted-foreground whitespace-pre-wrap font-mono max-h-40 overflow-auto">
                            {result.content}
                          </pre>
                        </CardContent>
                      </Card>
                    ))}
                  </div>
                )}
              </div>

              {/* Recent Memories */}
              <div className="space-y-4">
                <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider">
                  Recent Memories
                </h3>

                {memoriesLoading && (
                  <div className="flex items-center justify-center py-8">
                    <RefreshCw className="h-6 w-6 animate-spin text-muted-foreground" />
                  </div>
                )}

                {!memoriesLoading && recentMemories.length === 0 && (
                  <div className="flex flex-col items-center justify-center py-8 text-center">
                    <Brain className="h-10 w-10 text-muted-foreground mb-3" />
                    <p className="text-sm text-muted-foreground">
                      No memories recorded yet. Memories are created during AI agent sessions.
                    </p>
                  </div>
                )}

                {recentMemories.length > 0 && (
                  <div className="space-y-3">
                    {recentMemories.map((memory) => (
                      <MemoryCard key={memory.id} memory={memory} />
                    ))}
                  </div>
                )}
              </div>
            </div>
          </ScrollArea>
        </TabsContent>
      </Tabs>
    </div>
  );
}

// Service Card Component
function ServiceCard({ name, service }: { name: string; service: ServiceInfo }) {
  const Icon = serviceTypeIcons[service.type || 'unknown'];
  const colorClass = serviceTypeColors[service.type || 'unknown'];

  return (
    <Card className="overflow-hidden">
      <CardHeader className="pb-2">
        <div className="flex items-center justify-between">
          <CardTitle className="text-base flex items-center gap-2">
            <Icon className="h-4 w-4" />
            {name}
          </CardTitle>
          <Badge variant="outline" className={cn('capitalize text-xs', colorClass)}>
            {service.type || 'unknown'}
          </Badge>
        </div>
        {service.path && (
          <CardDescription className="font-mono text-xs truncate">
            {service.path}
          </CardDescription>
        )}
      </CardHeader>
      <CardContent className="space-y-3">
        {/* Language & Framework */}
        <div className="flex flex-wrap gap-1.5">
          {service.language && (
            <Badge variant="secondary" className="text-xs">
              {service.language}
            </Badge>
          )}
          {service.framework && (
            <Badge variant="secondary" className="text-xs">
              {service.framework}
            </Badge>
          )}
          {service.package_manager && (
            <Badge variant="outline" className="text-xs">
              {service.package_manager}
            </Badge>
          )}
        </div>

        {/* Additional Info */}
        <div className="grid gap-2 text-xs">
          {service.entry_point && (
            <div className="flex items-center gap-2 text-muted-foreground">
              <FileCode className="h-3 w-3 shrink-0" />
              <span className="truncate font-mono">{service.entry_point}</span>
            </div>
          )}
          {service.testing && (
            <div className="flex items-center gap-2 text-muted-foreground">
              <CheckCircle className="h-3 w-3 shrink-0" />
              <span>Testing: {service.testing}</span>
            </div>
          )}
          {service.orm && (
            <div className="flex items-center gap-2 text-muted-foreground">
              <Database className="h-3 w-3 shrink-0" />
              <span>ORM: {service.orm}</span>
            </div>
          )}
          {service.default_port && (
            <div className="flex items-center gap-2 text-muted-foreground">
              <Globe className="h-3 w-3 shrink-0" />
              <span>Port: {service.default_port}</span>
            </div>
          )}
        </div>

        {/* Key Directories */}
        {service.key_directories && Object.keys(service.key_directories).length > 0 && (
          <div className="pt-2 border-t border-border">
            <p className="text-xs text-muted-foreground mb-1.5">Key Directories</p>
            <div className="flex flex-wrap gap-1">
              {Object.entries(service.key_directories).slice(0, 6).map(([dir, info]) => (
                <Tooltip key={dir}>
                  <TooltipTrigger asChild>
                    <Badge variant="outline" className="text-xs font-mono cursor-help">
                      {dir}
                    </Badge>
                  </TooltipTrigger>
                  <TooltipContent>{info.purpose}</TooltipContent>
                </Tooltip>
              ))}
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

// Memory Card Component
function MemoryCard({ memory }: { memory: MemoryEpisode }) {
  const Icon = memoryTypeIcons[memory.type] || Lightbulb;
  const [expanded, setExpanded] = useState(false);

  const formatDate = (timestamp: string) => {
    try {
      return new Date(timestamp).toLocaleString();
    } catch {
      return timestamp;
    }
  };

  return (
    <Card className="bg-muted/30">
      <CardContent className="pt-4">
        <div className="flex items-start justify-between gap-3">
          <div className="flex items-start gap-3 flex-1 min-w-0">
            <Icon className="h-5 w-5 text-muted-foreground shrink-0 mt-0.5" />
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 flex-wrap">
                <Badge variant="outline" className="text-xs capitalize">
                  {memory.type.replace('_', ' ')}
                </Badge>
                {memory.session_number && (
                  <span className="text-xs text-muted-foreground">
                    Session #{memory.session_number}
                  </span>
                )}
              </div>
              <div className="flex items-center gap-1 text-xs text-muted-foreground mt-1">
                <Clock className="h-3 w-3" />
                {formatDate(memory.timestamp)}
              </div>
            </div>
          </div>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setExpanded(!expanded)}
            className="shrink-0"
          >
            {expanded ? 'Collapse' : 'Expand'}
          </Button>
        </div>
        {expanded && (
          <pre className="mt-3 text-xs text-muted-foreground whitespace-pre-wrap font-mono p-3 bg-background rounded-md max-h-64 overflow-auto">
            {memory.content}
          </pre>
        )}
      </CardContent>
    </Card>
  );
}

// Info Item Component
function InfoItem({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <span className="text-xs text-muted-foreground">{label}</span>
      <p className="text-sm font-medium">{value}</p>
    </div>
  );
}
