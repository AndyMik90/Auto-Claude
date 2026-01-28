import { createActor } from 'xstate';
import { describe, expect, it } from 'vitest';
import { taskMachine } from '../task-machine';

describe('taskMachine', () => {
  it('moves to awaitingPlanReview when planning completes with review required', () => {
    const actor = createActor(taskMachine).start();

    actor.send({ type: 'PLANNING_STARTED' });
    actor.send({ type: 'PLANNING_COMPLETE', requireReviewBeforeCoding: true });

    const snapshot = actor.getSnapshot();
    expect(snapshot.value).toBe('awaitingPlanReview');
    expect(snapshot.context.reviewReason).toBe('plan_review');
  });

  it('moves to coding when planning completes without review', () => {
    const actor = createActor(taskMachine).start();

    actor.send({ type: 'PLANNING_STARTED' });
    actor.send({ type: 'PLANNING_COMPLETE', requireReviewBeforeCoding: false });

    const snapshot = actor.getSnapshot();
    expect(snapshot.value).toBe('coding');
    expect(snapshot.context.reviewReason).toBeUndefined();
  });

  it('moves to human_review completed on successful process exit with all subtasks done', () => {
    const actor = createActor(taskMachine).start();

    actor.send({
      type: 'PROCESS_EXITED',
      exitCode: 0,
      hasSubtasks: true,
      allSubtasksDone: true,
      requireReviewBeforeCoding: false
    });

    const snapshot = actor.getSnapshot();
    expect(snapshot.value).toBe('human_review');
    expect(snapshot.context.reviewReason).toBe('completed');
  });

  it('moves to error on non-zero process exit', () => {
    const actor = createActor(taskMachine).start();

    actor.send({
      type: 'PROCESS_EXITED',
      exitCode: 1,
      hasSubtasks: false,
      allSubtasksDone: false,
      requireReviewBeforeCoding: false
    });

    const snapshot = actor.getSnapshot();
    expect(snapshot.value).toBe('error');
    expect(snapshot.context.reviewReason).toBe('errors');
  });
});
