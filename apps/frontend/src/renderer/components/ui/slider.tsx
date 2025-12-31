import * as React from 'react';
import { cva, type VariantProps } from 'class-variance-authority';
import { cn } from '../../lib/utils';

/* Apple HIG-inspired slider component
   Key principles:
   - Smooth touch interactions with 44pt tap targets
   - Visual feedback during interaction
   - Accessible with proper ARIA attributes
   - Liquid glass effect support
*/

const sliderVariants = cva(
  'relative flex items-center select-none tap-target',
  {
    variants: {
      size: {
        sm: 'h-1',
        md: 'h-2',
        lg: 'h-3',
      },
      variant: {
        default: '',
        glass: 'glass-surface rounded-full p-1',
      },
    },
    defaultVariants: {
      size: 'md',
      variant: 'default',
    },
  }
);

const trackVariants = cva(
  'relative rounded-full transition-colors duration-200',
  {
    variants: {
      size: {
        sm: 'h-1',
        md: 'h-2',
        lg: 'h-3',
      },
    },
    defaultVariants: {
      size: 'md',
    },
  }
);

const thumbVariants = cva(
  'absolute rounded-full shadow-lg border-2 border-white dark:border-border transition-all duration-200',
  {
    variants: {
      size: {
        sm: 'h-4 w-4 -top-[6px]',
        md: 'h-5 w-5 -top-[8px]',
        lg: 'h-6 w-6 -top-[10px]',
      },
      state: {
        default: 'hover:scale-110 active:scale-95 cursor-grab',
        dragging: 'scale-125 cursor-grabbing',
      },
    },
    defaultVariants: {
      size: 'md',
      state: 'default',
    },
  }
);

export interface SliderProps extends Omit<React.InputHTMLAttributes<HTMLInputElement>, 'size' | 'value' | 'onChange'>, VariantProps<typeof sliderVariants> {
  value?: number[];
  onValueChange?: (value: number[]) => void;
  min?: number;
  max?: number;
  step?: number;
  minStepsBetweenThumbs?: number;
  formatValue?: (value: number) => string;
  showValue?: boolean;
  defaultValue?: number[];
  orientation?: 'horizontal' | 'vertical';
}

const Slider = React.forwardRef<HTMLDivElement, SliderProps>(
  ({
    className,
    value: controlledValue,
    onValueChange,
    min = 0,
    max = 100,
    step = 1,
    minStepsBetweenThumbs = 0,
    formatValue,
    showValue = false,
    defaultValue = [50],
    size = 'md',
    variant = 'default',
    orientation = 'horizontal',
    disabled = false,
    id,
    ...props
  }, ref) => {
    const [uncontrolledValue, setUncontrolledValue] = React.useState<number[]>(defaultValue);
    const [draggingIndex, setDraggingIndex] = React.useState<number | null>(null);
    const trackRef = React.useRef<HTMLDivElement>(null);
    const thumbRefs = React.useRef<(HTMLButtonElement | null)[]>([]);

    const isControlled = controlledValue !== undefined;
    const value = isControlled ? controlledValue : uncontrolledValue;

    const updateValue = (newValue: number[]) => {
      if (!isControlled) {
        setUncontrolledValue(newValue);
      }
      onValueChange?.(newValue);
    };

    const getValueFromPosition = (clientX: number, clientY: number) => {
      if (!trackRef.current) return 0;

      const rect = trackRef.current.getBoundingClientRect();
      let percentage: number;

      if (orientation === 'horizontal') {
        percentage = (clientX - rect.left) / rect.width;
      } else {
        percentage = (rect.bottom - clientY) / rect.height;
      }

      const rawValue = percentage * (max - min) + min;
      const steppedValue = Math.round(rawValue / step) * step;

      return Math.max(min, Math.min(max, steppedValue));
    };

    const handleThumbMouseDown = (index: number, event: React.MouseEvent) => {
      if (disabled) return;
      event.preventDefault();
      setDraggingIndex(index);
    };

    const handleTrackClick = (event: React.MouseEvent) => {
      if (disabled) return;

      const newValue = getValueFromPosition(event.clientX, event.clientY);

      if (value.length === 1) {
        updateValue([newValue]);
      } else {
        // Find which thumb to move or add new thumb
        let closestIndex = 0;
        let minDistance = Math.abs(newValue - value[0]);

        value.forEach((v, i) => {
          const distance = Math.abs(newValue - v);
          if (distance < minDistance) {
            minDistance = distance;
            closestIndex = i;
          }
        });

        const newValueArray = [...value];
        newValueArray[closestIndex] = newValue;

        // Ensure min steps between thumbs
        if (minStepsBetweenThumbs > 0) {
          newValueArray.sort((a, b) => a - b);
          for (let i = 1; i < newValueArray.length; i++) {
            if (newValueArray[i] - newValueArray[i - 1] < minStepsBetweenThumbs * step) {
              return; // Don't update if too close
            }
          }
        }

        updateValue(newValueArray);
      }
    };

    React.useEffect(() => {
      const handleMouseMove = (event: MouseEvent) => {
        if (draggingIndex === null || disabled) return;

        const newValue = getValueFromPosition(event.clientX, event.clientY);
        const newValueArray = [...value];

        // Check bounds with adjacent thumbs
        const prevValue = value[draggingIndex - 1] ?? min - minStepsBetweenThumbs * step;
        const nextValue = value[draggingIndex + 1] ?? max + minStepsBetweenThumbs * step;

        const clampedValue = Math.max(
          prevValue + minStepsBetweenThumbs * step,
          Math.min(nextValue - minStepsBetweenThumbs * step, newValue)
        );

        newValueArray[draggingIndex] = clampedValue;
        updateValue(newValueArray);
      };

      const handleMouseUp = () => {
        setDraggingIndex(null);
      };

      if (draggingIndex !== null) {
        document.addEventListener('mousemove', handleMouseMove);
        document.addEventListener('mouseup', handleMouseUp);

        return () => {
          document.removeEventListener('mousemove', handleMouseMove);
          document.removeEventListener('mouseup', handleMouseUp);
        };
      }
    }, [draggingIndex, value, min, max, step, minStepsBetweenThumbs, disabled]);

    // Keyboard navigation
    const handleKeyDown = (index: number, event: React.KeyboardEvent) => {
      if (disabled) return;

      const currentValue = value[index];
      let newValue = currentValue;

      switch (event.key) {
        case 'ArrowRight':
        case 'ArrowUp':
          newValue = Math.min(max, currentValue + step);
          break;
        case 'ArrowLeft':
        case 'ArrowDown':
          newValue = Math.max(min, currentValue - step);
          break;
        case 'Home':
          newValue = min;
          break;
        case 'End':
          newValue = max;
          break;
        case 'PageUp':
          newValue = Math.min(max, currentValue + step * 10);
          break;
        case 'PageDown':
          newValue = Math.max(min, currentValue - step * 10);
          break;
        default:
          return;
      }

      event.preventDefault();
      const newValueArray = [...value];
      newValueArray[index] = newValue;
      updateValue(newValueArray);
    };

    // Calculate percentage for fill
    const getFillPercentage = () => {
      if (value.length === 1) {
        return ((value[0] - min) / (max - min)) * 100;
      }
      // For range slider with two thumbs
      if (value.length === 2) {
        const start = ((value[0] - min) / (max - min)) * 100;
        const end = ((value[1] - min) / (max - min)) * 100;
        return { start, end };
      }
      return 0;
    };

    const fillPercentage = getFillPercentage();
    const isRange = value.length > 1;

    return (
      <div
        ref={ref}
        className={cn(
          sliderVariants({ size, variant }),
          orientation === 'vertical' && 'flex-col h-48 w-auto',
          disabled && 'opacity-50 cursor-not-allowed',
          className
        )}
        {...props}
      >
        <div
          ref={trackRef}
          className={cn(
            trackVariants({ size }),
            'w-full bg-muted',
            orientation === 'vertical' && 'h-full w-full'
          )}
          onClick={handleTrackClick}
          aria-disabled={disabled}
        >
          {/* Fill/progress */}
          {isRange && typeof fillPercentage === 'object' ? (
            <div
              className={cn(
                trackVariants({ size }),
                'absolute bg-primary'
              )}
              style={{
                [orientation === 'horizontal' ? 'left' : 'bottom']: `${fillPercentage.start}%`,
                [orientation === 'horizontal' ? 'width' : 'height']: `${fillPercentage.end - fillPercentage.start}%`,
              }}
            />
          ) : (
            <div
              className={cn(
                trackVariants({ size }),
                'absolute bg-primary left-0 top-0',
                orientation === 'vertical' && 'bottom-0 left-0 h-auto'
              )}
              style={{
                [orientation === 'horizontal' ? 'width' : 'height']: `${fillPercentage}%`,
              }}
            />
          )}

          {/* Thumbs */}
          {value.map((v, i) => (
            <button
              key={i}
              ref={(el) => (thumbRefs.current[i] = el)}
              type="button"
              id={id ? `${id}-${i}` : undefined}
              className={cn(
                thumbVariants({
                  size,
                  state: draggingIndex === i ? 'dragging' : 'default',
                }),
                'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2',
                'top-1/2 -translate-y-1/2'
              )}
              style={{
                left: orientation === 'horizontal' ? `${((v - min) / (max - min)) * 100}%` : undefined,
                bottom: orientation === 'vertical' ? `${((v - min) / (max - min)) * 100}%` : undefined,
                [orientation === 'vertical' ? 'left' : 'bottom']: orientation === 'vertical' ? '50%' : undefined,
                transform: orientation === 'horizontal'
                  ? 'translate(-50%, -50%)'
                  : 'translate(-50%, 50%)',
              }}
              onMouseDown={(e) => handleThumbMouseDown(i, e)}
              onKeyDown={(e) => handleKeyDown(i, e)}
              disabled={disabled}
              aria-valuemin={min}
              aria-valuemax={max}
              aria-valuenow={v}
              aria-valuetext={formatValue?.(v) ?? v.toString()}
              aria-disabled={disabled}
              tabIndex={disabled ? -1 : 0}
            >
              <span className="sr-only">{formatValue?.(v) ?? v}</span>
            </button>
          ))}
        </div>

        {/* Value display */}
        {showValue && value.length === 1 && (
          <div className="mt-2 text-sm text-muted-foreground">
            {formatValue?.(value[0]) ?? value[0]}
          </div>
        )}
      </div>
    );
  }
);
Slider.displayName = 'Slider';

export { Slider, sliderVariants, trackVariants, thumbVariants };
