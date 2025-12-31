import { useTranslation } from 'react-i18next';
import { SettingsSection } from './SettingsSection';
import { Switch } from '../ui/switch';
import { Label } from '../ui/label';
import { Slider } from '../ui/slider';
import { useSettings } from './hooks/useSettings';
import type { AppSettings } from '../../../shared/types';

interface ExperimentalSettingsProps {
  settings: AppSettings;
  onSettingsChange: (settings: AppSettings) => void;
}

// Define experimental features with their metadata
const EXPERIMENTAL_FEATURES = [
  {
    id: 'smartContext',
    name: 'Smart Context',
    description: 'Use AI to optimize context window usage'
  },
  {
    id: 'parallelAgents',
    name: 'Parallel Agents',
    description: 'Run multiple agents simultaneously for faster builds'
  },
  {
    id: 'incrementalQA',
    name: 'Incremental QA',
    description: 'Run QA after each subtask instead of at the end'
  },
  {
    id: 'autoMerge',
    name: 'Auto Merge',
    description: 'Automatically merge non-conflicting changes'
  },
  {
    id: 'enhancedMemory',
    name: 'Enhanced Memory',
    description: 'Use Graphiti for long-term memory across sessions'
  },
  {
    id: 'experimentalModels',
    name: 'Experimental Models',
    description: 'Enable access to experimental AI models'
  }
];

/**
 * Experimental Features settings component
 * Shows feature flags as slidable toggles
 */
export function ExperimentalSettings({ settings, onSettingsChange }: ExperimentalSettingsProps) {
  const { t } = useTranslation('settings');
  const features = settings.experimentalFeatures || {};

  const toggleFeature = (featureId: string, enabled: boolean) => {
    onSettingsChange({
      ...settings,
      experimentalFeatures: {
        ...features,
        [featureId]: enabled
      }
    });
  };

  return (
    <SettingsSection
      title="Experimental Features"
      description="Enable experimental features that are still in development"
    >
      <div className="space-y-6">
        <div className="rounded-lg border border-info/50 bg-info/5 p-4">
          <p className="text-sm text-info-foreground">
            Experimental features are under active development and may change or be removed at any time.
            Use with caution and report any issues you encounter.
          </p>
        </div>

        <div className="space-y-4">
          {EXPERIMENTAL_FEATURES.map((feature) => {
            const isEnabled = features[feature.id] || false;
            return (
              <div
                key={feature.id}
                className="flex items-center justify-between p-4 rounded-lg border border-border hover:bg-muted/50 transition-colors"
              >
                <div className="flex-1">
                  <Label htmlFor={`feature-${feature.id}`} className="font-medium text-foreground cursor-pointer">
                    {feature.name}
                  </Label>
                  <p className="text-sm text-muted-foreground mt-1">
                    {feature.description}
                  </p>
                </div>
                <Switch
                  id={`feature-${feature.id}`}
                  checked={isEnabled}
                  onCheckedChange={(checked) => toggleFeature(feature.id, checked)}
                />
              </div>
            );
          })}
        </div>

        {Object.keys(features).length === 0 && (
          <div className="text-center py-8 text-muted-foreground">
            <p className="text-sm">No experimental features enabled</p>
            <p className="text-xs mt-1">Toggle a feature above to try it out</p>
          </div>
        )}
      </div>
    </SettingsSection>
  );
}
