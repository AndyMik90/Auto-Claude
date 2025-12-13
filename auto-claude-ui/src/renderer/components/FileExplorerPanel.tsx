import { motion, AnimatePresence } from 'motion/react';
import { X, FolderTree, RefreshCw } from 'lucide-react';
import { Button } from './ui/button';
import { ScrollArea } from './ui/scroll-area';
import { FileTree } from './FileTree';
import { useFileExplorerStore } from '../stores/file-explorer-store';

interface FileExplorerPanelProps {
  projectPath: string;
}

const panelVariants = {
  hidden: {
    x: '100%',
    opacity: 0
  },
  visible: {
    x: 0,
    opacity: 1,
    transition: {
      type: 'spring' as const,
      damping: 25,
      stiffness: 300
    }
  },
  exit: {
    x: '100%',
    opacity: 0,
    transition: {
      duration: 0.2,
      ease: 'easeIn' as const
    }
  }
};

export function FileExplorerPanel({ projectPath }: FileExplorerPanelProps) {
  const { isOpen, close, clearCache, loadDirectory } = useFileExplorerStore();

  const handleRefresh = () => {
    clearCache();
    loadDirectory(projectPath);
  };

  return (
    <AnimatePresence>
      {isOpen && (
        <motion.div
          variants={panelVariants}
          initial="hidden"
          animate="visible"
          exit="exit"
          className="absolute right-0 top-0 h-full w-72 bg-card border-l border-border z-20 flex flex-col shadow-xl"
        >
          {/* Header */}
          <div className="flex items-center justify-between px-3 py-2 border-b border-border bg-card/80">
            <div className="flex items-center gap-2">
              <FolderTree className="h-4 w-4 text-primary" />
              <span className="text-sm font-medium">Project Files</span>
            </div>
            <div className="flex items-center gap-1">
              <Button
                variant="ghost"
                size="icon"
                className="h-6 w-6"
                onClick={handleRefresh}
                title="Refresh"
              >
                <RefreshCw className="h-3.5 w-3.5" />
              </Button>
              <Button
                variant="ghost"
                size="icon"
                className="h-6 w-6"
                onClick={close}
              >
                <X className="h-3.5 w-3.5" />
              </Button>
            </div>
          </div>

          {/* Drag hint */}
          <div className="px-3 py-2 bg-muted/30 border-b border-border">
            <p className="text-[10px] text-muted-foreground">
              Drag files into a terminal to insert the path
            </p>
          </div>

          {/* File tree */}
          <ScrollArea className="flex-1">
            <FileTree rootPath={projectPath} />
          </ScrollArea>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
