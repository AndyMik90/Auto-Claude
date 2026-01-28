import { createActor, type ActorRefFrom } from 'xstate';
import { afterEach, describe, expect, it } from 'vitest';
import { taskMachine } from '../task-machine';

describe('taskMachine', () => {
  let actor: ActorRefFrom<typeof taskMachine> | null = null;

  afterEach(() => {
    if (actor) {
      actor.stop();
      actor = null;
    }
  });

  it('moves to awaitingPlanReview when planning completes with review required', () => {
    actor = createActor(taskMachine).start();

    actor.send({ type: 'PLANNING_STARTED' });
    actor.send({ type: 'PLANNING_COMPLETE', requireReviewBeforeCoding: true });

    const snapshot = actor.getSnapshot();
    expect(snapshot.value).toBe('awaitingPlanReview');
    expect(snapshot.context.reviewReason).toBe('plan_review');
  });

  it('moves to coding when planning completes without review', () => {
    actor = createActor(taskMachine).start();

    actor.send({ type: 'PLANNING_STARTED' });
    actor.send({ type: 'PLANNING_COMPLETE', requireReviewBeforeCoding: false });

    const snapshot = actor.getSnapshot();
    expect(snapshot.value).toBe('coding');
    expect(snapshot.context.reviewReason).toBeUndefined();
  });

  it('moves to human_review completed on successful process exit with all subtasks done', () => {
    actor = createActor(taskMachine).start();

    actor.send({
      type: 'PROCESS_EXITED',
      exitCode: 0,
      hasSubtasks: true,
      allSubtasksDone: true,
      hasCompletedSubtasks: true,
      requireReviewBeforeCoding: false,
      isQAApproved: false
    });

    const snapshot = actor.getSnapshot();
    expect(snapshot.value).toBe('human_review');
    expect(snapshot.context.reviewReason).toBe('completed');
  });

  it('moves to human_review completed when QA approved', () => {
    actor = createActor(taskMachine).start();

    actor.send({
      type: 'PROCESS_EXITED',
      exitCode: 0,
      hasSubtasks: true,
      allSubtasksDone: false,
      hasCompletedSubtasks: true,
      requireReviewBeforeCoding: true,
      isQAApproved: true // planStatus === "completed" from QA approval
    });

    const snapshot = actor.getSnapshot();
    expect(snapshot.value).toBe('human_review');
    expect(snapshot.context.reviewReason).toBe('completed');
  });

  it('moves to awaitingPlanReview when requireReviewBeforeCoding and no coding started', () => {
    actor = createActor(taskMachine).start();

    actor.send({
      type: 'PROCESS_EXITED',
      exitCode: 0,
      hasSubtasks: true,
      allSubtasksDone: false,
      hasCompletedSubtasks: false, // No coding started
      requireReviewBeforeCoding: true,
      isQAApproved: false
    });

    const snapshot = actor.getSnapshot();
    expect(snapshot.value).toBe('awaitingPlanReview');
    expect(snapshot.context.reviewReason).toBe('plan_review');
  });

  it('moves to error on non-zero process exit', () => {
    actor = createActor(taskMachine).start();

    actor.send({
      type: 'PROCESS_EXITED',
      exitCode: 1,
      hasSubtasks: false,
      allSubtasksDone: false,
      hasCompletedSubtasks: false,
      requireReviewBeforeCoding: false,
      isQAApproved: false
    });

    const snapshot = actor.getSnapshot();
    expect(snapshot.value).toBe('error');
    expect(snapshot.context.reviewReason).toBe('errors');
  });

  it('returns to backlog when USER_STOPPED during planning', () => {
    actor = createActor(taskMachine).start();

    actor.send({ type: 'PLANNING_STARTED' });
    expect(actor.getSnapshot().value).toBe('planning');

    actor.send({ type: 'USER_STOPPED' });

    const snapshot = actor.getSnapshot();
    expect(snapshot.value).toBe('backlog');
    expect(snapshot.context.reviewReason).toBeUndefined();
  });

  it('returns to backlog when USER_STOPPED during coding', () => {
    actor = createActor(taskMachine).start();

    actor.send({ type: 'PLANNING_STARTED' });
    actor.send({ type: 'PLANNING_COMPLETE', requireReviewBeforeCoding: false });
    expect(actor.getSnapshot().value).toBe('coding');

    actor.send({ type: 'USER_STOPPED' });

    const snapshot = actor.getSnapshot();
    expect(snapshot.value).toBe('backlog');
    expect(snapshot.context.reviewReason).toBeUndefined();
  });

  it('moves to coding when USER_RESUMED from awaitingPlanReview', () => {
    actor = createActor(taskMachine).start();

    actor.send({ type: 'PLANNING_STARTED' });
    actor.send({ type: 'PLANNING_COMPLETE', requireReviewBeforeCoding: true });
    expect(actor.getSnapshot().value).toBe('awaitingPlanReview');

    actor.send({ type: 'USER_RESUMED' });

    const snapshot = actor.getSnapshot();
    expect(snapshot.value).toBe('coding');
    expect(snapshot.context.reviewReason).toBeUndefined();
  });

  it('handles MANUAL_SET_STATUS to backlog', () => {
    actor = createActor(taskMachine).start();

    actor.send({ type: 'PLANNING_STARTED' });
    actor.send({ type: 'PLANNING_COMPLETE', requireReviewBeforeCoding: false });
    expect(actor.getSnapshot().value).toBe('coding');

    actor.send({ type: 'MANUAL_SET_STATUS', status: 'backlog' });

    const snapshot = actor.getSnapshot();
    expect(snapshot.value).toBe('backlog');
    expect(snapshot.context.reviewReason).toBeUndefined();
  });

  it('handles MANUAL_SET_STATUS to human_review with reviewReason', () => {
    actor = createActor(taskMachine).start();

    actor.send({ type: 'MANUAL_SET_STATUS', status: 'human_review', reviewReason: 'completed' });

    const snapshot = actor.getSnapshot();
    expect(snapshot.value).toBe('human_review');
    expect(snapshot.context.reviewReason).toBe('completed');
  });

  it('handles MANUAL_SET_STATUS to done', () => {
    actor = createActor(taskMachine).start();

    actor.send({ type: 'MANUAL_SET_STATUS', status: 'done' });

    const snapshot = actor.getSnapshot();
    expect(snapshot.value).toBe('done');
    expect(snapshot.context.reviewReason).toBeUndefined();
  });
});
