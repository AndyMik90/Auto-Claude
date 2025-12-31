import * as React from 'react';
import { Calendar } from './calendar';
import { Popover, PopoverContent, PopoverTrigger } from './popover';
import { cn } from '../../lib/utils';
import { CalendarIcon } from 'lucide-react';

/* Apple HIG-inspired date picker component
   Key principles:
   - Clean input field with calendar popup
   - Clear date formatting
   - Easy keyboard navigation
   - Proper accessibility with ARIA attributes
*/

export interface DatePickerProps {
  value?: Date | null;
  defaultValue?: Date | null;
  onChange?: (date: Date | null) => void;
  minDate?: Date;
  maxDate?: Date;
  disabled?: boolean;
  placeholder?: string;
  format?: string;
  locale?: string;
  className?: string;
  calendarVariant?: 'default' | 'glass';
  size?: 'sm' | 'md' | 'lg';
}

const formatDate = (date: Date, locale: string = 'en-US'): string => {
  return date.toLocaleDateString(locale, {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  });
};

const DatePicker = React.forwardRef<HTMLDivElement, DatePickerProps>(
  (
    {
      value: controlledValue,
      defaultValue = null,
      onChange,
      minDate,
      maxDate,
      disabled = false,
      placeholder = 'Select date',
      locale = 'en-US',
      className,
      calendarVariant = 'default',
      size = 'md',
      ...props
    },
    ref
  ) => {
    const [open, setOpen] = React.useState(false);
    const [uncontrolledValue, setUncontrolledValue] = React.useState<Date | null>(defaultValue);

    const isControlled = controlledValue !== undefined;
    const value = isControlled ? controlledValue : uncontrolledValue;

    const handleDateChange = (date: Date | null) => {
      if (!isControlled) {
        setUncontrolledValue(date);
      }
      onChange?.(date);
      setOpen(false);
    };

    const handleClear = (e: React.MouseEvent) => {
      e.stopPropagation();
      handleDateChange(null);
    };

    const sizeClasses = {
      sm: 'h-9 px-3 py-2 text-sm',
      md: 'h-11 px-4 py-2.5 text-sm',
      lg: 'h-12 px-5 py-3 text-base',
    };

    return (
      <Popover open={open && !disabled} onOpenChange={setOpen}>
        <PopoverTrigger asChild>
          <button
            type="button"
            ref={ref}
            disabled={disabled}
            className={cn(
              'w-full flex items-center justify-between rounded-xl border',
              'bg-background text-foreground',
              'hover:bg-accent/50',
              'focus:outline-none focus:ring-2 focus:ring-ring/40 focus:border-primary',
              'disabled:cursor-not-allowed disabled:opacity-50',
              'transition-all duration-150 ease-out',
              'tap-target',
              sizeClasses[size],
              className
            )}
            aria-haspopup="dialog"
            aria-expanded={open}
            aria-disabled={disabled}
            {...props}
          >
            <span className="flex items-center gap-2">
              <CalendarIcon className="h-4 w-4 text-muted-foreground" />
              <span className={cn(!value && 'text-muted-foreground')}>
                {value ? formatDate(value, locale) : placeholder}
              </span>
            </span>

            {value && !disabled && (
              <button
                type="button"
                onClick={handleClear}
                className={cn(
                  'rounded-md p-1',
                  'hover:bg-accent',
                  'focus:outline-none focus:ring-2 focus:ring-ring',
                  'transition-colors duration-150',
                  'text-muted-foreground hover:text-foreground'
                )}
                aria-label="Clear date"
              >
                <svg
                  className="h-3 w-3"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M6 18L18 6M6 6l12 12"
                  />
                </svg>
              </button>
            )}
          </button>
        </PopoverTrigger>

        <PopoverContent
          className="p-0 w-auto"
          align="start"
          sideOffset={8}
        >
          <Calendar
            value={value ?? undefined}
            onChange={handleDateChange}
            minDate={minDate}
            maxDate={maxDate}
            variant={calendarVariant}
            size={size}
          />
        </PopoverContent>
      </Popover>
    );
  }
);
DatePicker.displayName = 'DatePicker';

// Range date picker variant
export interface DateRangePickerProps {
  value?: { from: Date; to: Date } | null;
  defaultValue?: { from: Date; to: Date } | null;
  onChange?: (range: { from: Date; to: Date } | null) => void;
  minDate?: Date;
  maxDate?: Date;
  disabled?: boolean;
  placeholder?: string;
  locale?: string;
  className?: string;
  calendarVariant?: 'default' | 'glass';
  size?: 'sm' | 'md' | 'lg';
}

const DateRangePicker = React.forwardRef<HTMLDivElement, DateRangePickerProps>(
  (
    {
      value: controlledValue,
      defaultValue = null,
      onChange,
      minDate,
      maxDate,
      disabled = false,
      placeholder = 'Select date range',
      locale = 'en-US',
      className,
      calendarVariant = 'default',
      size = 'md',
      ...props
    },
    ref
  ) => {
    const [open, setOpen] = React.useState(false);
    const [uncontrolledValue, setUncontrolledValue] = React.useState<{ from: Date; to: Date } | null>(defaultValue);
    const [selectingFrom, setSelectingFrom] = React.useState(true);

    const isControlled = controlledValue !== undefined;
    const value = isControlled ? controlledValue : uncontrolledValue;

    const handleFromDateChange = (date: Date | null) => {
      if (!date) return;

      if (value?.to && date > value.to) {
        // From date is after to date, reset range
        const newRange = { from: date, to: date };
        if (!isControlled) {
          setUncontrolledValue(newRange);
        }
        onChange?.(newRange);
        setSelectingFrom(false);
      } else {
        const newRange = { from: date, to: value?.to || date };
        if (!isControlled) {
          setUncontrolledValue(newRange);
        }
        onChange?.(newRange);
        setSelectingFrom(false);
      }
    };

    const handleToDateChange = (date: Date | null) => {
      if (!date || !value?.from) return;

      if (date < value.from) {
        // To date is before from date, swap them
        const newRange = { from: date, to: value.from };
        if (!isControlled) {
          setUncontrolledValue(newRange);
        }
        onChange?.(newRange);
      } else {
        const newRange = { from: value.from, to: date };
        if (!isControlled) {
          setUncontrolledValue(newRange);
        }
        onChange?.(newRange);
      }
      setOpen(false);
    };

    const handleCalendarChange = (date: Date | null) => {
      if (!date) return;

      if (selectingFrom) {
        handleFromDateChange(date);
      } else {
        handleToDateChange(date);
      }
    };

    const handleClear = (e: React.MouseEvent) => {
      e.stopPropagation();
      if (!isControlled) {
        setUncontrolledValue(null);
      }
      onChange?.(null);
      setSelectingFrom(true);
    };

    const formatRange = (range: { from: Date; to: Date }) => {
      return `${formatDate(range.from, locale)} - ${formatDate(range.to, locale)}`;
    };

    const sizeClasses = {
      sm: 'h-9 px-3 py-2 text-sm',
      md: 'h-11 px-4 py-2.5 text-sm',
      lg: 'h-12 px-5 py-3 text-base',
    };

    return (
      <Popover open={open && !disabled} onOpenChange={(open) => { setOpen(open); setSelectingFrom(true); }}>
        <PopoverTrigger asChild>
          <button
            type="button"
            ref={ref}
            disabled={disabled}
            className={cn(
              'w-full flex items-center justify-between rounded-xl border',
              'bg-background text-foreground',
              'hover:bg-accent/50',
              'focus:outline-none focus:ring-2 focus:ring-ring/40 focus:border-primary',
              'disabled:cursor-not-allowed disabled:opacity-50',
              'transition-all duration-150 ease-out',
              'tap-target',
              sizeClasses[size],
              className
            )}
            aria-haspopup="dialog"
            aria-expanded={open}
            aria-disabled={disabled}
            {...props}
          >
            <span className="flex items-center gap-2">
              <CalendarIcon className="h-4 w-4 text-muted-foreground" />
              <span className={cn(!value && 'text-muted-foreground')}>
                {value ? formatRange(value) : placeholder}
              </span>
            </span>

            {value && !disabled && (
              <button
                type="button"
                onClick={handleClear}
                className={cn(
                  'rounded-md p-1',
                  'hover:bg-accent',
                  'focus:outline-none focus:ring-2 focus:ring-ring',
                  'transition-colors duration-150',
                  'text-muted-foreground hover:text-foreground'
                )}
                aria-label="Clear date range"
              >
                <svg
                  className="h-3 w-3"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M6 18L18 6M6 6l12 12"
                  />
                </svg>
              </button>
            )}
          </button>
        </PopoverTrigger>

        <PopoverContent
          className="p-0 w-auto"
          align="start"
          sideOffset={8}
        >
          <div className="p-4 border-b border-border">
            <div className="text-sm font-medium">
              {selectingFrom ? 'Select start date' : 'Select end date'}
            </div>
            {value?.from && (
              <div className="text-xs text-muted-foreground mt-1">
                From: {formatDate(value.from, locale)}
                {value.to && ` To: ${formatDate(value.to, locale)}`}
              </div>
            )}
          </div>
          <Calendar
            value={selectingFrom ? (value?.from ?? undefined) : (value?.to ?? undefined)}
            onChange={handleCalendarChange}
            minDate={minDate}
            maxDate={maxDate}
            variant={calendarVariant}
            size={size}
          />
        </PopoverContent>
      </Popover>
    );
  }
);
DateRangePicker.displayName = 'DateRangePicker';

export { DatePicker, DateRangePicker };
