import { type ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import {
  LayoutGrid,
  Sparkles,
  Map,
  Lightbulb,
  FileText,
  GitPullRequest,
  BarChart3,
} from 'lucide-react';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '../ui/tabs';
import { cn } from '../../lib/utils';
import type { FeatureType } from '../../../shared/types/analytics';

/**
 * Feature tab configuration with icon and translation key
 */
interface FeatureTabConfig {
  value: FeatureType | 'overview';
  labelKey: string;
  icon: typeof LayoutGrid;
}

/**
 * Feature tabs configuration
 */
const FEATURE_TABS: FeatureTabConfig[] = [
  { value: 'overview', labelKey: 'analytics:features.overview', icon: BarChart3 },
  { value: 'kanban', labelKey: 'analytics:features.kanban', icon: LayoutGrid },
  { value: 'insights', labelKey: 'analytics:features.insights', icon: Sparkles },
  { value: 'roadmap', labelKey: 'analytics:features.roadmap', icon: Map },
  { value: 'ideation', labelKey: 'analytics:features.ideation', icon: Lightbulb },
  { value: 'changelog', labelKey: 'analytics:features.changelog', icon: FileText },
  { value: 'github-prs', labelKey: 'analytics:features.githubPRs', icon: GitPullRequest },
];

/**
 * Props for the FeatureTabs component
 */
export interface FeatureTabsProps {
  /** Currently active feature tab */
  activeFeature: FeatureType | 'overview';
  /** Callback when feature tab changes */
  onFeatureChange: (feature: FeatureType | 'overview') => void;
  /** Content to render for each tab (keyed by feature) */
  children?: ReactNode;
  /** Optional additional className for the container */
  className?: string;
  /** Whether the tabs are disabled */
  disabled?: boolean;
  /** Optional variant for compact display */
  variant?: 'default' | 'compact';
}

/**
 * FeatureTabs component for segmenting analytics by feature.
 *
 * Provides tabs for Overview and each feature type:
 * - Overview: All features combined
 * - Kanban Board
 * - Insights
 * - Roadmap
 * - Ideation
 * - Changelog
 * - GitHub PRs
 *
 * Uses Radix UI Tabs for accessible tab navigation.
 *
 * @example
 * ```tsx
 * <FeatureTabs
 *   activeFeature={activeFeature}
 *   onFeatureChange={setActiveFeature}
 * >
 *   <div>Tab content goes here</div>
 * </FeatureTabs>
 * ```
 */
export function FeatureTabs({
  activeFeature,
  onFeatureChange,
  children,
  className,
  disabled = false,
  variant = 'default',
}: FeatureTabsProps) {
  const { t } = useTranslation(['analytics']);

  const handleValueChange = (value: string) => {
    onFeatureChange(value as FeatureType | 'overview');
  };

  const isCompact = variant === 'compact';

  return (
    <Tabs
      value={activeFeature}
      onValueChange={handleValueChange}
      className={cn('h-full flex flex-col', className)}
    >
      <TabsList
        className={cn(
          'shrink-0 flex-wrap h-auto gap-1',
          isCompact ? 'p-1' : 'p-1.5'
        )}
      >
        {FEATURE_TABS.map((tab) => {
          const Icon = tab.icon;
          return (
            <TabsTrigger
              key={tab.value}
              value={tab.value}
              disabled={disabled}
              className={cn(
                'gap-1.5 data-[state=active]:bg-card',
                isCompact ? 'px-2 py-1 text-xs' : 'px-3 py-1.5 text-sm'
              )}
            >
              <Icon className={cn(isCompact ? 'h-3 w-3' : 'h-4 w-4')} />
              <span className={cn(isCompact && 'hidden sm:inline')}>
                {t(tab.labelKey)}
              </span>
            </TabsTrigger>
          );
        })}
      </TabsList>

      {/* Render content for each tab */}
      {FEATURE_TABS.map((tab) => (
        <TabsContent
          key={tab.value}
          value={tab.value}
          className="flex-1 overflow-auto"
        >
          {children}
        </TabsContent>
      ))}
    </Tabs>
  );
}

/**
 * Props for individual feature tab content wrapper
 */
export interface FeatureTabContentProps {
  /** The feature this content is for */
  feature: FeatureType | 'overview';
  /** Currently active feature */
  activeFeature: FeatureType | 'overview';
  /** Content to render */
  children: ReactNode;
  /** Optional additional className */
  className?: string;
}

/**
 * Wrapper component for individual feature tab content.
 * Only renders children when the feature is active.
 *
 * Use this when you need conditional rendering based on active tab
 * outside of the FeatureTabs component.
 *
 * @example
 * ```tsx
 * <FeatureTabContent
 *   feature="kanban"
 *   activeFeature={activeFeature}
 * >
 *   <KanbanMetrics />
 * </FeatureTabContent>
 * ```
 */
export function FeatureTabContent({
  feature,
  activeFeature,
  children,
  className,
}: FeatureTabContentProps) {
  if (feature !== activeFeature) {
    return null;
  }

  return <div className={cn('h-full', className)}>{children}</div>;
}

/**
 * Hook to get feature tab configuration
 */
export function useFeatureTabs() {
  const { t } = useTranslation(['analytics']);

  return {
    tabs: FEATURE_TABS,
    getLabel: (feature: FeatureType | 'overview') => {
      const tab = FEATURE_TABS.find((tab) => tab.value === feature);
      return tab ? t(tab.labelKey) : feature;
    },
    getIcon: (feature: FeatureType | 'overview') => {
      const tab = FEATURE_TABS.find((tab) => tab.value === feature);
      return tab?.icon ?? BarChart3;
    },
  };
}

/**
 * Export the feature tabs configuration for external use
 */
export { FEATURE_TABS };

/**
 * Type guard to check if a string is a valid feature type
 */
export function isValidFeature(value: string): value is FeatureType | 'overview' {
  return FEATURE_TABS.some((tab) => tab.value === value);
}
