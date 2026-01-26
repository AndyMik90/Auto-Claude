import { useState, useEffect, useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import {
  Plus,
  Pencil,
  Trash2,
  ShieldCheck,
  ShieldAlert,
  Loader2,
  KeyRound,
  Database,
  Cloud,
  Terminal,
  Settings
} from 'lucide-react';
import { Button } from '../../ui/button';
import { cn } from '../../../lib/utils';
import type { SecretMetadata, SecretType } from '../../../../shared/types/secrets';
import { SecretEditDialog } from './SecretEditDialog';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '../../ui/alert-dialog';

interface SecretsSettingsProps {
  projectPath: string;
}

/**
 * Secrets management settings component.
 * Allows users to manage encrypted credentials for external services.
 */
export function SecretsSettings({ projectPath }: SecretsSettingsProps) {
  const { t } = useTranslation('secrets');
  const [secrets, setSecrets] = useState<SecretMetadata[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [encryptionAvailable, setEncryptionAvailable] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Dialog states
  const [editDialogOpen, setEditDialogOpen] = useState(false);
  const [editingSecretId, setEditingSecretId] = useState<string | null>(null);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [deletingSecret, setDeletingSecret] = useState<SecretMetadata | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);

  const loadSecrets = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      const [encryptionResult, secretsResult] = await Promise.all([
        window.electronAPI.isEncryptionAvailable(),
        window.electronAPI.listSecrets(projectPath)
      ]);

      if (encryptionResult.success && encryptionResult.data !== undefined) {
        setEncryptionAvailable(encryptionResult.data);
      }

      if (secretsResult.success && secretsResult.data) {
        setSecrets(secretsResult.data);
      } else if (!secretsResult.success) {
        setError(secretsResult.error || t('errors.loadFailed'));
      }
    } catch (err) {
      setError(t('errors.loadFailed'));
    } finally {
      setIsLoading(false);
    }
  }, [projectPath, t]);

  useEffect(() => {
    loadSecrets();
  }, [loadSecrets]);

  const handleAddSecret = () => {
    setEditingSecretId(null);
    setEditDialogOpen(true);
  };

  const handleEditSecret = (secretId: string) => {
    setEditingSecretId(secretId);
    setEditDialogOpen(true);
  };

  const handleDeleteClick = (secret: SecretMetadata) => {
    setDeletingSecret(secret);
    setDeleteDialogOpen(true);
  };

  const handleDeleteConfirm = async () => {
    if (!deletingSecret) return;

    setIsDeleting(true);
    try {
      const result = await window.electronAPI.deleteSecret(projectPath, deletingSecret.id);
      if (result.success) {
        await loadSecrets();
        setDeleteDialogOpen(false);
        setDeletingSecret(null);
      } else {
        setError(result.error || t('errors.deleteFailed'));
      }
    } catch {
      setError(t('errors.deleteFailed'));
    } finally {
      setIsDeleting(false);
    }
  };

  const handleDialogClose = (saved: boolean) => {
    setEditDialogOpen(false);
    setEditingSecretId(null);
    if (saved) {
      loadSecrets();
    }
  };

  const getSecretIcon = (type: SecretType) => {
    switch (type) {
      case 'aws':
        return Cloud;
      case 'database':
        return Database;
      case 'api_key':
        return KeyRound;
      case 'ssh':
        return Terminal;
      default:
        return Settings;
    }
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-8">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Encryption status banner */}
      <div className={cn(
        'flex items-center gap-3 rounded-lg border p-3',
        encryptionAvailable
          ? 'border-success/30 bg-success/5'
          : 'border-warning/30 bg-warning/5'
      )}>
        {encryptionAvailable ? (
          <>
            <ShieldCheck className="h-5 w-5 text-success" />
            <span className="text-sm text-foreground">{t('encryptionAvailable')}</span>
          </>
        ) : (
          <>
            <ShieldAlert className="h-5 w-5 text-warning" />
            <span className="text-sm text-foreground">{t('encryptionUnavailable')}</span>
          </>
        )}
      </div>

      {/* Error display */}
      {error && (
        <div className="rounded-lg border border-destructive/30 bg-destructive/5 p-3">
          <p className="text-sm text-destructive">{error}</p>
        </div>
      )}

      {/* Secrets list or empty state */}
      {secrets.length === 0 ? (
        <div className="rounded-lg border border-dashed border-border bg-muted/30 p-8 text-center">
          <KeyRound className="h-12 w-12 mx-auto text-muted-foreground/50 mb-3" />
          <h3 className="text-sm font-medium text-foreground mb-1">{t('empty')}</h3>
          <p className="text-xs text-muted-foreground mb-4">{t('emptyDescription')}</p>
          <Button size="sm" onClick={handleAddSecret}>
            <Plus className="h-4 w-4 mr-2" />
            {t('addSecret')}
          </Button>
        </div>
      ) : (
        <div className="space-y-2">
          {secrets.map((secret) => {
            const Icon = getSecretIcon(secret.type);
            return (
              <div
                key={secret.id}
                className="flex items-center justify-between rounded-lg border border-border bg-card p-3"
              >
                <div className="flex items-center gap-3">
                  <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-muted">
                    <Icon className="h-5 w-5 text-muted-foreground" />
                  </div>
                  <div>
                    <div className="font-medium text-sm text-foreground">{secret.name}</div>
                    <div className="text-xs text-muted-foreground">
                      {t(`types.${secret.type}`)}
                      {secret.description && ` • ${secret.description}`}
                    </div>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-8 w-8"
                    onClick={() => handleEditSecret(secret.id)}
                    aria-label={t('editSecret')}
                  >
                    <Pencil className="h-4 w-4" />
                  </Button>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-8 w-8 text-destructive hover:text-destructive"
                    onClick={() => handleDeleteClick(secret)}
                    aria-label={t('deleteSecret')}
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            );
          })}

          {/* Add button */}
          <Button
            variant="outline"
            className="w-full"
            onClick={handleAddSecret}
          >
            <Plus className="h-4 w-4 mr-2" />
            {t('addSecret')}
          </Button>
        </div>
      )}

      {/* Edit Dialog */}
      <SecretEditDialog
        open={editDialogOpen}
        onOpenChange={(open) => !open && handleDialogClose(false)}
        projectPath={projectPath}
        secretId={editingSecretId}
        onSaved={() => handleDialogClose(true)}
      />

      {/* Delete Confirmation Dialog */}
      <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{t('deleteSecret')}</AlertDialogTitle>
            <AlertDialogDescription>
              {t('deleteSecretConfirm', { name: deletingSecret?.name })}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={isDeleting}>
              {t('actions.cancel')}
            </AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDeleteConfirm}
              disabled={isDeleting}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {isDeleting ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  {t('deleting')}
                </>
              ) : (
                t('actions.delete')
              )}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
