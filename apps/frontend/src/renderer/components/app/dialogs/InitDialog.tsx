import { Download, RefreshCw, AlertCircle } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle
} from '@/components/ui/dialog';
import type { AppSettings } from '@shared/types';

interface InitDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  settings: AppSettings;
  isInitializing: boolean;
  initError: string | null;
  onInitialize: () => void;
  onSkip: () => void;
}

/**
 * Initialization dialog for Auto Claude
 * Shows when a project doesn't have .auto-claude folder initialized
 */
export function InitDialog({
  open,
  onOpenChange,
  settings,
  isInitializing,
  initError,
  onInitialize,
  onSkip,
}: InitDialogProps) {
  const { t } = useTranslation('dialogs');

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Download className="h-5 w-5" />
            {t('initialize.title')}
          </DialogTitle>
          <DialogDescription>
            {t('initialize.description')}
          </DialogDescription>
        </DialogHeader>
        <div className="py-4">
          <div className="rounded-lg bg-muted p-4 text-sm">
            <p className="font-medium mb-2">{t('initialize.willDo')}</p>
            <ul className="list-disc list-inside space-y-1 text-muted-foreground">
              <li>{t('initialize.createFolder')}</li>
              <li>{t('initialize.copyFramework')}</li>
              <li>{t('initialize.setupSpecs')}</li>
            </ul>
          </div>
          {!settings.autoBuildPath && (
            <div className="mt-4 rounded-lg border border-warning/50 bg-warning/10 p-4 text-sm">
              <div className="flex items-start gap-2">
                <AlertCircle className="h-4 w-4 text-warning mt-0.5 shrink-0" />
                <div>
                  <p className="font-medium text-warning">{t('initialize.sourcePathNotConfigured')}</p>
                  <p className="text-muted-foreground mt-1">
                    {t('initialize.sourcePathNotConfiguredDescription')}
                  </p>
                </div>
              </div>
            </div>
          )}
          {initError && (
            <div className="mt-4 rounded-lg border border-destructive/50 bg-destructive/10 p-4 text-sm">
              <div className="flex items-start gap-2">
                <AlertCircle className="h-4 w-4 text-destructive mt-0.5 shrink-0" />
                <div>
                  <p className="font-medium text-destructive">{t('initialize.initFailed')}</p>
                  <p className="text-muted-foreground mt-1">
                    {initError}
                  </p>
                </div>
              </div>
            </div>
          )}
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onSkip} disabled={isInitializing}>
            {t('common:buttons.skip', { ns: 'common' })}
          </Button>
          <Button
            onClick={onInitialize}
            disabled={isInitializing || !settings.autoBuildPath}
          >
            {isInitializing ? (
              <>
                <RefreshCw className="mr-2 h-4 w-4 animate-spin" />
                {t('common:labels.initializing', { ns: 'common' })}
              </>
            ) : (
              <>
                <Download className="mr-2 h-4 w-4" />
                {t('common:buttons.initialize', { ns: 'common' })}
              </>
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
