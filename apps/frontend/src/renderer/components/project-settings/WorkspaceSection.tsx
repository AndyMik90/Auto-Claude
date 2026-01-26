import { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { FolderGit2, GitBranch, Check, AlertCircle, Loader2, ArrowRight } from 'lucide-react';
import { Button } from '../ui/button';
import { useWorkspaceStore } from '../../stores/workspace-store';
import { MigrationWizard } from '../workspace/MigrationWizard';
import type { ProjectTypeDetectionResult } from '../../../shared/types/workspace';

interface WorkspaceSectionProps {
  projectPath: string;
}

/**
 * Settings section for workspace management.
 * Shows workspace status and allows converting to workspace if applicable.
 */
export function WorkspaceSection({ projectPath }: WorkspaceSectionProps) {
  const { t } = useTranslation(['workspace', 'common']);
  const [detection, setDetection] = useState<ProjectTypeDetectionResult | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [showMigrationWizard, setShowMigrationWizard] = useState(false);

  const { detectProjectType } = useWorkspaceStore();

  useEffect(() => {
    const detect = async () => {
      setIsLoading(true);
      try {
        const result = await detectProjectType(projectPath);
        setDetection(result);
      } catch {
        setDetection(null);
      } finally {
        setIsLoading(false);
      }
    };

    detect();
  }, [projectPath, detectProjectType]);

  if (isLoading) {
    return (
      <div className="flex items-center gap-3 py-4">
        <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
        <span className="text-sm text-muted-foreground">
          {t('workspace:loading')}
        </span>
      </div>
    );
  }

  // Already a workspace - show workspace info
  if (detection?.type === 'workspace') {
    return (
      <div className="space-y-4">
        <div className="rounded-lg border border-border bg-muted/50 p-4">
          <div className="flex items-center gap-3">
            <div className="rounded-full bg-green-100 p-2 dark:bg-green-900/30">
              <FolderGit2 className="h-5 w-5 text-green-600 dark:text-green-400" />
            </div>
            <div className="flex-1">
              <div className="flex items-center gap-2">
                <Check className="h-4 w-4 text-green-600" />
                <span className="font-medium">{t('workspace:migration.alreadyWorkspace')}</span>
              </div>
              {detection.subRepos && detection.subRepos.length > 0 && (
                <p className="text-sm text-muted-foreground mt-1">
                  {t('workspace:migration.foundRepos', { count: detection.subRepos.length })}
                </p>
              )}
            </div>
          </div>

          {/* List repos if available */}
          {detection.subRepos && detection.subRepos.length > 0 && (
            <div className="mt-4 space-y-2 border-t pt-4">
              {detection.subRepos.map((repo) => (
                <div key={repo.path} className="flex items-center gap-3 text-sm">
                  <GitBranch className="h-4 w-4 text-muted-foreground" />
                  <span className="font-medium">{repo.name}</span>
                  <span className="text-muted-foreground">({repo.path})</span>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    );
  }

  // Standalone git repo - no conversion needed
  if (detection?.type === 'standalone') {
    return (
      <div className="rounded-lg border border-border bg-muted/50 p-4">
        <div className="flex items-center gap-3">
          <div className="rounded-full bg-blue-100 p-2 dark:bg-blue-900/30">
            <GitBranch className="h-5 w-5 text-blue-600 dark:text-blue-400" />
          </div>
          <div className="flex-1">
            <span className="font-medium">{t('workspace:migration.alreadyStandalone')}</span>
            <p className="text-sm text-muted-foreground mt-1">
              This project is a single Git repository.
            </p>
          </div>
        </div>
      </div>
    );
  }

  // Convertible - show conversion option
  if (detection?.type === 'convertible') {
    return (
      <>
        <div className="rounded-lg border border-border bg-muted/50 p-4">
          <div className="flex items-start gap-3">
            <div className="rounded-full bg-amber-100 p-2 dark:bg-amber-900/30">
              <AlertCircle className="h-5 w-5 text-amber-600 dark:text-amber-400" />
            </div>
            <div className="flex-1">
              <span className="font-medium">{t('workspace:migration.title')}</span>
              <p className="text-sm text-muted-foreground mt-1">
                {t('workspace:migration.foundRepos', { count: detection.subRepos?.length || 0 })}
              </p>

              {/* Preview of detected repos */}
              {detection.subRepos && detection.subRepos.length > 0 && (
                <div className="mt-3 space-y-1">
                  {detection.subRepos.slice(0, 3).map((repo) => (
                    <div key={repo.path} className="flex items-center gap-2 text-sm text-muted-foreground">
                      <GitBranch className="h-3 w-3" />
                      <span>{repo.name}</span>
                    </div>
                  ))}
                  {detection.subRepos.length > 3 && (
                    <p className="text-xs text-muted-foreground">
                      +{detection.subRepos.length - 3} more...
                    </p>
                  )}
                </div>
              )}

              <Button
                size="sm"
                className="mt-4"
                onClick={() => setShowMigrationWizard(true)}
              >
                {t('workspace:migration.title')}
                <ArrowRight className="ml-2 h-4 w-4" />
              </Button>
            </div>
          </div>
        </div>

        <MigrationWizard
          open={showMigrationWizard}
          onOpenChange={setShowMigrationWizard}
          projectPath={projectPath}
          onMigrationComplete={() => {
            // Re-detect after migration
            detectProjectType(projectPath).then(setDetection);
          }}
        />
      </>
    );
  }

  // No git repos found
  return (
    <div className="rounded-lg border border-border bg-muted/50 p-4">
      <div className="flex items-center gap-3">
        <div className="rounded-full bg-gray-100 p-2 dark:bg-gray-900/30">
          <AlertCircle className="h-5 w-5 text-gray-600 dark:text-gray-400" />
        </div>
        <div className="flex-1">
          <span className="font-medium">{t('workspace:migration.noReposFound')}</span>
          <p className="text-sm text-muted-foreground mt-1">
            No Git repositories detected in this directory or subdirectories.
          </p>
        </div>
      </div>
    </div>
  );
}
