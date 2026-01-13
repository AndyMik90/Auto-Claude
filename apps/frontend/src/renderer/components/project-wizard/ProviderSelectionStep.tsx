import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Github, Server, X } from 'lucide-react';
import { Button } from '../ui/button';

interface ProviderSelectionStepProps {
  onComplete: (selection: { github: boolean; gitlab: boolean }) => void;
  onBack: () => void;
}

type Provider = 'github' | 'gitlab';

interface ProviderOption {
  id: Provider;
  icon: React.ReactNode;
  title: string;
  description: string;
}

/**
 * Provider selection step - allows users to choose which git hosting providers to configure
 */
export function ProviderSelectionStep({ onComplete, onBack }: ProviderSelectionStepProps) {
  const { t } = useTranslation('project-wizard');
  const [selectedProviders, setSelectedProviders] = useState<Set<Provider>>(new Set());

  const providers: ProviderOption[] = [
    {
      id: 'github',
      icon: <Github className="h-6 w-6" />,
      title: 'GitHub',
      description: 'Connect your GitHub repository for branch and PR management'
    },
    {
      id: 'gitlab',
      icon: <Server className="h-6 w-6" />,
      title: 'GitLab',
      description: 'Connect your GitLab project for merge request management'
    }
  ];

  const toggleProvider = (providerId: Provider) => {
    setSelectedProviders(prev => {
      const newSet = new Set(prev);
      if (newSet.has(providerId)) {
        newSet.delete(providerId);
      } else {
        newSet.add(providerId);
      }
      return newSet;
    });
  };

  const handleContinue = () => {
    onComplete({
      github: selectedProviders.has('github'),
      gitlab: selectedProviders.has('gitlab')
    });
  };

  const handleSkip = () => {
    onComplete({ github: false, gitlab: false });
  };

  return (
    <div className="flex h-full flex-col items-center justify-center px-8 py-6">
      <div className="w-full max-w-2xl">
        {/* Header */}
        <div className="text-center mb-8">
          <h1 className="text-3xl font-bold text-foreground tracking-tight mb-2">
            {t('provider.title')}
          </h1>
          <p className="text-muted-foreground text-lg">
            {t('provider.description')}
          </p>
          <p className="text-sm text-muted-foreground mt-2">
            {t('provider.optionalLabel')}
          </p>
        </div>

        {/* Provider Options */}
        <div className="grid md:grid-cols-2 gap-4 mb-8">
          {providers.map(provider => (
            <button
              key={provider.id}
              onClick={() => toggleProvider(provider.id)}
              className={`
                relative p-6 rounded-xl border-2 text-left transition-all
                ${
                  selectedProviders.has(provider.id)
                    ? 'border-primary bg-primary/5'
                    : 'border-border hover:border-primary/50 bg-card'
                }
              `}
            >
              {/* Selected Indicator */}
              {selectedProviders.has(provider.id) && (
                <div className="absolute top-4 right-4 flex h-6 w-6 items-center justify-center rounded-full bg-primary">
                  <X className="h-4 w-4 text-primary-foreground" />
                </div>
              )}

              {/* Icon */}
              <div className={`flex h-12 w-12 items-center justify-center rounded-xl mb-4 ${
                selectedProviders.has(provider.id)
                  ? 'bg-primary/10 text-primary'
                  : 'bg-muted text-muted-foreground'
              }`}>
                {provider.icon}
              </div>

              {/* Title */}
              <h3 className={`font-semibold mb-2 ${
                selectedProviders.has(provider.id)
                  ? 'text-foreground'
                  : 'text-muted-foreground'
              }`}>
                {provider.title}
              </h3>

              {/* Description */}
              <p className="text-sm text-muted-foreground">
                {provider.description}
              </p>
            </button>
          ))}
        </div>

        {/* Help Text */}
        <div className="text-center mb-8">
          <p className="text-sm text-muted-foreground">
            {t('provider.helpText')}
          </p>
        </div>

        {/* Actions */}
        <div className="flex items-center justify-between">
          <Button
            variant="ghost"
            onClick={onBack}
          >
            {t('project.back')}
          </Button>

          <div className="flex gap-3">
            <Button
              variant="ghost"
              onClick={handleSkip}
            >
              {t('provider.skip')}
            </Button>
            <Button
              onClick={handleContinue}
              className="gap-2"
            >
              {t('project.continue')}
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}
