import { useState, useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import { Settings2, ExternalLink, AlertTriangle, ChevronDown, ChevronRight } from 'lucide-react';
import { Button } from '../ui/button';
import { Label } from '../ui/label';
import { Switch } from '../ui/switch';
import { Input } from '../ui/input';
import { RadioGroup, RadioGroupItem } from '../ui/radio-group';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '../ui/select';
import { Separator } from '../ui/separator';
import { PasswordInput } from '../project-settings/PasswordInput';
import type { AppSettings, BedrockConfig, BedrockAuthMethod } from '../../../shared/types';

const SECRET_PLACEHOLDER = '••••••••';

interface SecretFieldInputProps {
  readonly value: string | undefined;
  readonly onChange: (value: string) => void;
  readonly placeholder: string;
  readonly hint?: string;
}

interface BedrockSettingsProps {
  readonly settings: AppSettings;
  readonly onSettingsChange: (settings: AppSettings) => void;
}

const AWS_REGIONS = [
  'us-east-1',
  'us-west-2',
  'eu-west-1',
  'eu-west-3',
  'eu-central-1',
  'ap-northeast-1',
  'ap-southeast-1',
  'ap-southeast-2',
] as const;

function SecretFieldInput({ value, onChange, placeholder, hint }: SecretFieldInputProps) {
  const { t } = useTranslation(['common']);
  const [isEditing, setIsEditing] = useState(false);
  const [editValue, setEditValue] = useState('');
  
  const hasExistingValue = Boolean(value);
  
  const handleStartEdit = useCallback(() => {
    setIsEditing(true);
    setEditValue('');
  }, []);
  
  const handleSave = useCallback(() => {
    if (editValue) {
      onChange(editValue);
    }
    setIsEditing(false);
    setEditValue('');
  }, [editValue, onChange]);
  
  const handleClear = useCallback(() => {
    onChange('');
    setIsEditing(false);
    setEditValue('');
  }, [onChange]);
  
  const handleCancel = useCallback(() => {
    setIsEditing(false);
    setEditValue('');
  }, []);
  
  if (hasExistingValue && !isEditing) {
    return (
      <div className="space-y-2">
        <div className="flex items-center gap-2">
          <Input 
            value={SECRET_PLACEHOLDER}
            disabled
            className="font-mono flex-1"
          />
          <Button variant="outline" size="sm" onClick={handleStartEdit}>
            Change
          </Button>
          <Button variant="ghost" size="sm" onClick={handleClear}>
            Clear
          </Button>
        </div>
        {hint && <p className="text-xs text-muted-foreground">{hint}</p>}
      </div>
    );
  }
  
  if (isEditing) {
    return (
      <div className="space-y-2">
        <div className="flex items-center gap-2">
          <PasswordInput
            placeholder={placeholder}
            value={editValue}
            onChange={setEditValue}
            className="flex-1"
          />
          <Button variant="default" size="sm" onClick={handleSave} disabled={!editValue}>
            {t('common:buttons.save')}
          </Button>
          <Button variant="ghost" size="sm" onClick={handleCancel}>
            {t('common:buttons.cancel')}
          </Button>
        </div>
        {hint && <p className="text-xs text-muted-foreground">{hint}</p>}
      </div>
    );
  }
  
  return (
    <div className="space-y-2">
      <PasswordInput
        placeholder={placeholder}
        value=""
        onChange={onChange}
      />
      {hint && <p className="text-xs text-muted-foreground">{hint}</p>}
    </div>
  );
}

function getStatusLabel(
  isEnabled: boolean,
  hasRegion: boolean,
  hasCredentials: boolean,
  t: (key: string) => string
): string {
  if (!isEnabled) {
    return t('settings:bedrock.status.disabled');
  }
  if (!hasRegion) {
    return t('settings:bedrock.status.missingRegion');
  }
  if (hasCredentials) {
    return t('settings:bedrock.status.configured');
  }
  return t('settings:bedrock.status.missingCredentials');
}

function getStatusColor(isEnabled: boolean, hasRegion: boolean, hasCredentials: boolean): string {
  if (isEnabled && hasRegion && hasCredentials) {
    return 'text-success';
  }
  if (isEnabled) {
    return 'text-warning';
  }
  return 'text-muted-foreground';
}

export function BedrockSettings({ settings, onSettingsChange }: BedrockSettingsProps) {
  const { t } = useTranslation(['settings']);
  const [isExpanded, setIsExpanded] = useState(settings.bedrockEnabled || false);

  const bedrockConfig: BedrockConfig = settings.bedrockConfig || {
    authMethod: 'sso_profile',
    awsRegion: 'us-east-1',
  };

  const isEnabled = settings.bedrockEnabled || false;

  const handleUpdateBedrockConfig = (updates: Partial<BedrockConfig>) => {
    onSettingsChange({
      ...settings,
      bedrockConfig: {
        ...bedrockConfig,
        ...updates,
      },
    });
  };

  const handleAuthMethodChange = (method: BedrockAuthMethod) => {
    const newConfig: BedrockConfig = {
      ...bedrockConfig,
      authMethod: method,
      awsProfile: method === 'sso_profile' ? bedrockConfig.awsProfile : undefined,
      awsAccessKeyId: method === 'access_keys' ? bedrockConfig.awsAccessKeyId : undefined,
      awsSecretAccessKey: method === 'access_keys' ? bedrockConfig.awsSecretAccessKey : undefined,
      awsSessionToken: method === 'access_keys' ? bedrockConfig.awsSessionToken : undefined,
      awsBearerTokenBedrock: method === 'api_key' ? bedrockConfig.awsBearerTokenBedrock : undefined,
    };

    onSettingsChange({
      ...settings,
      bedrockConfig: newConfig,
    });
  };

  const handleToggleExpanded = () => {
    setIsExpanded(!isExpanded);
  };

  const hasRegion = Boolean(bedrockConfig.awsRegion);
  const hasCredentials = Boolean(
    (bedrockConfig.authMethod === 'sso_profile' && bedrockConfig.awsProfile) ||
    (bedrockConfig.authMethod === 'access_keys' && bedrockConfig.awsAccessKeyId && bedrockConfig.awsSecretAccessKey) ||
    (bedrockConfig.authMethod === 'api_key' && bedrockConfig.awsBearerTokenBedrock)
  );

  const statusLabel = getStatusLabel(isEnabled, hasRegion, hasCredentials, t);
  const statusColor = getStatusColor(isEnabled, hasRegion, hasCredentials);

  return (
    <div className="space-y-4 rounded-lg border border-border p-4">
      <button 
        type="button"
        className="flex items-center justify-between cursor-pointer w-full text-left bg-transparent border-0 p-0"
        onClick={handleToggleExpanded}
      >
        <div className="flex items-center gap-3">
          <Settings2 className="h-5 w-5 text-muted-foreground" />
          <div>
            <h3 className="text-sm font-medium">{t('settings:bedrock.title')}</h3>
            <p className={`text-xs ${statusColor}`}>{statusLabel}</p>
          </div>
        </div>
        <div className="flex items-center gap-3">
          <Switch
            checked={isEnabled}
            onCheckedChange={(checked) => {
              onSettingsChange({ ...settings, bedrockEnabled: checked });
              if (checked) setIsExpanded(true);
            }}
            onClick={(e) => e.stopPropagation()}
          />
          {isExpanded ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
        </div>
      </button>

      {isExpanded && (
        <div className="space-y-4 pt-2">
          <p className="text-xs text-muted-foreground">
            {t('settings:bedrock.description')}
          </p>

          {isEnabled && (
            <div className="rounded-lg border border-warning/30 bg-warning/5 p-3 flex gap-2 items-start">
              <AlertTriangle className="h-4 w-4 text-warning shrink-0 mt-0.5" />
              <p className="text-xs text-warning">
                {t('settings:bedrock.mutualExclusiveWarning')}
              </p>
            </div>
          )}

          {isEnabled && (
            <>
              <Separator />

              <div className="space-y-2">
                <Label className="text-sm font-medium">{t('settings:bedrock.region.label')}</Label>
                <Select
                  value={bedrockConfig.awsRegion}
                  onValueChange={(value) => handleUpdateBedrockConfig({ awsRegion: value })}
                >
                  <SelectTrigger>
                    <SelectValue placeholder={t('settings:bedrock.region.placeholder')} />
                  </SelectTrigger>
                  <SelectContent>
                    {AWS_REGIONS.map((region) => (
                      <SelectItem key={region} value={region}>
                        {t(`settings:bedrock.regions.${region}`)} ({region})
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-3">
                <Label className="text-sm font-medium">{t('settings:bedrock.authMethod.label')}</Label>
                
                <RadioGroup
                  value={bedrockConfig.authMethod}
                  onValueChange={(value) => handleAuthMethodChange(value as BedrockAuthMethod)}
                  className="grid grid-cols-1 gap-2"
                >
                  <div className="flex items-start space-x-3 rounded-md border p-3 hover:bg-muted/50 transition-colors">
                    <RadioGroupItem value="sso_profile" id="bedrock_sso_profile" className="mt-1" />
                    <div className="space-y-0.5">
                      <Label htmlFor="bedrock_sso_profile" className="font-medium cursor-pointer text-sm">
                        {t('settings:bedrock.authMethods.sso_profile.title')}
                      </Label>
                      <p className="text-xs text-muted-foreground">
                        {t('settings:bedrock.authMethods.sso_profile.description')}
                      </p>
                    </div>
                  </div>

                  <div className="flex items-start space-x-3 rounded-md border p-3 hover:bg-muted/50 transition-colors">
                    <RadioGroupItem value="access_keys" id="bedrock_access_keys" className="mt-1" />
                    <div className="space-y-0.5">
                      <Label htmlFor="bedrock_access_keys" className="font-medium cursor-pointer text-sm">
                        {t('settings:bedrock.authMethods.access_keys.title')}
                      </Label>
                      <p className="text-xs text-muted-foreground">
                        {t('settings:bedrock.authMethods.access_keys.description')}
                      </p>
                    </div>
                  </div>

                  <div className="flex items-start space-x-3 rounded-md border p-3 hover:bg-muted/50 transition-colors">
                    <RadioGroupItem value="api_key" id="bedrock_api_key" className="mt-1" />
                    <div className="space-y-0.5">
                      <Label htmlFor="bedrock_api_key" className="font-medium cursor-pointer text-sm">
                        {t('settings:bedrock.authMethods.api_key.title')}
                      </Label>
                      <p className="text-xs text-muted-foreground">
                        {t('settings:bedrock.authMethods.api_key.description')}
                      </p>
                    </div>
                  </div>
                </RadioGroup>
              </div>

              <div className="space-y-4 pt-2">
                {bedrockConfig.authMethod === 'sso_profile' && (
                  <div className="space-y-2">
                    <Label>{t('settings:bedrock.fields.ssoProfile.label')}</Label>
                    <Input
                      placeholder={t('settings:bedrock.fields.ssoProfile.placeholder')}
                      value={bedrockConfig.awsProfile || ''}
                      onChange={(e) => handleUpdateBedrockConfig({ awsProfile: e.target.value })}
                    />
                    <p className="text-xs text-muted-foreground">{t('settings:bedrock.fields.ssoProfile.hint')}</p>
                  </div>
                )}

                {bedrockConfig.authMethod === 'access_keys' && (
                  <>
                    <div className="space-y-2">
                      <Label>{t('settings:bedrock.fields.accessKeyId.label')}</Label>
                      <PasswordInput
                        placeholder={t('settings:bedrock.fields.accessKeyId.placeholder')}
                        value={bedrockConfig.awsAccessKeyId || ''}
                        onChange={(value) => handleUpdateBedrockConfig({ awsAccessKeyId: value })}
                      />
                    </div>
                    <div className="space-y-2">
                      <Label>{t('settings:bedrock.fields.secretAccessKey.label')}</Label>
                      <SecretFieldInput
                        placeholder={t('settings:bedrock.fields.secretAccessKey.placeholder')}
                        value={bedrockConfig.awsSecretAccessKey}
                        onChange={(value) => handleUpdateBedrockConfig({ awsSecretAccessKey: value })}
                      />
                    </div>
                    <div className="space-y-2">
                      <Label>{t('settings:bedrock.fields.sessionToken.label')}</Label>
                      <SecretFieldInput
                        placeholder={t('settings:bedrock.fields.sessionToken.placeholder')}
                        value={bedrockConfig.awsSessionToken}
                        onChange={(value) => handleUpdateBedrockConfig({ awsSessionToken: value })}
                        hint={t('settings:bedrock.fields.sessionToken.hint')}
                      />
                    </div>
                    <div className="rounded-lg border border-warning/30 bg-warning/5 p-3">
                      <p className="text-xs text-warning">
                        {t('settings:bedrock.securityWarning.accessKeysWarning')}
                      </p>
                    </div>
                  </>
                )}

                {bedrockConfig.authMethod === 'api_key' && (
                  <div className="space-y-2">
                    <Label>{t('settings:bedrock.fields.bedrockApiKey.label')}</Label>
                    <SecretFieldInput
                      placeholder={t('settings:bedrock.fields.bedrockApiKey.placeholder')}
                      value={bedrockConfig.awsBearerTokenBedrock}
                      onChange={(value) => handleUpdateBedrockConfig({ awsBearerTokenBedrock: value })}
                      hint={t('settings:bedrock.fields.bedrockApiKey.hint')}
                    />
                  </div>
                )}
              </div>

              <div className="pt-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => window.open('https://docs.anthropic.com/en/docs/build-with-claude/claude-code/bedrock', '_blank')}
                >
                  <ExternalLink className="h-4 w-4 mr-2" />
                  {t('settings:bedrock.actions.viewDocs')}
                </Button>
              </div>

              <Separator />

              <div className="space-y-4">
                <div>
                  <Label className="text-sm font-medium">{t('settings:bedrock.modelOverrides.title')}</Label>
                  <p className="text-xs text-muted-foreground mb-2">{t('settings:bedrock.modelOverrides.description')}</p>
                </div>
                <div className="space-y-2">
                  <Label>{t('settings:bedrock.modelOverrides.primaryModel.label')}</Label>
                  <Input
                    placeholder={t('settings:bedrock.modelOverrides.primaryModel.placeholder')}
                    value={bedrockConfig.anthropicModel || ''}
                    onChange={(e) => handleUpdateBedrockConfig({ anthropicModel: e.target.value })}
                  />
                  <p className="text-xs text-muted-foreground">{t('settings:bedrock.modelOverrides.primaryModel.hint')}</p>
                </div>
                <div className="space-y-2">
                  <Label>{t('settings:bedrock.modelOverrides.fastModel.label')}</Label>
                  <Input
                    placeholder={t('settings:bedrock.modelOverrides.fastModel.placeholder')}
                    value={bedrockConfig.anthropicSmallFastModel || ''}
                    onChange={(e) => handleUpdateBedrockConfig({ anthropicSmallFastModel: e.target.value })}
                  />
                  <p className="text-xs text-muted-foreground">{t('settings:bedrock.modelOverrides.fastModel.hint')}</p>
                </div>
              </div>
            </>
          )}
        </div>
      )}
    </div>
  );
}
