import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Button } from '../ui/button';
import { Loader2, CheckCircle2, XCircle } from 'lucide-react';

interface Props {
  pythonPath: string;
  activationScript?: string;
}

export function PythonPackageValidator({ pythonPath, activationScript }: Props) {
  const { t } = useTranslation('settings');
  const [status, setStatus] = useState<'idle' | 'checking' | 'valid' | 'invalid'>('idle');
  const [missingPackages, setMissingPackages] = useState<string[]>([]);
  const [installLocation, setInstallLocation] = useState<string>('');
  const [validationProgress, setValidationProgress] = useState<{ current: number; total: number; packageName: string } | null>(null);
  const [installing, setInstalling] = useState(false);
  const [installProgress, setInstallProgress] = useState('');
  const [error, setError] = useState<string>('');

  useEffect(() => {
    checkPackages();
  }, [pythonPath, activationScript]);

  const checkPackages = async () => {
    setStatus('checking');
    setValidationProgress(null);
    setError('');

    // Listen for validation progress
    const unsubscribe = window.electronAPI.onPythonValidationProgress((progress) => {
      setValidationProgress({
        current: progress.current,
        total: progress.total,
        packageName: progress.packageName
      });
    });

    const result = await window.electronAPI.validatePythonPackages({
      pythonPath,
      activationScript
    });

    unsubscribe();

    if (result.success && result.data) {
      setStatus(result.data.allInstalled ? 'valid' : 'invalid');
      setMissingPackages(result.data.missingPackages || []);
      setInstallLocation(result.data.installLocation || '');
      setError('');
    } else {
      setStatus('invalid');
      setMissingPackages([]);
      setInstallLocation('');
      setError(result.error || 'Failed to validate packages. Check that your Python path points to a Python executable (python.exe), not a directory.');
    }

    setValidationProgress(null);
  };

  const installRequirements = async () => {
    setInstalling(true);
    setInstallProgress(t('general.installingPackages'));
    setError('');

    const unsubscribe = window.electronAPI.onPythonInstallProgress((progress) => {
      setInstallProgress(progress);
    });

    const result = await window.electronAPI.installPythonRequirements({
      pythonPath,
      activationScript
    });

    unsubscribe();
    setInstalling(false);

    if (result.success) {
      setError('');
      await checkPackages();
    } else {
      setError(result.error || 'Installation failed. Check the progress output above for details.');
    }
  };

  return (
    <div className="space-y-3">
      {/* Error Display */}
      {error && (
        <div className="p-3 bg-destructive/10 border border-destructive/20 rounded-md">
          <p className="text-sm font-medium text-destructive mb-1">Error</p>
          <p className="text-xs text-destructive/80">{error}</p>
        </div>
      )}

      {/* Installation Location */}
      {installLocation && (
        <div className="text-xs text-muted-foreground">
          <span className="font-medium">Install location:</span>{' '}
          <code className="bg-muted px-1 py-0.5 rounded text-xs">{installLocation}</code>
        </div>
      )}

      {status === 'checking' && (
        <div className="flex flex-col gap-1">
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <Loader2 className="h-4 w-4 animate-spin" />
            <span>
              {validationProgress
                ? `${validationProgress.packageName} (${validationProgress.current}/${validationProgress.total})`
                : t('general.validatingPackages')}
            </span>
          </div>
        </div>
      )}

      {status === 'valid' && (
        <div className="flex items-center gap-2 text-sm text-green-600 dark:text-green-500">
          <CheckCircle2 className="h-4 w-4" />
          <span>{t('general.packagesValid')}</span>
        </div>
      )}

      {status === 'invalid' && (
        <div className="space-y-3">
          <div className="flex items-center gap-2 text-sm text-destructive">
            <XCircle className="h-4 w-4" />
            <span>{t('general.packagesInvalid')}</span>
          </div>

          {missingPackages.length > 0 && (
            <div className="space-y-1">
              <p className="text-xs font-medium text-foreground">
                Missing packages ({missingPackages.length}):
              </p>
              <div className="max-h-32 overflow-y-auto bg-muted/50 rounded p-2 space-y-1">
                {missingPackages.map((pkg) => (
                  <div key={pkg} className="text-xs text-muted-foreground font-mono">
                    • {pkg}
                  </div>
                ))}
              </div>
            </div>
          )}

          <Button
            onClick={installRequirements}
            disabled={installing}
            size="sm"
          >
            {installing && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            {t('general.installRequirements')}
          </Button>

          {(installing || installProgress) && (
            <div className="space-y-2">
              <p className="text-xs font-medium">Installation Output:</p>
              <div className="text-xs text-muted-foreground whitespace-pre-wrap max-h-48 overflow-y-auto bg-muted/50 rounded p-3 font-mono border border-border">
                {installProgress || 'Starting installation...'}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
