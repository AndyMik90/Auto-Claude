/**
 * Mock implementation for file operations
 */

export const fileMock = {
  // File explorer
  listDirectory: async () => ({
    success: true,
    data: []
  }),

  // Code editor operations
  codeEditorListDir: async () => ({
    success: true,
    data: [
      { name: 'src', relPath: 'src', isDir: true },
      { name: 'README.md', relPath: 'README.md', isDir: false },
      { name: 'package.json', relPath: 'package.json', isDir: false }
    ]
  }),

  codeEditorReadFile: async (_workspaceRoot: string, relPath: string) => ({
    success: true,
    data: `// Mock content for ${relPath}\n// This is a browser mock - file operations are not available in browser mode.\n`
  }),

  codeEditorWriteFile: async () => ({
    success: true
  }),

  codeEditorSearchText: async (_workspaceRoot: string, query: string) => ({
    success: true,
    data: [
      {
        relPath: 'src/example.ts',
        matches: [
          {
            line: 10,
            column: 5,
            preview: `  const result = ${query}();`
          },
          {
            line: 25,
            column: 12,
            preview: `  // TODO: ${query} implementation`
          }
        ]
      }
    ]
  })
};
