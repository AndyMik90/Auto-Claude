/**
 * GitHub PR Label Sync
 *
 * Syncs Auto Claude review status to GitHub PR labels.
 * Labels use "AC:" prefix for identification.
 *
 * Colors for GitHub setup:
 *   AC: Approved          #22C55E (green)
 *   AC: Changes Requested #EF4444 (red)
 *   AC: Reviewed          #3B82F6 (blue) - comment-only review
 *   AC: Needs Re-review   #F59E0B (amber)
 */

import { githubFetch } from '../utils';

const LABEL_PREFIX = 'AC:';

export const AC_LABELS = {
  APPROVED: 'AC: Approved',
  CHANGES_REQUESTED: 'AC: Changes Requested',
  REVIEWED: 'AC: Reviewed',
  NEEDS_REREVIEW: 'AC: Needs Re-review',
} as const;

export type ReviewStatus = 'approve' | 'request_changes' | 'comment';

function mapStatusToLabel(status: ReviewStatus): string {
  switch (status) {
    case 'approve':
      return AC_LABELS.APPROVED;
    case 'request_changes':
      return AC_LABELS.CHANGES_REQUESTED;
    case 'comment':
      return AC_LABELS.REVIEWED;
  }
}

async function fetchCurrentLabels(
  token: string,
  repo: string,
  prNumber: number
): Promise<string[]> {
  const labels = (await githubFetch(
    token,
    `/repos/${repo}/issues/${prNumber}/labels`
  )) as Array<{ name: string }>;
  return labels.map((l) => l.name);
}

async function removeLabel(
  token: string,
  repo: string,
  prNumber: number,
  label: string
): Promise<void> {
  await githubFetch(
    token,
    `/repos/${repo}/issues/${prNumber}/labels/${encodeURIComponent(label)}`,
    { method: 'DELETE' }
  );
}

async function addLabel(
  token: string,
  repo: string,
  prNumber: number,
  label: string
): Promise<void> {
  await githubFetch(token, `/repos/${repo}/issues/${prNumber}/labels`, {
    method: 'POST',
    body: JSON.stringify({ labels: [label] }),
  });
}

function getACLabelsToRemove(currentLabels: string[], keepLabel: string): string[] {
  return currentLabels.filter(
    (label) => label.startsWith(LABEL_PREFIX) && label !== keepLabel
  );
}

async function removeOldACLabels(
  token: string,
  repo: string,
  prNumber: number,
  currentLabels: string[],
  keepLabel: string
): Promise<void> {
  const labelsToRemove = getACLabelsToRemove(currentLabels, keepLabel);

  await Promise.allSettled(
    labelsToRemove.map((label) => removeLabel(token, repo, prNumber, label))
  );
}

/**
 * Updates AC label on a PR: removes old AC labels and applies the new one.
 * Label sync is non-critical, so errors are silently ignored.
 */
async function updateACLabel(
  token: string,
  repo: string,
  prNumber: number,
  newLabel: string
): Promise<void> {
  try {
    const currentLabels = await fetchCurrentLabels(token, repo, prNumber);
    await removeOldACLabels(token, repo, prNumber, currentLabels, newLabel);
    await addLabel(token, repo, prNumber, newLabel);
  } catch {
    // Label sync is non-critical, fail silently
  }
}

/**
 * Syncs PR label based on review status.
 * Removes previous AC labels and applies the appropriate one.
 */
export async function syncPRLabel(
  token: string,
  repo: string,
  prNumber: number,
  status: ReviewStatus
): Promise<void> {
  await updateACLabel(token, repo, prNumber, mapStatusToLabel(status));
}

/**
 * Marks PR as needing re-review after new commits are pushed.
 */
export async function markPRNeedsRereview(
  token: string,
  repo: string,
  prNumber: number
): Promise<void> {
  await updateACLabel(token, repo, prNumber, AC_LABELS.NEEDS_REREVIEW);
}
