import { useState, useEffect, useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import { motion, AnimatePresence } from 'motion/react';
import { Search, Users, Sparkles, CheckCircle2, AlertCircle, Square, Clock } from 'lucide-react';
import { Button } from './ui/button';
import { Tooltip, TooltipContent, TooltipTrigger } from './ui/tooltip';
import { cn } from '../lib/utils';
import type { RoadmapGenerationStatus } from '../../shared/types/roadmap';

/**
 * Formats elapsed time in seconds into a human-readable string.
 */
function formatElapsedTime(seconds: number): string {
  if (seconds < 0) return '0:00';

  const hours = Math.floor(seconds / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  const secs = Math.floor(seconds % 60);

  if (hours > 0) {
    return `${hours}:${minutes.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  }
  return `${minutes}:${secs.toString().padStart(2, '0')}`;
}

/**
 * Hook to detect user's reduced motion preference.
 */
function useReducedMotion(): boolean {
  const [reducedMotion, setReducedMotion] = useState(() => {
    if (typeof window === 'undefined') return false;
    return window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  });

  useEffect(() => {
    const mediaQuery = window.matchMedia('(prefers-reduced-motion: reduce)');
    const handleChange = (event: MediaQueryListEvent) => {
      setReducedMotion(event.matches);
    };
    mediaQuery.addEventListener('change', handleChange);
    return () => mediaQuery.removeEventListener('change', handleChange);
  }, []);

  return reducedMotion;
}

interface RoadmapGenerationProgressProps {
  generationStatus: RoadmapGenerationStatus;
  className?: string;
  onStop?: () => void | Promise<void>;
}

type GenerationPhase = Exclude<RoadmapGenerationStatus['phase'], 'idle'>;

const PHASE_CONFIG: Record<
  GenerationPhase,
  {
    labelKey: string;
    descriptionKey: string;
    icon: typeof Search;
    color: string;
    bgColor: string;
  }
> = {
  analyzing: {
    labelKey: 'roadmapProgress.phases.analyzing.label',
    descriptionKey: 'roadmapProgress.phases.analyzing.description',
    icon: Search,
    color: 'bg-amber-500',
    bgColor: 'bg-amber-500/20',
  },
  discovering: {
    labelKey: 'roadmapProgress.phases.discovering.label',
    descriptionKey: 'roadmapProgress.phases.discovering.description',
    icon: Users,
    color: 'bg-info',
    bgColor: 'bg-info/20',
  },
  generating: {
    labelKey: 'roadmapProgress.phases.generating.label',
    descriptionKey: 'roadmapProgress.phases.generating.description',
    icon: Sparkles,
    color: 'bg-primary',
    bgColor: 'bg-primary/20',
  },
  complete: {
    labelKey: 'roadmapProgress.phases.complete.label',
    descriptionKey: 'roadmapProgress.phases.complete.description',
    icon: CheckCircle2,
    color: 'bg-success',
    bgColor: 'bg-success/20',
  },
  error: {
    labelKey: 'roadmapProgress.phases.error.label',
    descriptionKey: 'roadmapProgress.phases.error.description',
    icon: AlertCircle,
    color: 'bg-destructive',
    bgColor: 'bg-destructive/20',
  },
};

const STEP_PHASES: { key: GenerationPhase; labelKey: string }[] = [
  { key: 'analyzing', labelKey: 'roadmapProgress.steps.analyze' },
  { key: 'discovering', labelKey: 'roadmapProgress.steps.discover' },
  { key: 'generating', labelKey: 'roadmapProgress.steps.generate' },
];

function HeartbeatIndicator({
  isActive,
  reducedMotion,
  color,
  processingLabel,
  tooltipText,
}: {
  isActive: boolean;
  reducedMotion: boolean;
  color: string;
  processingLabel: string;
  tooltipText: string;
}) {
  if (!isActive) return null;

  const heartbeatAnimation = reducedMotion
    ? { scale: 1, opacity: 1 }
    : {
      scale: [1, 1.05, 1],
      opacity: [0.7, 1, 0.7],
    };

  const heartbeatTransition = reducedMotion
    ? { duration: 0 }
    : {
      duration: 2,
      repeat: Infinity,
      ease: 'easeInOut' as const,
    };

  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <motion.div
          className="flex items-center gap-1.5 cursor-help"
          animate={heartbeatAnimation}
          transition={heartbeatTransition}
        >
          <div className={cn('h-2 w-2 rounded-full', color)} />
          <span className="text-xs text-muted-foreground">{processingLabel}</span>
        </motion.div>
      </TooltipTrigger>
      <TooltipContent>{tooltipText}</TooltipContent>
    </Tooltip>
  );
}

function PhaseStepsIndicator({
  currentPhase,
  reducedMotion,
  t,
}: {
  currentPhase: RoadmapGenerationStatus['phase'];
  reducedMotion: boolean;
  t: (key: string) => string;
}) {
  const getPhaseState = (
    phaseKey: GenerationPhase
  ): 'pending' | 'active' | 'complete' | 'error' => {
    const phaseOrder: GenerationPhase[] = ['analyzing', 'discovering', 'generating', 'complete'];
    const currentIndex = phaseOrder.indexOf(currentPhase as GenerationPhase);
    const phaseIndex = phaseOrder.indexOf(phaseKey);

    if (currentPhase === 'error') return 'error';
    if (currentPhase === 'complete') return 'complete';
    if (phaseKey === currentPhase) return 'active';
    if (phaseIndex < currentIndex) return 'complete';
    return 'pending';
  };

  const getStepAnimation = (state: string) => {
    if (state !== 'active') return { opacity: 1 };
    return reducedMotion ? { opacity: 1 } : { opacity: [1, 0.6, 1] };
  };

  const getStepTransition = (state: string) => {
    if (state !== 'active' || reducedMotion) return undefined;
    return { duration: 1.5, repeat: Infinity, ease: 'easeInOut' as const };
  };

  return (
    <div className="flex items-center justify-center gap-1 mt-4">
      {STEP_PHASES.map((phase, index) => {
        const state = getPhaseState(phase.key);
        return (
          <div key={phase.key} className="flex items-center">
            <motion.div
              className={cn(
                'flex items-center gap-1 px-2 py-1 rounded text-xs font-medium',
                state === 'complete' && 'bg-success/10 text-success',
                state === 'active' && 'bg-primary/10 text-primary',
                state === 'error' && 'bg-destructive/10 text-destructive',
                state === 'pending' && 'bg-muted text-muted-foreground'
              )}
              animate={getStepAnimation(state)}
              transition={getStepTransition(state)}
            >
              {state === 'complete' && (
                <svg
                  className="h-3 w-3"
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={3}
                    d="M5 13l4 4L19 7"
                  />
                </svg>
              )}
              {t(phase.labelKey)}
            </motion.div>
            {index < STEP_PHASES.length - 1 && (
              <div
                className={cn(
                  'w-4 h-px mx-1',
                  getPhaseState(STEP_PHASES[index + 1].key) !== 'pending'
                    ? 'bg-success/50'
                    : 'bg-border'
                )}
              />
            )}
          </div>
        );
      })}
    </div>
  );
}

export function RoadmapGenerationProgress({
  generationStatus,
  className,
  onStop
}: RoadmapGenerationProgressProps) {
  const { t } = useTranslation('common');
  const { phase, progress, message, error, startedAt, lastActivityAt } = generationStatus;
  const reducedMotion = useReducedMotion();
  const [isStopping, setIsStopping] = useState(false);
  const [elapsedTime, setElapsedTime] = useState(0);
  const [lastActivityDisplay, setLastActivityDisplay] = useState('');

  const formatTimeAgo = useCallback((timestamp: Date | string | undefined) => {
    if (!timestamp) return '';

    const date = timestamp instanceof Date ? timestamp : new Date(timestamp);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffSecs = Math.floor(diffMs / 1000);

    if (diffSecs < 5) return t('time.justNow');
    if (diffSecs < 60) return t('time.secondsAgo', { count: diffSecs });

    const diffMins = Math.floor(diffSecs / 60);
    if (diffMins < 60) return t('time.minutesAgo', { count: diffMins });

    const diffHours = Math.floor(diffMins / 60);
    if (diffHours < 24) return t('time.hoursAgo', { count: diffHours });

    const diffDays = Math.floor(diffHours / 24);
    return t('time.daysAgo', { count: diffDays });
  }, [t]);

  const calculateElapsedTime = useCallback(() => {
    if (!startedAt) return 0;
    const startDate = startedAt instanceof Date ? startedAt : new Date(startedAt);
    const now = new Date();
    return Math.floor((now.getTime() - startDate.getTime()) / 1000);
  }, [startedAt]);

  useEffect(() => {
    const isActivePhase = phase !== 'idle' && phase !== 'complete' && phase !== 'error';

    if (!isActivePhase || !startedAt) {
      if (phase === 'idle') {
        setElapsedTime(0);
      }
      return;
    }

    setElapsedTime(calculateElapsedTime());

    const intervalId = setInterval(() => {
      setElapsedTime(calculateElapsedTime());
    }, 1000);

    return () => clearInterval(intervalId);
  }, [phase, startedAt, calculateElapsedTime]);

  useEffect(() => {
    const isActivePhase = phase !== 'idle' && phase !== 'complete' && phase !== 'error';

    if (!isActivePhase || !lastActivityAt) {
      setLastActivityDisplay('');
      return;
    }

    setLastActivityDisplay(formatTimeAgo(lastActivityAt));

    const intervalId = setInterval(() => {
      setLastActivityDisplay(formatTimeAgo(lastActivityAt));
    }, 5000);

    return () => clearInterval(intervalId);
  }, [phase, lastActivityAt, formatTimeAgo]);

  const handleStopClick = async () => {
    if (!onStop || isStopping) return;

    setIsStopping(true);
    try {
      await onStop();
    } catch (err) {
      console.error('Failed to stop generation:', err);
    } finally {
      setIsStopping(false);
    }
  };

  if (phase === 'idle') {
    return null;
  }

  const config = PHASE_CONFIG[phase];
  const Icon = config.icon;
  const isActivePhase = phase !== 'complete' && phase !== 'error';

  const pulseAnimation = reducedMotion
    ? {}
    : {
      scale: [1, 1.1, 1],
      opacity: [1, 0.8, 1],
    };

  const pulseTransition = reducedMotion
    ? { duration: 0 }
    : {
      duration: 1.5,
      repeat: isActivePhase ? Infinity : 0,
      ease: 'easeInOut' as const,
    };

  const dotAnimation = reducedMotion
    ? { scale: 1, opacity: 1 }
    : {
      scale: [1, 1.5, 1],
      opacity: [1, 0.5, 1],
    };

  const dotTransition = reducedMotion
    ? { duration: 0 }
    : {
      duration: 1,
      repeat: Infinity,
      ease: 'easeInOut' as const,
    };

  const indeterminateAnimation = reducedMotion
    ? { x: '150%' }
    : { x: ['-100%', '400%'] };

  const indeterminateTransition = reducedMotion
    ? { duration: 0 }
    : {
      duration: 1.5,
      repeat: Infinity,
      ease: 'easeInOut' as const,
    };

  return (
    <div className={cn('space-y-4 p-6 rounded-xl bg-card border', className)}>
      {isActivePhase && onStop && (
        <div className="flex justify-end mb-2">
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                variant="destructive"
                size="sm"
                onClick={handleStopClick}
                disabled={isStopping}
              >
                <Square className="h-4 w-4 mr-1" />
                {isStopping ? t('roadmapProgress.stopping') : t('buttons.stop')}
              </Button>
            </TooltipTrigger>
            <TooltipContent>{t('roadmapProgress.stopGeneration')}</TooltipContent>
          </Tooltip>
        </div>
      )}

      <div className="flex flex-col items-center text-center space-y-3">
        <div className="relative">
          <motion.div
            className={cn('p-4 rounded-full', config.bgColor)}
            animate={isActivePhase ? pulseAnimation : {}}
            transition={pulseTransition}
          >
            <Icon className={cn('h-8 w-8', config.color.replace('bg-', 'text-'))} />
          </motion.div>
          {isActivePhase && (
            <motion.div
              className={cn('absolute top-0 right-0 h-3 w-3 rounded-full', config.color)}
              animate={dotAnimation}
              transition={dotTransition}
            />
          )}
        </div>

        <AnimatePresence mode="wait">
          <motion.div
            key={phase}
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            transition={{ duration: 0.2 }}
            className="space-y-1"
          >
            <h3 className="text-lg font-semibold">{t(config.labelKey)}</h3>
            <p className="text-sm text-muted-foreground">{t(config.descriptionKey)}</p>
            {message && message !== t(config.descriptionKey) && (
              <p className="text-xs text-muted-foreground mt-1">{message}</p>
            )}
          </motion.div>
        </AnimatePresence>
      </div>

      {isActivePhase && (
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <span className="text-xs text-muted-foreground">{t('roadmapProgress.progress')}</span>
              {startedAt && (
                <div className="flex items-center gap-1 text-xs text-muted-foreground" title={t('roadmapProgress.elapsedTime')}>
                  <Clock className="h-3 w-3" />
                  <span className="tabular-nums">{formatElapsedTime(elapsedTime)}</span>
                </div>
              )}
              {lastActivityDisplay && (
                <Tooltip>
                  <TooltipTrigger asChild>
                    <span className="text-xs text-muted-foreground/70 cursor-help">
                      · {t('roadmapProgress.lastActivityPrefix')} {lastActivityDisplay}
                    </span>
                  </TooltipTrigger>
                  <TooltipContent>
                    {t('roadmapProgress.lastProgressUpdateTooltip')}
                  </TooltipContent>
                </Tooltip>
              )}
            </div>
            <div className="flex items-center gap-3">
              <HeartbeatIndicator
                isActive={isActivePhase}
                reducedMotion={reducedMotion}
                color={config.color}
                processingLabel={t('roadmapProgress.processing')}
                tooltipText={t('roadmapProgress.processActiveTooltip')}
              />
              <span className="text-xs font-medium">{progress}%</span>
            </div>
          </div>
          <div className="relative h-2 w-full overflow-hidden rounded-full bg-border">
            {progress > 0 ? (
              <motion.div
                className={cn('h-full rounded-full', config.color)}
                initial={{ width: 0 }}
                animate={{ width: `${progress}%` }}
                transition={{ duration: 0.5, ease: 'easeOut' }}
              />
            ) : (
              <motion.div
                className={cn('absolute h-full w-1/3 rounded-full', config.color)}
                animate={indeterminateAnimation}
                transition={indeterminateTransition}
              />
            )}
          </div>
        </div>
      )}

      <PhaseStepsIndicator currentPhase={phase} reducedMotion={reducedMotion} t={t} />

      <AnimatePresence mode="wait">
        {error && (
          <motion.div
            key="error-display"
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            transition={{ duration: 0.2 }}
            className="p-3 bg-destructive/10 rounded-md"
          >
            <div className="flex items-start gap-2">
              <AlertCircle className="h-4 w-4 text-destructive flex-shrink-0 mt-0.5" />
              <p className="text-sm text-destructive">{error}</p>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
