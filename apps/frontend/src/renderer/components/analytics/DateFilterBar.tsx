import { useTranslation } from 'react-i18next';
import { Calendar } from 'lucide-react';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '../ui/select';
import { cn } from '../../lib/utils';
import type { DateFilter } from '../../../shared/types/analytics';

/**
 * Date filter options with their translation keys
 */
const DATE_FILTER_OPTIONS: Array<{ value: DateFilter; labelKey: string }> = [
  { value: 'today', labelKey: 'analytics:dateFilter.today' },
  { value: 'yesterday', labelKey: 'analytics:dateFilter.yesterday' },
  { value: 'last_7_days', labelKey: 'analytics:dateFilter.last7Days' },
  { value: 'this_month', labelKey: 'analytics:dateFilter.thisMonth' },
  { value: 'last_month', labelKey: 'analytics:dateFilter.lastMonth' },
  { value: 'last_6_months', labelKey: 'analytics:dateFilter.last6Months' },
  { value: 'this_year', labelKey: 'analytics:dateFilter.thisYear' },
  { value: 'all_time', labelKey: 'analytics:dateFilter.allTime' },
];

/**
 * Props for the DateFilterBar component
 */
export interface DateFilterBarProps {
  /** Currently selected date filter */
  value: DateFilter;
  /** Callback when date filter changes */
  onChange: (value: DateFilter) => void;
  /** Optional additional className */
  className?: string;
  /** Whether the select is disabled */
  disabled?: boolean;
}

/**
 * DateFilterBar component for selecting predefined date ranges.
 *
 * Provides a dropdown with options like Today, Yesterday, Last 7 days, etc.
 * Uses i18n for all labels to support internationalization.
 *
 * @example
 * ```tsx
 * <DateFilterBar
 *   value={dateFilter}
 *   onChange={setDateFilter}
 * />
 * ```
 */
export function DateFilterBar({
  value,
  onChange,
  className,
  disabled = false,
}: DateFilterBarProps) {
  const { t } = useTranslation(['analytics']);

  const handleValueChange = (newValue: string) => {
    onChange(newValue as DateFilter);
  };

  return (
    <div className={cn('flex items-center gap-2', className)}>
      <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary/10 text-primary">
        <Calendar className="h-4 w-4" />
      </div>
      <div className="flex flex-col gap-0.5">
        <span className="text-xs font-medium text-muted-foreground">
          {t('analytics:dateFilter.label')}
        </span>
        <Select
          value={value}
          onValueChange={handleValueChange}
          disabled={disabled}
        >
          <SelectTrigger className="h-8 w-[180px] text-sm">
            <SelectValue placeholder={t('analytics:dateFilter.label')} />
          </SelectTrigger>
          <SelectContent>
            {DATE_FILTER_OPTIONS.map((option) => (
              <SelectItem key={option.value} value={option.value}>
                {t(option.labelKey)}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
    </div>
  );
}

/**
 * Compact variant of DateFilterBar for use in tighter spaces
 */
export interface CompactDateFilterBarProps {
  /** Currently selected date filter */
  value: DateFilter;
  /** Callback when date filter changes */
  onChange: (value: DateFilter) => void;
  /** Optional additional className */
  className?: string;
  /** Whether the select is disabled */
  disabled?: boolean;
}

export function CompactDateFilterBar({
  value,
  onChange,
  className,
  disabled = false,
}: CompactDateFilterBarProps) {
  const { t } = useTranslation(['analytics']);

  const handleValueChange = (newValue: string) => {
    onChange(newValue as DateFilter);
  };

  return (
    <div className={cn('flex items-center gap-2', className)}>
      <Calendar className="h-4 w-4 text-muted-foreground" />
      <Select
        value={value}
        onValueChange={handleValueChange}
        disabled={disabled}
      >
        <SelectTrigger className="h-7 w-[140px] text-xs">
          <SelectValue placeholder={t('analytics:dateFilter.label')} />
        </SelectTrigger>
        <SelectContent>
          {DATE_FILTER_OPTIONS.map((option) => (
            <SelectItem key={option.value} value={option.value} className="text-xs">
              {t(option.labelKey)}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  );
}

/**
 * Helper function to get the human-readable label for a date filter
 */
export function getDateFilterLabel(filter: DateFilter, t: (key: string) => string): string {
  const option = DATE_FILTER_OPTIONS.find((opt) => opt.value === filter);
  return option ? t(option.labelKey) : filter;
}

/**
 * Export the options array for external use
 */
export { DATE_FILTER_OPTIONS };
