/**
 * Agent Events Facade
 * ====================
 * Thin facade that delegates to specialized phase parsers.
 * Maintains backward compatibility while using cleaner internals.
 */

import { ExecutionProgressData } from './types';
import {
  ExecutionPhaseParser,
  IdeationPhaseParser,
  RoadmapPhaseParser,
  type ExecutionParserContext,
  type IdeationParserContext
} from './parsers';
import { type ExecutionPhase, isTerminalPhase } from '../../shared/constants/phase-protocol';
import { EXECUTION_PHASE_WEIGHTS } from '../../shared/constants/task';

/**
 * Agent events facade for phase parsing and progress calculation.
 * Uses specialized parsers internally for single responsibility.
 */
export class AgentEvents {
  private readonly executionParser = new ExecutionPhaseParser();
  private readonly ideationParser = new IdeationPhaseParser();
  private readonly roadmapParser = new RoadmapPhaseParser();

  /**
   * Parse execution phase from log line.
   * Delegates to ExecutionPhaseParser.
   *
   * @param log - The log line to parse
   * @param currentPhase - Current execution phase
   * @param isSpecRunner - Whether this is a spec runner execution
   * @returns Parsed phase result or null
   */
  parseExecutionPhase(
    log: string,
    currentPhase: ExecutionProgressData['phase'],
    isSpecRunner: boolean
  ): { phase: ExecutionProgressData['phase']; message?: string; currentSubtask?: string } | null {
    const context: ExecutionParserContext = {
      currentPhase: currentPhase as ExecutionPhase,
      isTerminal: isTerminalPhase(currentPhase as ExecutionPhase),
      isSpecRunner
    };

    const result = this.executionParser.parse(log, context);
    if (!result) {
      return null;
    }

    return {
      phase: result.phase as ExecutionProgressData['phase'],
      message: result.message,
      currentSubtask: result.currentSubtask
    };
  }

  /**
   * Calculate overall progress based on phase and phase-specific progress.
   *
   * @param phase - Current execution phase
   * @param phaseProgress - Progress within the current phase (0-100)
   * @returns Overall progress (0-100)
   */
  calculateOverallProgress(phase: ExecutionProgressData['phase'], phaseProgress: number): number {
    const phaseWeight = EXECUTION_PHASE_WEIGHTS[phase] || { start: 0, end: 0 };
    const phaseRange = phaseWeight.end - phaseWeight.start;
    return Math.round(phaseWeight.start + (phaseRange * phaseProgress) / 100);
  }

  /**
   * Parse ideation progress from log output.
   * Delegates to IdeationPhaseParser.
   *
   * @param log - The log line to parse
   * @param currentPhase - Current ideation phase
   * @param currentProgress - Current progress percentage
   * @param completedTypes - Set of completed ideation types
   * @param totalTypes - Total number of ideation types
   * @returns Updated phase and progress
   */
  parseIdeationProgress(
    log: string,
    currentPhase: string,
    currentProgress: number,
    completedTypes: Set<string>,
    totalTypes: number
  ): { phase: string; progress: number } {
    const context: IdeationParserContext = {
      currentPhase: currentPhase as 'idle' | 'analyzing' | 'discovering' | 'generating' | 'finalizing' | 'complete',
      isTerminal: currentPhase === 'complete',
      completedTypes,
      totalTypes
    };

    const result = this.ideationParser.parse(log, context);
    if (!result) {
      return { phase: currentPhase, progress: currentProgress };
    }

    return {
      phase: result.phase,
      progress: result.progress
    };
  }

  /**
   * Parse roadmap progress from log output.
   * Delegates to RoadmapPhaseParser.
   *
   * @param log - The log line to parse
   * @param currentPhase - Current roadmap phase
   * @param currentProgress - Current progress percentage
   * @returns Updated phase and progress
   */
  parseRoadmapProgress(
    log: string,
    currentPhase: string,
    currentProgress: number
  ): { phase: string; progress: number } {
    const context = {
      currentPhase: currentPhase as 'idle' | 'analyzing' | 'discovering' | 'generating' | 'complete',
      isTerminal: currentPhase === 'complete'
    };

    const result = this.roadmapParser.parse(log, context);
    if (!result) {
      return { phase: currentPhase, progress: currentProgress };
    }

    return {
      phase: result.phase,
      progress: result.progress
    };
  }
}
