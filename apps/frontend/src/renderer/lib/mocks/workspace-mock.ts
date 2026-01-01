/**
 * Mock implementation for workspace management operations
 */

export const workspaceMock = {
  getWorktreeStatus: async () => ({
    success: true,
    data: {
      exists: true,
      worktreePath: '/Users/demo/projects/sample-project/.worktrees/003-fix-bug',
      branch: 'auto-claude/fix-pagination-bug',
      baseBranch: 'main',
      commitCount: 3,
      filesChanged: 5,
      additions: 127,
      deletions: 23
    }
  }),

  getWorktreeDiff: async () => ({
    success: true,
    data: {
      files: [],
      summary: 'No changes'
    }
  }),

  mergeWorktree: async () => ({
    success: true,
    data: {
      success: true,
      message: 'Merge completed successfully'
    }
  }),

  mergeWorktreePreview: async () => ({
    success: true,
    data: {
      success: true,
      message: 'Preview generated',
      preview: {
        files: ['src/index.ts', 'src/utils.ts'],
        conflicts: [
          {
            file: 'src/utils.ts',
            location: 'lines 10-15',
            tasks: ['task-001'],
            severity: 'low' as const,
            canAutoMerge: true,
            strategy: 'append',
            reason: 'Non-overlapping additions'
          }
        ],
        summary: {
          totalFiles: 2,
          conflictFiles: 1,
          totalConflicts: 1,
          autoMergeable: 1
        }
      }
    }
  }),

  discardWorktree: async () => ({
    success: true,
    data: {
      success: true,
      message: 'Worktree discarded successfully'
    }
  }),

  listWorktrees: async () => ({
    success: true,
    data: {
      worktrees: []
    }
  }),

  worktreeOpenInIDE: async () => ({
    success: true,
    data: { opened: true }
  }),

  worktreeOpenInTerminal: async () => ({
    success: true,
    data: { opened: true }
  }),

  worktreeDetectTools: async () => ({
    success: true,
    data: {
      ides: [
        { id: 'vscode', name: 'Visual Studio Code', path: '/Applications/Visual Studio Code.app', installed: true }
      ],
      terminals: [
        { id: 'system', name: 'System Terminal', path: '', installed: true }
      ]
    }
  }),

  getTaskMergedChanges: async () => ({
    success: true,
    data: {
      found: true,
      taskBranch: 'auto-claude/mock-task',
      baseBranch: 'main',
      commits: [
        {
          hash: 'abc123def456',
          shortHash: 'abc123d',
          message: 'feat: implement mock feature',
          author: 'Claude',
          date: new Date().toISOString()
        }
      ],
      files: [
        {
          path: 'src/mock-file.ts',
          additions: 50,
          deletions: 10,
          status: 'modified' as const,
          hunks: [
            {
              oldStart: 1,
              oldCount: 5,
              newStart: 1,
              newCount: 8,
              lines: [
                { type: 'context' as const, content: 'import { useState } from "react";', oldLineNumber: 1, newLineNumber: 1 },
                { type: 'context' as const, content: '', oldLineNumber: 2, newLineNumber: 2 },
                { type: 'removed' as const, content: 'export function OldComponent() {', oldLineNumber: 3 },
                { type: 'added' as const, content: 'export function NewComponent() {', newLineNumber: 3 },
                { type: 'added' as const, content: '  const [count, setCount] = useState(0);', newLineNumber: 4 },
                { type: 'added' as const, content: '', newLineNumber: 5 },
                { type: 'context' as const, content: '  return (', oldLineNumber: 4, newLineNumber: 6 },
                { type: 'removed' as const, content: '    <div>Hello</div>', oldLineNumber: 5 },
                { type: 'added' as const, content: '    <div onClick={() => setCount(c => c + 1)}>', newLineNumber: 7 },
                { type: 'added' as const, content: '      Count: {count}', newLineNumber: 8 },
                { type: 'added' as const, content: '    </div>', newLineNumber: 9 }
              ]
            }
          ]
        },
        {
          path: 'src/new-file.ts',
          additions: 20,
          deletions: 0,
          status: 'added' as const,
          hunks: [
            {
              oldStart: 0,
              oldCount: 0,
              newStart: 1,
              newCount: 3,
              lines: [
                { type: 'added' as const, content: 'export const CONFIG = {', newLineNumber: 1 },
                { type: 'added' as const, content: '  enabled: true,', newLineNumber: 2 },
                { type: 'added' as const, content: '};', newLineNumber: 3 }
              ]
            }
          ]
        }
      ],
      totalAdditions: 70,
      totalDeletions: 10
    }
  })
};
