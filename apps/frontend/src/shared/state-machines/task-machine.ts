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
      hasCompletedSubtasks: boolean; // true if any subtask is completed (coding started)
      requireReviewBeforeCoding: boolean;
      isQAApproved: boolean; // true if planStatus === "completed" from plan file
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
    types: {} as {
      context: TaskMachineContext;
      events: TaskMachineEvent;
    },
    context: {
      reviewReason: undefined
    },
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
        // QA approved (planStatus === "completed") - always go to human_review with completed
        { guard: 'processExitedQAApproved', target: '.human_review', actions: 'setReviewReasonCompleted' },
        // All subtasks done - completed
        { guard: 'processExitedSuccessAllDone', target: '.human_review', actions: 'setReviewReasonCompleted' },
        // Has some completed subtasks (coding done) - completed review
        { guard: 'processExitedHasCompletedSubtasks', target: '.human_review', actions: 'setReviewReasonCompleted' },
        // Plan review - only when requireReviewBeforeCoding AND no coding has started
        { guard: 'processExitedPlanReview', target: '.awaitingPlanReview', actions: 'setReviewReasonPlan' },
        // Fallback: process exited successfully but subtasks not all done - go to human_review for inspection
        { guard: 'processExitedSuccess', target: '.human_review', actions: 'setReviewReasonStopped' }
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
      // QA approved (planStatus === "completed" from plan file)
      processExitedQAApproved: ({ event }) =>
        event.type === 'PROCESS_EXITED' && event.exitCode === 0 && event.isQAApproved,
      // All subtasks completed
      processExitedSuccessAllDone: ({ event }) =>
        event.type === 'PROCESS_EXITED' && event.exitCode === 0 && event.hasSubtasks && event.allSubtasksDone,
      // Has some completed subtasks (coding has progressed)
      processExitedHasCompletedSubtasks: ({ event }) =>
        event.type === 'PROCESS_EXITED' && event.exitCode === 0 && event.hasCompletedSubtasks,
      // Plan review is only triggered when:
      // - Process exited successfully
      // - requireReviewBeforeCoding is true
      // - No subtasks have been completed yet (coding hasn't started)
      // - Not QA approved
      processExitedPlanReview: ({ event }) =>
        event.type === 'PROCESS_EXITED' &&
        event.exitCode === 0 &&
        event.requireReviewBeforeCoding === true &&
        !event.hasCompletedSubtasks &&
        !event.isQAApproved,
      processExitedSuccess: ({ event }) =>
        event.type === 'PROCESS_EXITED' && event.exitCode === 0,
      manualSetBacklog: ({ event }) => event.type === 'MANUAL_SET_STATUS' && event.status === 'backlog',
      manualSetHumanReview: ({ event }) => event.type === 'MANUAL_SET_STATUS' && event.status === 'human_review',
      manualSetDone: ({ event }) => event.type === 'MANUAL_SET_STATUS' && event.status === 'done'
    },
    actions: {
      setReviewReasonPlan: assign({ reviewReason: (): ReviewReason => 'plan_review' }),
      setReviewReasonCompleted: assign({ reviewReason: (): ReviewReason => 'completed' }),
      setReviewReasonErrors: assign({ reviewReason: (): ReviewReason => 'errors' }),
      setReviewReasonQaRejected: assign({ reviewReason: (): ReviewReason => 'qa_rejected' }),
      setReviewReasonStopped: assign({ reviewReason: (): ReviewReason => 'stopped' }),
      setReviewReasonFromEvent: assign({
        reviewReason: ({ event }): ReviewReason | undefined =>
          event.type === 'MANUAL_SET_STATUS' ? event.reviewReason : undefined
      }),
      clearReviewReason: assign({ reviewReason: (): undefined => undefined })
    }
  }
);
