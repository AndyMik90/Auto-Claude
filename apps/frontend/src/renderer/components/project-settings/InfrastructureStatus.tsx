import { Loader2, CheckCircle2, AlertCircle, Database, ExternalLink } from 'lucide-react';
import type { InfrastructureStatus as InfrastructureStatusType } from '../../../shared/types';

interface InfrastructureStatusProps {
  infrastructureStatus: InfrastructureStatusType | null;
  isCheckingInfrastructure: boolean;
}

/**
 * Memory Infrastructure Status Component
 * Shows status of LadybugDB (embedded database) - no Docker required
 */
export function InfrastructureStatus({
  infrastructureStatus,
  isCheckingInfrastructure,
}: InfrastructureStatusProps) {
  const ladybugInstalled = infrastructureStatus?.memory.ladybugInstalled;
  const ladybugError = infrastructureStatus?.memory.ladybugError;

  return (
    <div className="rounded-lg border border-border bg-muted/30 p-3 space-y-3">
      <div className="flex items-center justify-between">
        <span className="text-sm font-medium text-foreground">Memory Infrastructure</span>
        {isCheckingInfrastructure && (
          <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
        )}
      </div>

      {/* LadybugDB Installation Status */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          {ladybugInstalled ? (
            <CheckCircle2 className="h-4 w-4 text-success" />
          ) : (
            <AlertCircle className="h-4 w-4 text-warning" />
          )}
          <span className="text-xs text-foreground">LadybugDB</span>
        </div>
        <div className="flex items-center gap-2">
          {ladybugInstalled ? (
            <span className="text-xs text-success">Installed</span>
          ) : (
            <span className="text-xs text-warning">Not Installed</span>
          )}
        </div>
      </div>

      {/* LadybugDB Error Details */}
      {!ladybugInstalled && ladybugError && (
        <div className="rounded-md bg-warning/10 border border-warning/30 p-2 space-y-1">
          <p className="text-xs text-warning">{ladybugError}</p>
          {ladybugError.includes('Visual Studio Build Tools') && (
            <a
              href="https://visualstudio.microsoft.com/visual-cpp-build-tools/"
              target="_blank"
              rel="noopener noreferrer"
              className="text-xs text-primary hover:text-primary/80 flex items-center gap-1"
            >
              <ExternalLink className="h-3 w-3" />
              Download Visual Studio Build Tools
            </a>
          )}
        </div>
      )}

      {/* Database Status */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          {infrastructureStatus?.memory.databaseExists ? (
            <Database className="h-4 w-4 text-success" />
          ) : (
            <Database className="h-4 w-4 text-muted-foreground" />
          )}
          <span className="text-xs text-foreground">Database</span>
        </div>
        <div className="flex items-center gap-2">
          {infrastructureStatus?.memory.databaseExists ? (
            <span className="text-xs text-success">Ready</span>
          ) : ladybugInstalled ? (
            <span className="text-xs text-muted-foreground">Will be created on first use</span>
          ) : (
            <span className="text-xs text-muted-foreground">Requires LadybugDB</span>
          )}
        </div>
      </div>

      {/* Available Databases */}
      {infrastructureStatus?.memory.databases && infrastructureStatus.memory.databases.length > 0 && (
        <div className="text-xs text-muted-foreground">
          Available databases: {infrastructureStatus.memory.databases.join(', ')}
        </div>
      )}

      {/* Overall Status Message */}
      {infrastructureStatus?.ready ? (
        <div className="text-xs text-success flex items-center gap-1">
          <CheckCircle2 className="h-3 w-3" />
          Graph memory is ready to use
        </div>
      ) : infrastructureStatus && !ladybugInstalled && (
        <p className="text-xs text-muted-foreground">
          Graph memory requires Python 3.12+ with LadybugDB. No Docker needed.
        </p>
      )}

      {/* Error Display */}
      {infrastructureStatus?.memory.error && (
        <p className="text-xs text-destructive">
          {infrastructureStatus.memory.error}
        </p>
      )}
    </div>
  );
}
