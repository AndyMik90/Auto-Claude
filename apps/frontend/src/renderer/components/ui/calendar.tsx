import * as React from 'react';
import { cva, type VariantProps } from 'class-variance-authority';
import { cn } from '../../lib/utils';
import { ChevronLeft, ChevronRight } from 'lucide-react';

/* Apple HIG-inspired calendar component
   Key principles:
   - Clean, intuitive date selection
   - Clear visual feedback for selected/disabled states
   - Smooth month transitions
   - Accessible keyboard navigation
   - Proper tap targets for touch interaction
*/

type CalendarDate = Date;

interface CalendarState {
  currentDate: CalendarDate;
  selectedDate: CalendarDate | null;
  viewMonth: number;
  viewYear: number;
}

const calendarVariants = cva(
  'rounded-xl border p-4 tap-target',
  {
    variants: {
      variant: {
        default: 'border-border bg-card',
        glass: 'glass-surface border-white/10 dark:border-white/5',
      },
      size: {
        sm: 'text-sm',
        md: 'text-base',
        lg: 'text-lg',
      },
    },
    defaultVariants: {
      variant: 'default',
      size: 'md',
    },
  }
);

const dayVariants = cva(
  'relative flex items-center justify-center rounded-lg transition-all duration-150 ease-out tap-target',
  {
    variants: {
      state: {
        default: 'hover:bg-accent hover:text-accent-foreground',
        selected: 'bg-primary text-primary-foreground hover:bg-primary/90',
        disabled: 'text-muted-foreground opacity-50 cursor-not-allowed',
        today: 'font-semibold border-2 border-primary',
        outside: 'text-muted-foreground/50',
      },
      size: {
        sm: 'h-7 w-7 text-xs',
        md: 'h-9 w-9 text-sm',
        lg: 'h-11 w-11 text-base',
      },
    },
    defaultVariants: {
      state: 'default',
      size: 'md',
    },
  }
);

export interface CalendarProps extends VariantProps<typeof calendarVariants> {
  value?: Date | null;
  defaultValue?: Date | null;
  onChange?: (date: Date | null) => void;
  minDate?: Date;
  maxDate?: Date;
  disabledDates?: Date[];
  weekStartsOn?: 0 | 1 | 2 | 3 | 4 | 5 | 6;
  showWeekNumber?: boolean;
  locale?: string;
}

const Calendar = React.forwardRef<HTMLDivElement, CalendarProps>(
  (
    {
      value: controlledValue,
      defaultValue = null,
      onChange,
      minDate,
      maxDate,
      disabledDates = [],
      weekStartsOn = 0,
      showWeekNumber = false,
      locale = 'en-US',
      variant = 'default',
      size = 'md',
      className,
      ...props
    },
    ref
  ) => {
    const [state, setState] = React.useState<CalendarState>({
      currentDate: new Date(),
      selectedDate: controlledValue ?? defaultValue,
      viewMonth: (controlledValue ?? defaultValue ?? new Date()).getMonth(),
      viewYear: (controlledValue ?? defaultValue ?? new Date()).getFullYear(),
    });

    const isControlled = controlledValue !== undefined;
    const selectedDate = isControlled ? controlledValue : state.selectedDate;

    // Update view month/year when controlled value changes
    React.useEffect(() => {
      if (isControlled && controlledValue) {
        setState((prev) => ({
          ...prev,
          viewMonth: controlledValue.getMonth(),
          viewYear: controlledValue.getFullYear(),
        }));
      }
    }, [isControlled, controlledValue]);

    const getDaysInMonth = (month: number, year: number): number => {
      return new Date(year, month + 1, 0).getDate();
    };

    const getFirstDayOfMonth = (month: number, year: number): number => {
      return new Date(year, month, 1).getDay();
    };

    const isSameDay = (date1: Date, date2: Date): boolean => {
      return (
        date1.getDate() === date2.getDate() &&
        date1.getMonth() === date2.getMonth() &&
        date1.getFullYear() === date2.getFullYear()
      );
    };

    const isToday = (date: Date): boolean => {
      return isSameDay(date, new Date());
    };

    const isDisabled = (date: Date): boolean => {
      if (minDate && date < minDate) return true;
      if (maxDate && date > maxDate) return true;
      if (disabledDates.some((d) => isSameDay(d, date))) return true;
      return false;
    };

    const handleDateClick = (date: Date) => {
      if (isDisabled(date)) return;

      const newSelectedDate = isSameDay(date, selectedDate || new Date(0)) ? null : date;

      if (!isControlled) {
        setState((prev) => ({ ...prev, selectedDate: newSelectedDate }));
      }
      onChange?.(newSelectedDate);
    };

    const handlePrevMonth = () => {
      setState((prev) => {
        let newMonth = prev.viewMonth - 1;
        let newYear = prev.viewYear;
        if (newMonth < 0) {
          newMonth = 11;
          newYear -= 1;
        }
        return { ...prev, viewMonth: newMonth, viewYear: newYear };
      });
    };

    const handleNextMonth = () => {
      setState((prev) => {
        let newMonth = prev.viewMonth + 1;
        let newYear = prev.viewYear;
        if (newMonth > 11) {
          newMonth = 0;
          newYear += 1;
        }
        return { ...prev, viewMonth: newMonth, newYear };
      });
    };

    const handleKeyDown = (e: React.KeyboardEvent, date: Date) => {
      if (isDisabled(date)) return;

      switch (e.key) {
        case 'Enter':
        case ' ':
          e.preventDefault();
          handleDateClick(date);
          break;
      }
    };

    const monthNames = [
      'January', 'February', 'March', 'April', 'May', 'June',
      'July', 'August', 'September', 'October', 'November', 'December'
    ];

    const dayNames = ['Su', 'Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa'];
    const adjustedDayNames = [
      ...dayNames.slice(weekStartsOn),
      ...dayNames.slice(0, weekStartsOn)
    ];

    const daysInMonth = getDaysInMonth(state.viewMonth, state.viewYear);
    const firstDayOfMonth = getFirstDayOfMonth(state.viewMonth, state.viewYear);
    const adjustedFirstDay = (firstDayOfMonth - weekStartsOn + 7) % 7;

    const prevMonthDays = getDaysInMonth(
      state.viewMonth === 0 ? 11 : state.viewMonth - 1,
      state.viewMonth === 0 ? state.viewYear - 1 : state.viewYear
    );

    const calendarDays: Array<{ date: Date; isOutside: boolean }> = [];

    // Previous month days
    for (let i = adjustedFirstDay - 1; i >= 0; i--) {
      const day = prevMonthDays - i;
      const date = new Date(
        state.viewMonth === 0 ? state.viewYear - 1 : state.viewYear,
        state.viewMonth === 0 ? 11 : state.viewMonth - 1,
        day
      );
      calendarDays.push({ date, isOutside: true });
    }

    // Current month days
    for (let day = 1; day <= daysInMonth; day++) {
      const date = new Date(state.viewYear, state.viewMonth, day);
      calendarDays.push({ date, isOutside: false });
    }

    // Next month days
    const remainingDays = 42 - calendarDays.length;
    for (let day = 1; day <= remainingDays; day++) {
      const date = new Date(
        state.viewMonth === 11 ? state.viewYear + 1 : state.viewYear,
        state.viewMonth === 11 ? 0 : state.viewMonth + 1,
        day
      );
      calendarDays.push({ date, isOutside: true });
    }

    const getDayState = (date: Date, isOutside: boolean) => {
      if (isOutside || isDisabled(date)) return 'disabled';
      if (selectedDate && isSameDay(date, selectedDate)) return 'selected';
      if (isToday(date)) return 'today';
      return 'default';
    };

    return (
      <div
        ref={ref}
        className={cn(calendarVariants({ variant, size }), className)}
        {...props}
      >
        {/* Header */}
        <div className="flex items-center justify-between mb-4">
          <button
            type="button"
            onClick={handlePrevMonth}
            className={cn(
              'p-1 rounded-lg hover:bg-accent hover:text-accent-foreground',
              'transition-colors duration-150',
              'focus:outline-none focus:ring-2 focus:ring-ring',
              'tap-target'
            )}
            aria-label="Previous month"
          >
            <ChevronLeft className="h-4 w-4" />
          </button>

          <div className="font-semibold text-foreground">
            {monthNames[state.viewMonth]} {state.viewYear}
          </div>

          <button
            type="button"
            onClick={handleNextMonth}
            className={cn(
              'p-1 rounded-lg hover:bg-accent hover:text-accent-foreground',
              'transition-colors duration-150',
              'focus:outline-none focus:ring-2 focus:ring-ring',
              'tap-target'
            )}
            aria-label="Next month"
          >
            <ChevronRight className="h-4 w-4" />
          </button>
        </div>

        {/* Day names */}
        <div className="grid grid-cols-7 gap-1 mb-2">
          {showWeekNumber && <div className="w-full"></div>}
          {adjustedDayNames.map((dayName) => (
            <div
              key={dayName}
              className="text-center text-xs font-medium text-muted-foreground py-1"
            >
              {dayName}
            </div>
          ))}
        </div>

        {/* Calendar days */}
        <div className="grid grid-cols-7 gap-1">
          {calendarDays.map(({ date, isOutside }, index) => {
            const dayState = getDayState(date, isOutside);
            const weekNumber = showWeekNumber && index % 7 === 0
              ? Math.ceil((index / 7 + 1) + (adjustedFirstDay / 7))
              : null;

            return (
              <React.Fragment key={`${date.toISOString()}-${index}`}>
                {showWeekNumber && weekNumber && (
                  <div className="flex items-center justify-center text-xs text-muted-foreground/70 py-1">
                    {weekNumber}
                  </div>
                )}
                <button
                  type="button"
                  onClick={() => handleDateClick(date)}
                  onKeyDown={(e) => handleKeyDown(e, date)}
                  disabled={dayState === 'disabled'}
                  className={cn(
                    dayVariants({
                      state: dayState,
                      size: size === 'sm' ? 'sm' : size === 'lg' ? 'lg' : 'md',
                    })
                  )}
                  aria-label={date.toLocaleDateString(locale, {
                    weekday: 'long',
                    year: 'numeric',
                    month: 'long',
                    day: 'numeric',
                  })}
                  aria-selected={dayState === 'selected'}
                  aria-disabled={dayState === 'disabled'}
                >
                  {date.getDate()}
                </button>
              </React.Fragment>
            );
          })}
        </div>
      </div>
    );
  }
);
Calendar.displayName = 'Calendar';

// Compound components for Calendar
const CalendarHeader = React.forwardRef<
  HTMLDivElement,
  React.HTMLAttributes<HTMLDivElement>
>(({ className, ...props }, ref) => (
  <div ref={ref} className={cn('flex items-center justify-between mb-4', className)} {...props} />
));
CalendarHeader.displayName = 'CalendarHeader';

const CalendarTitle = React.forwardRef<
  HTMLHeadingElement,
  React.HTMLAttributes<HTMLHeadingElement>
>(({ className, ...props }, ref) => (
  <h3 ref={ref} className={cn('font-semibold text-foreground', className)} {...props} />
));
CalendarTitle.displayName = 'CalendarTitle';

const CalendarGrid = React.forwardRef<
  HTMLDivElement,
  React.HTMLAttributes<HTMLDivElement>
>(({ className, ...props }, ref) => (
  <div ref={ref} className={cn('grid grid-cols-7 gap-1', className)} {...props} />
));
CalendarGrid.displayName = 'CalendarGrid';

const CalendarDay = React.forwardRef<
  HTMLButtonElement,
  React.ButtonHTMLAttributes<HTMLButtonElement> & { selected?: boolean; today?: boolean; disabled?: boolean }
>(({ className, selected, today, disabled, ...props }, ref) => (
  <button
    ref={ref}
    className={cn(
      dayVariants({
        state: selected ? 'selected' : disabled ? 'disabled' : today ? 'today' : 'default',
      }),
      className
    )}
    aria-selected={selected}
    aria-disabled={disabled}
    {...props}
  />
));
CalendarDay.displayName = 'CalendarDay';

export {
  Calendar,
  CalendarHeader,
  CalendarTitle,
  CalendarGrid,
  CalendarDay,
  calendarVariants,
  dayVariants,
};
