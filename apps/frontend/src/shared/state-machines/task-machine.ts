import { assign, createMachine } from 'xstate';
import type { ReviewReason } from '../types';

export type TaskMachineContext = {
  reviewReason?: ReviewReason;
};

export type TaskMachineEvent =
  | { type: 'PLANNING_STARTED' }
  | { type: 'PLANNING_COMPLETE'; requireReviewBeforeCoding: boolean }
  | { type: 'CODING_STARTED' }
  | { type: 'QA_STARTED' }
  | { type: 'QA_PASSED' }
  | { type: 'QA_FAILED' }
  | {
      type: 'PROCESS_EXITED';
      exitCode: number;
      hasSubtasks: boolean;
      allSubtasksDone: boolean;
      requireReviewBeforeCoding: boolean;
    }
  | {
      type: 'MANUAL_SET_STATUS';
      status: 'backlog' | 'human_review' | 'done';
      reviewReason?: ReviewReason;
    }
  | { type: 'USER_STOPPED' }
  | { type: 'USER_RESUMED' };

export const taskMachine = createMachine(
  {
    id: 'taskMachine',
    initial: 'backlog',
    context: {
      reviewReason: undefined
    } satisfies TaskMachineContext,
    states: {
      backlog: {
        on: {
          PLANNING_STARTED: 'planning'
        }
      },
      planning: {
        on: {
          PLANNING_COMPLETE: [
            { target: 'awaitingPlanReview', guard: 'requiresReview', actions: 'setReviewReasonPlan' },
            { target: 'coding', actions: 'clearReviewReason' }
          ],
          USER_STOPPED: { target: 'backlog', actions: 'clearReviewReason' }
        }
      },
      awaitingPlanReview: {
        on: {
          USER_RESUMED: { target: 'coding', actions: 'clearReviewReason' },
          USER_STOPPED: { target: 'backlog', actions: 'clearReviewReason' }
        }
      },
      coding: {
        on: {
          QA_STARTED: 'qa_review',
          USER_STOPPED: { target: 'backlog', actions: 'clearReviewReason' }
        }
      },
      qa_review: {
        on: {
          QA_PASSED: { target: 'human_review', actions: 'setReviewReasonCompleted' },
          QA_FAILED: { target: 'qa_fixing', actions: 'setReviewReasonQaRejected' },
          USER_STOPPED: { target: 'backlog', actions: 'clearReviewReason' }
        }
      },
      qa_fixing: {
        on: {
          QA_PASSED: { target: 'human_review', actions: 'setReviewReasonCompleted' },
          QA_FAILED: { target: 'human_review', actions: 'setReviewReasonQaRejected' },
          USER_STOPPED: { target: 'backlog', actions: 'clearReviewReason' }
        }
      },
      human_review: {
        on: {
          USER_RESUMED: { target: 'coding', actions: 'clearReviewReason' }
        }
      },
      error: {
        on: {
          USER_RESUMED: { target: 'coding', actions: 'clearReviewReason' }
        }
      },
      done: {
        type: 'final'
      }
    },
    on: {
      PROCESS_EXITED: [
        { guard: 'processExitedFailed', target: '.error', actions: 'setReviewReasonErrors' },
        { guard: 'processExitedPlanReview', target: '.awaitingPlanReview', actions: 'setReviewReasonPlan' },
        { guard: 'processExitedSuccessAllDone', target: '.human_review', actions: 'setReviewReasonCompleted' }
      ],
      MANUAL_SET_STATUS: [
        { guard: 'manualSetBacklog', target: '.backlog', actions: 'clearReviewReason' },
        { guard: 'manualSetHumanReview', target: '.human_review', actions: 'setReviewReasonFromEvent' },
        { guard: 'manualSetDone', target: '.done', actions: 'clearReviewReason' }
      ]
    }
  },
  {
    guards: {
      requiresReview: ({ event }) =>
        event.type === 'PLANNING_COMPLETE' && event.requireReviewBeforeCoding === true,
      processExitedFailed: ({ event }) =>
        event.type === 'PROCESS_EXITED' && event.exitCode !== 0,
      processExitedPlanReview: ({ event }) =>
        event.type === 'PROCESS_EXITED' && event.requireReviewBeforeCoding === true,
      processExitedSuccessAllDone: ({ event }) =>
        event.type === 'PROCESS_EXITED' && event.exitCode === 0 && event.hasSubtasks && event.allSubtasksDone,
      manualSetBacklog: ({ event }) => event.type === 'MANUAL_SET_STATUS' && event.status === 'backlog',
      manualSetHumanReview: ({ event }) => event.type === 'MANUAL_SET_STATUS' && event.status === 'human_review',
      manualSetDone: ({ event }) => event.type === 'MANUAL_SET_STATUS' && event.status === 'done'
    },
    actions: {
      setReviewReasonPlan: assign({ reviewReason: () => 'plan_review' }),
      setReviewReasonCompleted: assign({ reviewReason: () => 'completed' }),
      setReviewReasonErrors: assign({ reviewReason: () => 'errors' }),
      setReviewReasonQaRejected: assign({ reviewReason: () => 'qa_rejected' }),
      setReviewReasonFromEvent: assign({
        reviewReason: ({ event }) =>
          event.type === 'MANUAL_SET_STATUS' ? event.reviewReason : undefined
      }),
      clearReviewReason: assign({ reviewReason: () => undefined })
    }
  }
);
