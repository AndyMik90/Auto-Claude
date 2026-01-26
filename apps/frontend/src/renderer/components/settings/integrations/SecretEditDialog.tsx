import { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { Loader2, Plus, Trash2, Eye, EyeOff } from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '../../ui/dialog';
import { Button } from '../../ui/button';
import { Input } from '../../ui/input';
import { Label } from '../../ui/label';
import { Textarea } from '../../ui/textarea';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '../../ui/select';
import type {
  Secret,
  SecretType,
  CreateSecretInput,
  UpdateSecretInput,
  AWSSecretData,
  DatabaseSecretData,
  APIKeySecretData,
  SSHSecretData,
  CustomSecretData
} from '../../../../shared/types/secrets';

interface SecretEditDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  projectPath: string;
  secretId: string | null;
  onSaved: () => void;
}

type FormData = {
  name: string;
  description: string;
  type: SecretType | '';
  // AWS fields
  awsAccessKeyId: string;
  awsSecretAccessKey: string;
  awsRegion: string;
  awsSessionToken: string;
  // Database fields
  dbEngine: DatabaseSecretData['engine'] | '';
  dbHost: string;
  dbPort: string;
  dbDatabase: string;
  dbUsername: string;
  dbPassword: string;
  dbSsl: 'disable' | 'prefer' | 'require';
  // API Key fields
  apiUrl: string;
  apiKey: string;
  apiHeaderName: string;
  apiHeaderPrefix: string;
  // SSH fields
  sshHost: string;
  sshPort: string;
  sshUsername: string;
  sshPrivateKey: string;
  sshPassphrase: string;
  // Custom fields
  customFields: Array<{ key: string; value: string }>;
};

const initialFormData: FormData = {
  name: '',
  description: '',
  type: '',
  awsAccessKeyId: '',
  awsSecretAccessKey: '',
  awsRegion: '',
  awsSessionToken: '',
  dbEngine: '',
  dbHost: '',
  dbPort: '',
  dbDatabase: '',
  dbUsername: '',
  dbPassword: '',
  dbSsl: 'prefer',
  apiUrl: '',
  apiKey: '',
  apiHeaderName: '',
  apiHeaderPrefix: '',
  sshHost: '',
  sshPort: '',
  sshUsername: '',
  sshPrivateKey: '',
  sshPassphrase: '',
  customFields: [{ key: '', value: '' }],
};

const SECRET_TYPES: SecretType[] = ['aws', 'database', 'api_key', 'ssh', 'custom'];
const DB_ENGINES: DatabaseSecretData['engine'][] = ['postgres', 'mysql', 'redshift', 'sqlite', 'mongodb'];

export function SecretEditDialog({
  open,
  onOpenChange,
  projectPath,
  secretId,
  onSaved
}: SecretEditDialogProps) {
  const { t } = useTranslation('secrets');
  const [formData, setFormData] = useState<FormData>(initialFormData);
  const [isLoading, setIsLoading] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showPasswords, setShowPasswords] = useState<Record<string, boolean>>({});

  const isEditing = !!secretId;

  // Load existing secret data when editing
  useEffect(() => {
    if (open && secretId) {
      setIsLoading(true);
      setError(null);
      window.electronAPI.getSecret(projectPath, secretId)
        .then((result) => {
          if (result.success && result.data) {
            populateFormFromSecret(result.data);
          } else {
            setError(result.error || 'Failed to load secret');
          }
        })
        .catch(() => setError('Failed to load secret'))
        .finally(() => setIsLoading(false));
    } else if (open) {
      setFormData(initialFormData);
      setError(null);
    }
  }, [open, secretId, projectPath]);

  const populateFormFromSecret = (secret: Secret) => {
    const newFormData: FormData = {
      ...initialFormData,
      name: secret.name,
      description: secret.description || '',
      type: secret.type,
    };

    switch (secret.type) {
      case 'aws': {
        const data = secret.data as AWSSecretData;
        newFormData.awsAccessKeyId = data.accessKeyId;
        newFormData.awsSecretAccessKey = data.secretAccessKey;
        newFormData.awsRegion = data.region;
        newFormData.awsSessionToken = data.sessionToken || '';
        break;
      }
      case 'database': {
        const data = secret.data as DatabaseSecretData;
        newFormData.dbEngine = data.engine;
        newFormData.dbHost = data.host;
        newFormData.dbPort = String(data.port);
        newFormData.dbDatabase = data.database;
        newFormData.dbUsername = data.username;
        newFormData.dbPassword = data.password;
        newFormData.dbSsl = (data.ssl as 'disable' | 'prefer' | 'require') || 'prefer';
        break;
      }
      case 'api_key': {
        const data = secret.data as APIKeySecretData;
        newFormData.apiUrl = data.url || '';
        newFormData.apiKey = data.key;
        newFormData.apiHeaderName = data.headerName || '';
        newFormData.apiHeaderPrefix = data.headerPrefix || '';
        break;
      }
      case 'ssh': {
        const data = secret.data as SSHSecretData;
        newFormData.sshHost = data.host;
        newFormData.sshPort = data.port ? String(data.port) : '';
        newFormData.sshUsername = data.username;
        newFormData.sshPrivateKey = data.privateKey;
        newFormData.sshPassphrase = data.passphrase || '';
        break;
      }
      case 'custom': {
        const data = secret.data as CustomSecretData;
        newFormData.customFields = Object.entries(data.fields).map(([key, value]) => ({
          key,
          value: value as string
        }));
        if (newFormData.customFields.length === 0) {
          newFormData.customFields = [{ key: '', value: '' }];
        }
        break;
      }
    }

    setFormData(newFormData);
  };

  const validateForm = (): string | null => {
    if (!formData.name.trim()) return t('validation.nameRequired');
    if (!formData.type) return t('validation.typeRequired');

    switch (formData.type) {
      case 'aws':
        if (!formData.awsAccessKeyId) return t('validation.accessKeyIdRequired');
        if (!formData.awsSecretAccessKey) return t('validation.secretAccessKeyRequired');
        if (!formData.awsRegion) return t('validation.regionRequired');
        break;
      case 'database':
        if (!formData.dbHost) return t('validation.hostRequired');
        if (!formData.dbPort) return t('validation.portRequired');
        if (!formData.dbDatabase) return t('validation.databaseRequired');
        if (!formData.dbUsername) return t('validation.usernameRequired');
        if (!formData.dbPassword) return t('validation.passwordRequired');
        break;
      case 'api_key':
        if (!formData.apiKey) return t('validation.keyRequired');
        break;
      case 'ssh':
        if (!formData.sshHost) return t('validation.hostRequired');
        if (!formData.sshUsername) return t('validation.usernameRequired');
        if (!formData.sshPrivateKey) return t('validation.privateKeyRequired');
        break;
    }

    return null;
  };

  const buildSecretData = (): CreateSecretInput | UpdateSecretInput => {
    const base = {
      name: formData.name.trim(),
      description: formData.description.trim() || undefined,
    };

    switch (formData.type) {
      case 'aws':
        return {
          ...base,
          type: 'aws',
          data: {
            accessKeyId: formData.awsAccessKeyId,
            secretAccessKey: formData.awsSecretAccessKey,
            region: formData.awsRegion,
            sessionToken: formData.awsSessionToken || undefined,
          },
        };
      case 'database':
        return {
          ...base,
          type: 'database',
          data: {
            engine: formData.dbEngine as DatabaseSecretData['engine'],
            host: formData.dbHost,
            port: parseInt(formData.dbPort, 10),
            database: formData.dbDatabase,
            username: formData.dbUsername,
            password: formData.dbPassword,
            ssl: formData.dbSsl,
          },
        };
      case 'api_key':
        return {
          ...base,
          type: 'api_key',
          data: {
            url: formData.apiUrl || undefined,
            key: formData.apiKey,
            headerName: formData.apiHeaderName || undefined,
            headerPrefix: formData.apiHeaderPrefix || undefined,
          },
        };
      case 'ssh':
        return {
          ...base,
          type: 'ssh',
          data: {
            host: formData.sshHost,
            port: formData.sshPort ? parseInt(formData.sshPort, 10) : undefined,
            username: formData.sshUsername,
            privateKey: formData.sshPrivateKey,
            passphrase: formData.sshPassphrase || undefined,
          },
        };
      case 'custom':
        return {
          ...base,
          type: 'custom',
          data: {
            fields: formData.customFields
              .filter(f => f.key.trim())
              .reduce((acc, f) => ({ ...acc, [f.key.trim()]: f.value }), {}),
          },
        };
      default:
        throw new Error('Invalid secret type');
    }
  };

  const handleSave = async () => {
    const validationError = validateForm();
    if (validationError) {
      setError(validationError);
      return;
    }

    setIsSaving(true);
    setError(null);

    try {
      const secretData = buildSecretData();
      const result = isEditing
        ? await window.electronAPI.updateSecret(projectPath, secretId!, secretData as UpdateSecretInput)
        : await window.electronAPI.createSecret(projectPath, secretData as CreateSecretInput);

      if (result.success) {
        onSaved();
        onOpenChange(false);
      } else {
        setError(result.error || (isEditing ? t('errors.updateFailed') : t('errors.createFailed')));
      }
    } catch {
      setError(isEditing ? t('errors.updateFailed') : t('errors.createFailed'));
    } finally {
      setIsSaving(false);
    }
  };

  const toggleShowPassword = (field: string) => {
    setShowPasswords(prev => ({ ...prev, [field]: !prev[field] }));
  };

  const updateField = <K extends keyof FormData>(field: K, value: FormData[K]) => {
    setFormData(prev => ({ ...prev, [field]: value }));
    setError(null);
  };

  const addCustomField = () => {
    setFormData(prev => ({
      ...prev,
      customFields: [...prev.customFields, { key: '', value: '' }]
    }));
  };

  const removeCustomField = (index: number) => {
    setFormData(prev => ({
      ...prev,
      customFields: prev.customFields.filter((_, i) => i !== index)
    }));
  };

  const updateCustomField = (index: number, field: 'key' | 'value', value: string) => {
    setFormData(prev => ({
      ...prev,
      customFields: prev.customFields.map((f, i) =>
        i === index ? { ...f, [field]: value } : f
      )
    }));
  };

  const renderPasswordInput = (
    field: string,
    value: string,
    onChange: (value: string) => void,
    placeholder: string
  ) => (
    <div className="relative">
      <Input
        type={showPasswords[field] ? 'text' : 'password'}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        className="pr-10"
      />
      <button
        type="button"
        onClick={() => toggleShowPassword(field)}
        className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
      >
        {showPasswords[field] ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
      </button>
    </div>
  );

  const renderTypeSpecificFields = () => {
    switch (formData.type) {
      case 'aws':
        return (
          <div className="space-y-4">
            <div className="space-y-2">
              <Label>{t('form.aws.accessKeyId')}</Label>
              <Input
                value={formData.awsAccessKeyId}
                onChange={(e) => updateField('awsAccessKeyId', e.target.value)}
                placeholder={t('form.aws.accessKeyIdPlaceholder')}
              />
            </div>
            <div className="space-y-2">
              <Label>{t('form.aws.secretAccessKey')}</Label>
              {renderPasswordInput(
                'awsSecretAccessKey',
                formData.awsSecretAccessKey,
                (v) => updateField('awsSecretAccessKey', v),
                t('form.aws.secretAccessKeyPlaceholder')
              )}
            </div>
            <div className="space-y-2">
              <Label>{t('form.aws.region')}</Label>
              <Input
                value={formData.awsRegion}
                onChange={(e) => updateField('awsRegion', e.target.value)}
                placeholder={t('form.aws.regionPlaceholder')}
              />
            </div>
            <div className="space-y-2">
              <Label>{t('form.aws.sessionToken')}</Label>
              {renderPasswordInput(
                'awsSessionToken',
                formData.awsSessionToken,
                (v) => updateField('awsSessionToken', v),
                t('form.aws.sessionTokenPlaceholder')
              )}
            </div>
          </div>
        );

      case 'database':
        return (
          <div className="space-y-4">
            <div className="space-y-2">
              <Label>{t('form.database.engine')}</Label>
              <Select
                value={formData.dbEngine}
                onValueChange={(v) => updateField('dbEngine', v as DatabaseSecretData['engine'])}
              >
                <SelectTrigger>
                  <SelectValue placeholder={t('form.database.selectEngine')} />
                </SelectTrigger>
                <SelectContent>
                  {DB_ENGINES.map((engine) => (
                    <SelectItem key={engine} value={engine}>
                      {engine.charAt(0).toUpperCase() + engine.slice(1)}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>{t('form.database.host')}</Label>
                <Input
                  value={formData.dbHost}
                  onChange={(e) => updateField('dbHost', e.target.value)}
                  placeholder={t('form.database.hostPlaceholder')}
                />
              </div>
              <div className="space-y-2">
                <Label>{t('form.database.port')}</Label>
                <Input
                  type="number"
                  value={formData.dbPort}
                  onChange={(e) => updateField('dbPort', e.target.value)}
                  placeholder={t('form.database.portPlaceholder')}
                />
              </div>
            </div>
            <div className="space-y-2">
              <Label>{t('form.database.database')}</Label>
              <Input
                value={formData.dbDatabase}
                onChange={(e) => updateField('dbDatabase', e.target.value)}
                placeholder={t('form.database.databasePlaceholder')}
              />
            </div>
            <div className="space-y-2">
              <Label>{t('form.database.username')}</Label>
              <Input
                value={formData.dbUsername}
                onChange={(e) => updateField('dbUsername', e.target.value)}
                placeholder={t('form.database.usernamePlaceholder')}
              />
            </div>
            <div className="space-y-2">
              <Label>{t('form.database.password')}</Label>
              {renderPasswordInput(
                'dbPassword',
                formData.dbPassword,
                (v) => updateField('dbPassword', v),
                t('form.database.passwordPlaceholder')
              )}
            </div>
            <div className="space-y-2">
              <Label>{t('form.database.ssl')}</Label>
              <Select
                value={formData.dbSsl}
                onValueChange={(v) => updateField('dbSsl', v as 'disable' | 'prefer' | 'require')}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="disable">{t('form.database.sslOptions.disable')}</SelectItem>
                  <SelectItem value="prefer">{t('form.database.sslOptions.prefer')}</SelectItem>
                  <SelectItem value="require">{t('form.database.sslOptions.require')}</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
        );

      case 'api_key':
        return (
          <div className="space-y-4">
            <div className="space-y-2">
              <Label>{t('form.api_key.url')}</Label>
              <Input
                type="url"
                value={formData.apiUrl}
                onChange={(e) => updateField('apiUrl', e.target.value)}
                placeholder={t('form.api_key.urlPlaceholder')}
              />
            </div>
            <div className="space-y-2">
              <Label>{t('form.api_key.key')}</Label>
              {renderPasswordInput(
                'apiKey',
                formData.apiKey,
                (v) => updateField('apiKey', v),
                t('form.api_key.keyPlaceholder')
              )}
            </div>
            <div className="space-y-2">
              <Label>{t('form.api_key.headerName')}</Label>
              <Input
                value={formData.apiHeaderName}
                onChange={(e) => updateField('apiHeaderName', e.target.value)}
                placeholder={t('form.api_key.headerNamePlaceholder')}
              />
            </div>
            <div className="space-y-2">
              <Label>{t('form.api_key.headerPrefix')}</Label>
              <Input
                value={formData.apiHeaderPrefix}
                onChange={(e) => updateField('apiHeaderPrefix', e.target.value)}
                placeholder={t('form.api_key.headerPrefixPlaceholder')}
              />
            </div>
          </div>
        );

      case 'ssh':
        return (
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>{t('form.ssh.host')}</Label>
                <Input
                  value={formData.sshHost}
                  onChange={(e) => updateField('sshHost', e.target.value)}
                  placeholder={t('form.ssh.hostPlaceholder')}
                />
              </div>
              <div className="space-y-2">
                <Label>{t('form.ssh.port')}</Label>
                <Input
                  type="number"
                  value={formData.sshPort}
                  onChange={(e) => updateField('sshPort', e.target.value)}
                  placeholder={t('form.ssh.portPlaceholder')}
                />
              </div>
            </div>
            <div className="space-y-2">
              <Label>{t('form.ssh.username')}</Label>
              <Input
                value={formData.sshUsername}
                onChange={(e) => updateField('sshUsername', e.target.value)}
                placeholder={t('form.ssh.usernamePlaceholder')}
              />
            </div>
            <div className="space-y-2">
              <Label>{t('form.ssh.privateKey')}</Label>
              <Textarea
                value={formData.sshPrivateKey}
                onChange={(e) => updateField('sshPrivateKey', e.target.value)}
                placeholder={t('form.ssh.privateKeyPlaceholder')}
                rows={6}
                className="font-mono text-xs"
              />
            </div>
            <div className="space-y-2">
              <Label>{t('form.ssh.passphrase')}</Label>
              {renderPasswordInput(
                'sshPassphrase',
                formData.sshPassphrase,
                (v) => updateField('sshPassphrase', v),
                t('form.ssh.passphrasePlaceholder')
              )}
            </div>
          </div>
        );

      case 'custom':
        return (
          <div className="space-y-4">
            {formData.customFields.map((field, index) => (
              <div key={index} className="flex items-start gap-2">
                <div className="flex-1 space-y-2">
                  <Input
                    value={field.key}
                    onChange={(e) => updateCustomField(index, 'key', e.target.value)}
                    placeholder={t('form.custom.keyPlaceholder')}
                  />
                </div>
                <div className="flex-1 space-y-2">
                  {renderPasswordInput(
                    `custom-${index}`,
                    field.value,
                    (v) => updateCustomField(index, 'value', v),
                    t('form.custom.valuePlaceholder')
                  )}
                </div>
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  className="shrink-0 mt-0"
                  onClick={() => removeCustomField(index)}
                  disabled={formData.customFields.length === 1}
                >
                  <Trash2 className="h-4 w-4" />
                </Button>
              </div>
            ))}
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={addCustomField}
            >
              <Plus className="h-4 w-4 mr-2" />
              {t('form.custom.addField')}
            </Button>
          </div>
        );

      default:
        return null;
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>
            {isEditing ? t('editSecret') : t('addSecret')}
          </DialogTitle>
          <DialogDescription>
            {t('description')}
          </DialogDescription>
        </DialogHeader>

        {isLoading ? (
          <div className="flex items-center justify-center py-8">
            <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
          </div>
        ) : (
          <div className="space-y-4 py-4">
            {/* Error display */}
            {error && (
              <div className="rounded-lg border border-destructive/30 bg-destructive/5 p-3">
                <p className="text-sm text-destructive">{error}</p>
              </div>
            )}

            {/* Name field */}
            <div className="space-y-2">
              <Label>{t('form.name')}</Label>
              <Input
                value={formData.name}
                onChange={(e) => updateField('name', e.target.value)}
                placeholder={t('form.namePlaceholder')}
              />
              <p className="text-xs text-muted-foreground">{t('form.nameHelp')}</p>
            </div>

            {/* Description field */}
            <div className="space-y-2">
              <Label>{t('form.description')}</Label>
              <Input
                value={formData.description}
                onChange={(e) => updateField('description', e.target.value)}
                placeholder={t('form.descriptionPlaceholder')}
              />
            </div>

            {/* Type selector */}
            <div className="space-y-2">
              <Label>{t('form.type')}</Label>
              <Select
                value={formData.type}
                onValueChange={(v) => updateField('type', v as SecretType)}
                disabled={isEditing}
              >
                <SelectTrigger>
                  <SelectValue placeholder={t('form.selectType')} />
                </SelectTrigger>
                <SelectContent>
                  {SECRET_TYPES.map((type) => (
                    <SelectItem key={type} value={type}>
                      <div className="flex flex-col">
                        <span>{t(`types.${type}`)}</span>
                        <span className="text-xs text-muted-foreground">
                          {t(`typeDescriptions.${type}`)}
                        </span>
                      </div>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Type-specific fields */}
            {formData.type && renderTypeSpecificFields()}
          </div>
        )}

        <DialogFooter>
          <Button
            variant="outline"
            onClick={() => onOpenChange(false)}
            disabled={isSaving}
          >
            {t('actions.cancel')}
          </Button>
          <Button
            onClick={handleSave}
            disabled={isSaving || isLoading}
          >
            {isSaving ? (
              <>
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                {t('actions.saving')}
              </>
            ) : (
              t('actions.save')
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
