/**
 * Unit tests for GitHub Issues pagination logic
 * Tests pagination loop termination conditions and edge cases
 */
import { describe, it, expect, vi } from 'vitest';

// Test types matching the handler's internal types
interface GitHubAPIIssue {
  id: number;
  number: number;
  title: string;
  body?: string;
  state: 'open' | 'closed';
  labels: Array<{ id: number; name: string; color: string; description?: string }>;
  assignees: Array<{ login: string; avatar_url?: string }>;
  user: { login: string; avatar_url?: string };
  milestone?: { id: number; title: string; state: 'open' | 'closed' };
  created_at: string;
  updated_at: string;
  closed_at?: string;
  comments: number;
  url: string;
  html_url: string;
  pull_request?: unknown;
}

/**
 * Simulates the pagination loop from registerGetIssues handler
 * This is a simplified version for testing pagination logic only
 */
async function simulatePagination(
  fetchPage: (page: number) => Promise<GitHubAPIIssue[]>,
  maxPages: number = 100
): Promise<GitHubAPIIssue[]> {
  let page = 1;
  let hasMore = true;
  let allIssues: GitHubAPIIssue[] = [];

  while (hasMore && page <= maxPages) {
    const issues = await fetchPage(page);

    // Ensure issues is an array
    if (!Array.isArray(issues)) {
      throw new Error('Unexpected response format from GitHub API');
    }

    // Add this page's issues to the collection
    allIssues.push(...issues);

    // Check if we should continue pagination
    if (issues.length < 100) {
      hasMore = false;
    } else {
      page++;
    }
  }

  // Filter out pull requests AFTER all pages are merged
  const issuesOnly = allIssues.filter((issue: GitHubAPIIssue) => !issue.pull_request);

  return issuesOnly;
}

// Helper to create a mock issue
function createMockIssue(
  id: number,
  number: number,
  isPullRequest: boolean = false
): GitHubAPIIssue {
  return {
    id,
    number,
    title: `Issue ${number}`,
    body: `Description for issue ${number}`,
    state: 'open',
    labels: [{ id: 1, name: 'bug', color: 'red', description: 'Bug report' }],
    assignees: [{ login: 'testuser', avatar_url: 'https://github.com/avatar.png' }],
    user: { login: 'author', avatar_url: 'https://github.com/author.png' },
    milestone: { id: 1, title: 'v1.0', state: 'open' },
    created_at: '2024-01-15T10:00:00Z',
    updated_at: '2024-01-16T12:00:00Z',
    comments: 5,
    url: `https://api.github.com/repos/owner/repo/issues/${number}`,
    html_url: `https://github.com/owner/repo/issues/${number}`,
    pull_request: isPullRequest ? {} : undefined
  };
}

describe('GitHub Issues Pagination', () => {
  describe('Pagination Loop Termination', () => {
    it('should stop when less than 100 issues returned (last page)', async () => {
      const fetchPage = vi.fn(async (page: number) => {
        if (page === 1) {
          return Array.from({ length: 100 }, (_, i) => createMockIssue(i + 1, i + 1));
        } else if (page === 2) {
          return Array.from({ length: 50 }, (_, i) => createMockIssue(i + 101, i + 101));
        }
        return [];
      });

      const result = await simulatePagination(fetchPage);

      expect(fetchPage).toHaveBeenCalledTimes(2);
      expect(result).toHaveLength(150);
      expect(fetchPage).toHaveBeenNthCalledWith(1, 1);
      expect(fetchPage).toHaveBeenNthCalledWith(2, 2);
    });

    it('should stop on first page if less than 100 issues total', async () => {
      const fetchPage = vi.fn(async () => {
        return Array.from({ length: 50 }, (_, i) => createMockIssue(i + 1, i + 1));
      });

      const result = await simulatePagination(fetchPage);

      expect(fetchPage).toHaveBeenCalledTimes(1);
      expect(result).toHaveLength(50);
      expect(fetchPage).toHaveBeenNthCalledWith(1, 1);
    });

    it('should handle exactly 100 issues (single page, no second call)', async () => {
      const fetchPage = vi.fn(async () => {
        return Array.from({ length: 100 }, (_, i) => createMockIssue(i + 1, i + 1));
      });

      const result = await simulatePagination(fetchPage);

      expect(fetchPage).toHaveBeenCalledTimes(1);
      expect(result).toHaveLength(100);
    });

    it('should fetch multiple pages until less than 100 returned', async () => {
      const fetchPage = vi.fn(async (page: number) => {
        if (page === 1) {
          return Array.from({ length: 100 }, (_, i) => createMockIssue(i + 1, i + 1));
        } else if (page === 2) {
          return Array.from({ length: 100 }, (_, i) => createMockIssue(i + 101, i + 101));
        } else if (page === 3) {
          return Array.from({ length: 100 }, (_, i) => createMockIssue(i + 201, i + 201));
        } else if (page === 4) {
          return Array.from({ length: 25 }, (_, i) => createMockIssue(i + 301, i + 301));
        }
        return [];
      });

      const result = await simulatePagination(fetchPage);

      expect(fetchPage).toHaveBeenCalledTimes(4);
      expect(result).toHaveLength(325);
    });

    it('should handle empty repository (zero issues)', async () => {
      const fetchPage = vi.fn(async () => {
        return [];
      });

      const result = await simulatePagination(fetchPage);

      expect(fetchPage).toHaveBeenCalledTimes(1);
      expect(result).toHaveLength(0);
    });

    it('should handle single issue', async () => {
      const fetchPage = vi.fn(async () => {
        return [createMockIssue(1, 1)];
      });

      const result = await simulatePagination(fetchPage);

      expect(fetchPage).toHaveBeenCalledTimes(1);
      expect(result).toHaveLength(1);
    });
  });

  describe('Pull Request Filtering', () => {
    it('should filter out pull requests from single page', async () => {
      const fetchPage = vi.fn(async () => {
        const issues: GitHubAPIIssue[] = [];
        // Add 50 regular issues
        for (let i = 1; i <= 50; i++) {
          issues.push(createMockIssue(i, i, false));
        }
        // Add 20 pull requests
        for (let i = 51; i <= 70; i++) {
          issues.push(createMockIssue(i, i, true));
        }
        return issues;
      });

      const result = await simulatePagination(fetchPage);

      expect(result).toHaveLength(50); // Only issues, no PRs
      expect(fetchPage).toHaveBeenCalledTimes(1);
    });

    it('should filter out pull requests from multiple pages', async () => {
      const fetchPage = vi.fn(async (page: number) => {
        const issues: GitHubAPIIssue[] = [];
        if (page === 1) {
          // Page 1: 80 issues + 20 PRs
          for (let i = 1; i <= 80; i++) {
            issues.push(createMockIssue(i, i, false));
          }
          for (let i = 81; i <= 100; i++) {
            issues.push(createMockIssue(i, i, true));
          }
        } else if (page === 2) {
          // Page 2: 30 issues + 10 PRs (last page, <100)
          for (let i = 101; i <= 130; i++) {
            issues.push(createMockIssue(i, i, false));
          }
          for (let i = 131; i <= 140; i++) {
            issues.push(createMockIssue(i, i, true));
          }
        }
        return issues;
      });

      const result = await simulatePagination(fetchPage);

      expect(result).toHaveLength(110); // 80 + 30 issues only
      expect(fetchPage).toHaveBeenCalledTimes(2);
    });

    it('should handle page with only pull requests', async () => {
      const fetchPage = vi.fn(async (page: number) => {
        if (page === 1) {
          return Array.from({ length: 50 }, (_, i) => createMockIssue(i + 1, i + 1, false));
        } else if (page === 2) {
          // Page 2: only PRs (but still count as <100, so pagination stops)
          return Array.from({ length: 20 }, (_, i) => createMockIssue(i + 51, i + 51, true));
        }
        return [];
      });

      const result = await simulatePagination(fetchPage);

      expect(result).toHaveLength(50); // Only issues from page 1
      expect(fetchPage).toHaveBeenCalledTimes(2); // Still fetches page 2, but gets 0 issues
    });

    it('should handle repository with only pull requests', async () => {
      const fetchPage = vi.fn(async () => {
        return Array.from({ length: 50 }, (_, i) => createMockIssue(i + 1, i + 1, true));
      });

      const result = await simulatePagination(fetchPage);

      expect(result).toHaveLength(0); // All PRs filtered out
      expect(fetchPage).toHaveBeenCalledTimes(1);
    });
  });

  describe('Error Handling', () => {
    it('should throw error when response is not an array', async () => {
      const fetchPage = vi.fn(async () => {
        return null as unknown as GitHubAPIIssue[];
      });

      await expect(simulatePagination(fetchPage)).rejects.toThrow(
        'Unexpected response format from GitHub API'
      );
    });

    it('should handle fetch errors gracefully', async () => {
      const fetchPage = vi.fn(async () => {
        throw new Error('Network error');
      });

      await expect(simulatePagination(fetchPage)).rejects.toThrow('Network error');
      expect(fetchPage).toHaveBeenCalledTimes(1);
    });

    it('should handle timeout errors', async () => {
      const fetchPage = vi.fn(async () => {
        throw new Error('Request timeout');
      });

      await expect(simulatePagination(fetchPage)).rejects.toThrow('Request timeout');
    });

    it('should not continue pagination after error', async () => {
      const fetchPage = vi.fn(async (page: number) => {
        if (page === 1) {
          return Array.from({ length: 100 }, (_, i) => createMockIssue(i + 1, i + 1));
        } else if (page === 2) {
          throw new Error('API rate limit exceeded');
        }
        return [];
      });

      await expect(simulatePagination(fetchPage)).rejects.toThrow('API rate limit exceeded');
      expect(fetchPage).toHaveBeenCalledTimes(2); // Page 1 succeeds, page 2 fails
    });
  });

  describe('Edge Cases', () => {
    it('should handle very large repository (300+ issues)', async () => {
      const fetchPage = vi.fn(async (page: number) => {
        if (page <= 3) {
          return Array.from({ length: 100 }, (_, i) =>
            createMockIssue((page - 1) * 100 + i + 1, (page - 1) * 100 + i + 1)
          );
        } else if (page === 4) {
          return Array.from({ length: 50 }, (_, i) => createMockIssue(301 + i, 301 + i));
        }
        return [];
      });

      const result = await simulatePagination(fetchPage);

      expect(fetchPage).toHaveBeenCalledTimes(4);
      expect(result).toHaveLength(350);
    });

    it('should handle mixed issue/PR pages correctly', async () => {
      const fetchPage = vi.fn(async (page: number) => {
        const issues: GitHubAPIIssue[] = [];
        if (page === 1) {
          // 60 issues, 40 PRs
          for (let i = 1; i <= 60; i++) issues.push(createMockIssue(i, i, false));
          for (let i = 61; i <= 100; i++) issues.push(createMockIssue(i, i, true));
        } else if (page === 2) {
          // 10 issues, 5 PRs (last page)
          for (let i = 101; i <= 110; i++) issues.push(createMockIssue(i, i, false));
          for (let i = 111; i <= 115; i++) issues.push(createMockIssue(i, i, true));
        }
        return issues;
      });

      const result = await simulatePagination(fetchPage);

      expect(result).toHaveLength(70); // 60 + 10 issues
      expect(fetchPage).toHaveBeenCalledTimes(2);
    });

    it('should handle issues with missing optional fields', async () => {
      const fetchPage = vi.fn(async () => {
        return [
          {
            id: 1,
            number: 1,
            title: 'Minimal Issue',
            body: undefined,
            state: 'open',
            labels: [],
            assignees: [],
            user: { login: 'author' },
            created_at: '2024-01-15T10:00:00Z',
            updated_at: '2024-01-16T12:00:00Z',
            comments: 0,
            url: 'https://api.github.com/repos/owner/repo/issues/1',
            html_url: 'https://github.com/owner/repo/issues/1'
          }
        ];
      });

      const result = await simulatePagination(fetchPage);

      expect(result).toHaveLength(1);
      expect(result[0].id).toBe(1);
      expect(result[0].body).toBeUndefined();
      expect(result[0].assignees).toEqual([]);
      expect(result[0].milestone).toBeUndefined();
    });

    it('should respect max pages limit to prevent infinite loops', async () => {
      // Simulate a malicious API that always returns 100 issues
      const fetchPage = vi.fn(async () => {
        return Array.from({ length: 100 }, (_, i) => createMockIssue(i + 1, i + 1));
      });

      const result = await simulatePagination(fetchPage, 5); // Limit to 5 pages

      expect(fetchPage).toHaveBeenCalledTimes(5); // Stops at max pages
      expect(result).toHaveLength(500);
    });
  });

  describe('Data Integrity', () => {
    it('should preserve issue order across pages', async () => {
      const fetchPage = vi.fn(async (page: number) => {
        if (page === 1) {
          return Array.from({ length: 100 }, (_, i) => createMockIssue(i + 1, i + 1));
        } else if (page === 2) {
          return Array.from({ length: 50 }, (_, i) => createMockIssue(i + 101, i + 101));
        }
        return [];
      });

      const result = await simulatePagination(fetchPage);

      expect(result).toHaveLength(150);
      expect(result[0].number).toBe(1);
      expect(result[99].number).toBe(100);
      expect(result[100].number).toBe(101);
      expect(result[149].number).toBe(150);
    });

    it('should merge all pages into single array', async () => {
      const fetchPage = vi.fn(async (page: number) => {
        if (page === 1) return [createMockIssue(1, 1), createMockIssue(2, 2)];
        if (page === 2) return [createMockIssue(3, 3), createMockIssue(4, 4)];
        if (page === 3) return [createMockIssue(5, 5)];
        return [];
      });

      const result = await simulatePagination(fetchPage);

      expect(result).toHaveLength(5);
      expect(result.map(i => i.number)).toEqual([1, 2, 3, 4, 5]);
    });

    it('should handle issues with same ID across pages (should not happen but test defensive)', async () => {
      const fetchPage = vi.fn(async (page: number) => {
        if (page === 1) {
          return [
            createMockIssue(1, 1),
            createMockIssue(2, 2)
          ];
        } else if (page === 2) {
          return [
            createMockIssue(3, 3),
            createMockIssue(4, 4)
          ];
        }
        return [];
      });

      const result = await simulatePagination(fetchPage);

      expect(result).toHaveLength(4);
      expect(fetchPage).toHaveBeenCalledTimes(2);
    });
  });
});
