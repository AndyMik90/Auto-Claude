import { Loader2, CheckCircle2, AlertCircle, Database } from 'lucide-react';
import { useTranslation } from 'react-i18next';
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
  const { t } = useTranslation('settings');
  
  return (
    <div className="rounded-lg border border-border bg-muted/30 p-3 space-y-3">
      <div className="flex items-center justify-between">
        <span className="text-sm font-medium text-foreground">{t('infrastructure.title')}</span>
        {isCheckingInfrastructure && (
          <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
        )}
      </div>

      {/* Kuzu Installation Status */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          {infrastructureStatus?.memory.kuzuInstalled ? (
            <CheckCircle2 className="h-4 w-4 text-success" />
          ) : (
            <AlertCircle className="h-4 w-4 text-warning" />
          )}
          <span className="text-xs text-foreground">{t('infrastructure.kuzuDatabase')}</span>
        </div>
        <div className="flex items-center gap-2">
          {infrastructureStatus?.memory.kuzuInstalled ? (
            <span className="text-xs text-success">{t('infrastructure.installed')}</span>
          ) : (
            <span className="text-xs text-warning">{t('infrastructure.notAvailable')}</span>
          )}
        </div>
      </div>

      {/* Database Status */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          {infrastructureStatus?.memory.databaseExists ? (
            <Database className="h-4 w-4 text-success" />
          ) : (
            <Database className="h-4 w-4 text-muted-foreground" />
          )}
          <span className="text-xs text-foreground">{t('infrastructure.database')}</span>
        </div>
        <div className="flex items-center gap-2">
          {infrastructureStatus?.memory.databaseExists ? (
            <span className="text-xs text-success">{t('infrastructure.ready')}</span>
          ) : infrastructureStatus?.memory.kuzuInstalled ? (
            <span className="text-xs text-muted-foreground">{t('infrastructure.willBeCreated')}</span>
          ) : (
            <span className="text-xs text-muted-foreground">{t('infrastructure.requiresKuzu')}</span>
          )}
        </div>
      </div>

      {/* Available Databases */}
      {infrastructureStatus?.memory.databases && infrastructureStatus.memory.databases.length > 0 && (
        <div className="text-xs text-muted-foreground">
          {t('infrastructure.availableDatabases', { databases: infrastructureStatus.memory.databases.join(', ') })}
        </div>
      )}

      {/* Overall Status Message */}
      {infrastructureStatus?.ready ? (
        <div className="text-xs text-success flex items-center gap-1">
          <CheckCircle2 className="h-3 w-3" />
          {t('infrastructure.graphMemoryReady')}
        </div>
      ) : infrastructureStatus && !infrastructureStatus.memory.kuzuInstalled && (
        <p className="text-xs text-muted-foreground">
          {t('infrastructure.graphMemoryRequires')}
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
