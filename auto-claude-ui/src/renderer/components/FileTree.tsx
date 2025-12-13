import { useEffect, useCallback } from 'react';
import { FileTreeItem } from './FileTreeItem';
import { useFileExplorerStore } from '../stores/file-explorer-store';
import { Loader2, AlertCircle, FolderOpen } from 'lucide-react';
import type { FileNode } from '../../shared/types';

interface FileTreeProps {
  rootPath: string;
}

interface FileTreeNodeProps {
  node: FileNode;
  depth: number;
}

function FileTreeNode({ node, depth }: FileTreeNodeProps) {
  const {
    isExpanded,
    isLoadingDir,
    getFiles,
    loadDirectory,
    toggleFolder
  } = useFileExplorerStore();

  const expanded = isExpanded(node.path);
  const loading = isLoadingDir(node.path);
  const children = getFiles(node.path);

  // Load children when folder is expanded
  useEffect(() => {
    if (node.isDirectory && expanded && !children && !loading) {
      loadDirectory(node.path);
    }
  }, [node.isDirectory, expanded, children, loading, loadDirectory, node.path]);

  const handleToggle = useCallback(() => {
    toggleFolder(node.path);
    // Load children if expanding and not yet loaded
    if (!expanded && node.isDirectory && !children) {
      loadDirectory(node.path);
    }
  }, [expanded, node.isDirectory, node.path, children, toggleFolder, loadDirectory]);

  return (
    <FileTreeItem
      node={node}
      depth={depth}
      isExpanded={expanded}
      isLoading={loading}
      onToggle={handleToggle}
    >
      {expanded && children && (
        <div>
          {children.map((child) => (
            <FileTreeNode
              key={child.path}
              node={child}
              depth={depth + 1}
            />
          ))}
        </div>
      )}
    </FileTreeItem>
  );
}

export function FileTree({ rootPath }: FileTreeProps) {
  const {
    getFiles,
    loadDirectory,
    isLoadingDir,
    error
  } = useFileExplorerStore();

  const rootFiles = getFiles(rootPath);
  const loading = isLoadingDir(rootPath);

  // Load root directory on mount
  useEffect(() => {
    if (!rootFiles && !loading) {
      loadDirectory(rootPath);
    }
  }, [rootPath, rootFiles, loading, loadDirectory]);

  if (loading && !rootFiles) {
    return (
      <div className="flex items-center justify-center py-8">
        <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex flex-col items-center justify-center py-8 px-4 text-center">
        <AlertCircle className="h-5 w-5 text-destructive mb-2" />
        <p className="text-xs text-destructive">{error}</p>
      </div>
    );
  }

  if (!rootFiles || rootFiles.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-8 px-4 text-center">
        <FolderOpen className="h-6 w-6 text-muted-foreground mb-2" />
        <p className="text-xs text-muted-foreground">No files found</p>
      </div>
    );
  }

  return (
    <div className="py-1">
      {rootFiles.map((node) => (
        <FileTreeNode
          key={node.path}
          node={node}
          depth={0}
        />
      ))}
    </div>
  );
}
