import * as React from 'react';
import { cva, type VariantProps } from 'class-variance-authority';
import { cn } from '../../lib/utils';
import { Clock } from 'lucide-react';

/* Apple HIG-inspired time picker component
   Key principles:
   - Intuitive time input with hours and minutes
   - AM/PM toggle for 12-hour format
   - Clear visual feedback for selected state
   - Keyboard navigation support
   - Proper tap targets for touch interaction
*/

interface TimeValue {
  hours: number;
  minutes: number;
  period?: 'AM' | 'PM';
}

const timePickerVariants = cva(
  'rounded-xl border p-4 tap-target',
  {
    variants: {
      variant: {
        default: 'border-border bg-card',
        glass: 'glass-surface border-white/10 dark:border-white/5',
      },
      size: {
        sm: 'p-3',
        md: 'p-4',
        lg: 'p-5',
      },
    },
    defaultVariants: {
      variant: 'default',
      size: 'md',
    },
  }
);

const timeInputVariants = cva(
  'rounded-lg border text-center transition-all duration-150',
  {
    variants: {
      variant: {
        default: 'border-border bg-background focus:border-primary focus:ring-2 focus:ring-ring/40',
        glass: 'border-white/10 bg-white/5 dark:bg-white/10 backdrop-blur-md focus:border-primary/50 focus:ring-2 focus:ring-primary/40',
      },
      size: {
        sm: 'h-8 w-14 text-sm',
        md: 'h-10 w-16 text-base',
        lg: 'h-12 w-20 text-lg',
      },
    },
    defaultVariants: {
      variant: 'default',
      size: 'md',
    },
  }
);

const periodButtonVariants = cva(
  'rounded-lg font-medium transition-all duration-150 tap-target',
  {
    variants: {
      selected: {
        true: 'bg-primary text-primary-foreground',
        false: 'bg-muted text-muted-foreground hover:bg-accent hover:text-accent-foreground',
      },
      size: {
        sm: 'h-8 px-3 text-xs',
        md: 'h-10 px-4 text-sm',
        lg: 'h-12 px-5 text-base',
      },
    },
    defaultVariants: {
      size: 'md',
    },
  }
);

export interface TimePickerProps extends VariantProps<typeof timePickerVariants> {
  value?: TimeValue | null;
  defaultValue?: TimeValue | null;
  onChange?: (time: TimeValue | null) => void;
  disabled?: boolean;
  is24Hour?: boolean;
  locale?: string;
  className?: string;
}

const formatTime = (time: TimeValue, is24Hour: boolean, locale: string = 'en-US'): string => {
  if (is24Hour) {
    return `${time.hours.toString().padStart(2, '0')}:${time.minutes.toString().padStart(2, '0')}`;
  }
  return `${time.hours % 12 || 12}:${time.minutes.toString().padStart(2, '0')} ${time.period}`;
};

const parseTime = (timeString: string, is24Hour: boolean): TimeValue | null => {
  if (is24Hour) {
    const match = timeString.match(/^(\d{1,2}):(\d{2})$/);
    if (match) {
      const hours = parseInt(match[1], 10);
      const minutes = parseInt(match[2], 10);
      if (hours >= 0 && hours <= 23 && minutes >= 0 && minutes <= 59) {
        return { hours, minutes };
      }
    }
  } else {
    const match = timeString.match(/^(\d{1,2}):(\d{2})\s*(AM|PM)?$/i);
    if (match) {
      let hours = parseInt(match[1], 10);
      const minutes = parseInt(match[2], 10);
      const period = match[3]?.toUpperCase() as 'AM' | 'PM' | undefined;

      if (hours >= 1 && hours <= 12 && minutes >= 0 && minutes <= 59) {
        if (period === 'PM' && hours !== 12) {
          hours += 12;
        } else if (period === 'AM' && hours === 12) {
          hours = 0;
        }
        return { hours, minutes, period: period || (hours >= 12 ? 'PM' : 'AM') };
      }
    }
  }
  return null;
};

const TimePicker = React.forwardRef<HTMLDivElement, TimePickerProps>(
  (
    {
      value: controlledValue,
      defaultValue = null,
      onChange,
      disabled = false,
      is24Hour = false,
      locale = 'en-US',
      variant = 'default',
      size = 'md',
      className,
      ...props
    },
    ref
  ) => {
    const [uncontrolledValue, setUncontrolledValue] = React.useState<TimeValue | null>(
      defaultValue || { hours: 12, minutes: 0, period: 'PM' }
    );

    const isControlled = controlledValue !== undefined;
    const value = isControlled ? controlledValue : uncontrolledValue;

    const handleHoursChange = (delta: number) => {
      if (!value || disabled) return;

      let newHours = value.hours + delta;
      if (!is24Hour) {
        if (newHours > 12) newHours = 1;
        if (newHours < 1) newHours = 12;
      } else {
        if (newHours > 23) newHours = 0;
        if (newHours < 0) newHours = 23;
      }

      const newValue = { ...value, hours: newHours };
      if (!isControlled) {
        setUncontrolledValue(newValue);
      }
      onChange?.(newValue);
    };

    const handleMinutesChange = (delta: number) => {
      if (!value || disabled) return;

      let newMinutes = value.minutes + delta;
      if (newMinutes > 59) newMinutes = 0;
      if (newMinutes < 0) newMinutes = 59;

      const newValue = { ...value, minutes: newMinutes };
      if (!isControlled) {
        setUncontrolledValue(newValue);
      }
      onChange?.(newValue);
    };

    const handlePeriodChange = (period: 'AM' | 'PM') => {
      if (!value || disabled || is24Hour) return;

      let newHours = value.hours;
      if (period === 'AM' && value.period === 'PM' && value.hours !== 12) {
        newHours = value.hours - 12;
      } else if (period === 'PM' && value.period === 'AM' && value.hours !== 12) {
        newHours = value.hours + 12;
      } else if (period === 'AM' && value.hours === 12) {
        newHours = 0;
      } else if (period === 'PM' && value.hours === 0) {
        newHours = 12;
      }

      const newValue = { ...value, hours: newHours, period };
      if (!isControlled) {
        setUncontrolledValue(newValue);
      }
      onChange?.(newValue);
    };

    const handleHoursInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
      if (!value || disabled) return;

      let newHours = parseInt(e.target.value, 10);
      if (isNaN(newHours)) return;

      if (!is24Hour) {
        if (newHours > 12) newHours = 12;
        if (newHours < 1) newHours = 1;
      } else {
        if (newHours > 23) newHours = 23;
        if (newHours < 0) newHours = 0;
      }

      const newValue = { ...value, hours: newHours };
      if (!isControlled) {
        setUncontrolledValue(newValue);
      }
      onChange?.(newValue);
    };

    const handleMinutesInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
      if (!value || disabled) return;

      let newMinutes = parseInt(e.target.value, 10);
      if (isNaN(newMinutes)) return;

      if (newMinutes > 59) newMinutes = 59;
      if (newMinutes < 0) newMinutes = 0;

      const newValue = { ...value, minutes: newMinutes };
      if (!isControlled) {
        setUncontrolledValue(newValue);
      }
      onChange?.(newValue);
    };

    const handleClear = () => {
      if (!isControlled) {
        setUncontrolledValue(null);
      }
      onChange?.(null);
    };

    const displayHours = value
      ? is24Hour
        ? value.hours.toString().padStart(2, '0')
        : (value.hours % 12 || 12).toString()
      : '--';
    const displayMinutes = value ? value.minutes.toString().padStart(2, '0') : '--';
    const currentPeriod = value?.period || 'AM';

    return (
      <div
        ref={ref}
        className={cn(
          timePickerVariants({ variant, size }),
          disabled && 'opacity-50 cursor-not-allowed',
          className
        )}
        {...props}
      >
        {/* Icon */}
        <div className="flex items-center justify-center mb-3">
          <Clock className={cn(
            'text-muted-foreground',
            size === 'sm' ? 'h-4 w-4' : size === 'lg' ? 'h-6 w-6' : 'h-5 w-5'
          )} />
        </div>

        {/* Time input area */}
        <div className="flex items-center justify-center gap-2">
          {/* Hours */}
          <div className="flex flex-col items-center gap-1">
            <button
              type="button"
              onClick={() => handleHoursChange(1)}
              disabled={disabled}
              className={cn(
                'rounded-lg p-1 hover:bg-accent',
                'focus:outline-none focus:ring-2 focus:ring-ring',
                'disabled:opacity-50 disabled:cursor-not-allowed',
                'transition-colors duration-150'
              )}
              aria-label="Increment hours"
            >
              <svg className="h-3 w-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 15l7-7 7 7" />
              </svg>
            </button>

            <input
              type="text"
              inputMode="numeric"
              value={displayHours}
              onChange={handleHoursInputChange}
              disabled={disabled}
              className={cn(
                timeInputVariants({ variant, size }),
                'focus:outline-none'
              )}
              aria-label="Hours"
            />

            <button
              type="button"
              onClick={() => handleHoursChange(-1)}
              disabled={disabled}
              className={cn(
                'rounded-lg p-1 hover:bg-accent',
                'focus:outline-none focus:ring-2 focus:ring-ring',
                'disabled:opacity-50 disabled:cursor-not-allowed',
                'transition-colors duration-150'
              )}
              aria-label="Decrement hours"
            >
              <svg className="h-3 w-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
              </svg>
            </button>
          </div>

          {/* Separator */}
          <div className={cn(
            'text-foreground font-semibold',
            size === 'sm' ? 'text-lg' : size === 'lg' ? 'text-2xl' : 'text-xl'
          )}>
            :
          </div>

          {/* Minutes */}
          <div className="flex flex-col items-center gap-1">
            <button
              type="button"
              onClick={() => handleMinutesChange(1)}
              disabled={disabled}
              className={cn(
                'rounded-lg p-1 hover:bg-accent',
                'focus:outline-none focus:ring-2 focus:ring-ring',
                'disabled:opacity-50 disabled:cursor-not-allowed',
                'transition-colors duration-150'
              )}
              aria-label="Increment minutes"
            >
              <svg className="h-3 w-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 15l7-7 7 7" />
              </svg>
            </button>

            <input
              type="text"
              inputMode="numeric"
              value={displayMinutes}
              onChange={handleMinutesInputChange}
              disabled={disabled}
              className={cn(
                timeInputVariants({ variant, size }),
                'focus:outline-none'
              )}
              aria-label="Minutes"
            />

            <button
              type="button"
              onClick={() => handleMinutesChange(-1)}
              disabled={disabled}
              className={cn(
                'rounded-lg p-1 hover:bg-accent',
                'focus:outline-none focus:ring-2 focus:ring-ring',
                'disabled:opacity-50 disabled:cursor-not-allowed',
                'transition-colors duration-150'
              )}
              aria-label="Decrement minutes"
            >
              <svg className="h-3 w-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
              </svg>
            </button>
          </div>

          {/* AM/PM Toggle */}
          {!is24Hour && (
            <div className="flex flex-col gap-1 ml-2">
              <button
                type="button"
                onClick={() => handlePeriodChange('AM')}
                disabled={disabled}
                className={cn(
                  periodButtonVariants({
                    selected: currentPeriod === 'AM',
                    size
                  }),
                  'focus:outline-none focus:ring-2 focus:ring-ring'
                )}
                aria-label="Select AM"
                aria-pressed={currentPeriod === 'AM'}
              >
                AM
              </button>
              <button
                type="button"
                onClick={() => handlePeriodChange('PM')}
                disabled={disabled}
                className={cn(
                  periodButtonVariants({
                    selected: currentPeriod === 'PM',
                    size
                  }),
                  'focus:outline-none focus:ring-2 focus:ring-ring'
                )}
                aria-label="Select PM"
                aria-pressed={currentPeriod === 'PM'}
              >
                PM
              </button>
            </div>
          )}
        </div>

        {/* Formatted time display */}
        {value && (
          <div className="mt-3 text-center text-sm text-muted-foreground">
            {formatTime(value, is24Hour, locale)}
          </div>
        )}

        {/* Clear button */}
        {value && !disabled && (
          <button
            type="button"
            onClick={handleClear}
            className={cn(
              'mt-3 w-full rounded-lg py-2 text-sm',
              'text-muted-foreground hover:text-foreground',
              'hover:bg-accent/50',
              'focus:outline-none focus:ring-2 focus:ring-ring',
              'transition-all duration-150'
            )}
          >
            Clear
          </button>
        )}
      </div>
    );
  }
);
TimePicker.displayName = 'TimePicker';

// Compact input-style time picker
export interface TimePickerInputProps {
  value?: TimeValue | null;
  defaultValue?: TimeValue | null;
  onChange?: (time: TimeValue | null) => void;
  disabled?: boolean;
  is24Hour?: boolean;
  placeholder?: string;
  locale?: string;
  className?: string;
  size?: 'sm' | 'md' | 'lg';
}

const TimePickerInput = React.forwardRef<HTMLButtonElement, TimePickerInputProps>(
  (
    {
      value: controlledValue,
      defaultValue = null,
      onChange,
      disabled = false,
      is24Hour = false,
      placeholder = 'Select time',
      locale = 'en-US',
      className,
      size = 'md',
      ...props
    },
    ref
  ) => {
    const [open, setOpen] = React.useState(false);
    const [uncontrolledValue, setUncontrolledValue] = React.useState<TimeValue | null>(defaultValue);

    const isControlled = controlledValue !== undefined;
    const value = isControlled ? controlledValue : uncontrolledValue;

    const handleTimeChange = (time: TimeValue | null) => {
      if (!isControlled) {
        setUncontrolledValue(time);
      }
      onChange?.(time);
      setOpen(false);
    };

    const sizeClasses = {
      sm: 'h-9 px-3 py-2 text-sm',
      md: 'h-11 px-4 py-2.5 text-sm',
      lg: 'h-12 px-5 py-3 text-base',
    };

    return (
      <div className="relative">
        <button
          ref={ref}
          type="button"
          disabled={disabled}
          onClick={() => setOpen(!open)}
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
            <Clock className="h-4 w-4 text-muted-foreground" />
            <span className={cn(!value && 'text-muted-foreground')}>
              {value ? formatTime(value, is24Hour, locale) : placeholder}
            </span>
          </span>

          {value && !disabled && (
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                handleTimeChange(null);
              }}
              className={cn(
                'rounded-md p-1',
                'hover:bg-accent',
                'focus:outline-none focus:ring-2 focus:ring-ring',
                'transition-colors duration-150',
                'text-muted-foreground hover:text-foreground'
              )}
              aria-label="Clear time"
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

        {open && (
          <div className="absolute z-50 mt-2 top-full left-0">
            <TimePicker
              value={value}
              onChange={handleTimeChange}
              disabled={disabled}
              is24Hour={is24Hour}
              locale={locale}
              variant="default"
              size={size}
            />
          </div>
        )}
      </div>
    );
  }
);
TimePickerInput.displayName = 'TimePickerInput';

export { TimePicker, TimePickerInput, timePickerVariants };
