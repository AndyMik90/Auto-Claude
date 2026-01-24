import React, { useCallback, useMemo } from 'react';
import { Plus, X } from 'lucide-react';
import { Terminal } from './Terminal';
import { Button } from './ui/button';
import { cn } from '../lib/utils';
import { useTerminalStore } from '../stores/terminal-store';
import { ipc } from '../lib/ipc-abstraction';

interface TerminalGridProps {
  projectPath?: string;
  isActive?: boolean;
}

export function TerminalGrid({ projectPath, isActive = false }: TerminalGridProps) {
  const allTerminals = useTerminalStore((state) => state.terminals);

  // Filter terminals to show only those belonging to the current project
  // Also include legacy terminals without projectPath (created before this change)
  // Exclude exited terminals as they are no longer functional
  const terminals = useMemo(() => {
    const filtered = projectPath
      ? allTerminals.filter(t => t.projectPath === projectPath || !t.projectPath)
      : allTerminals;
    // Exclude exited terminals from the visible list
    return filtered.filter(t => t.status !== 'exited');
  }, [allTerminals, projectPath]);

  const activeTerminalId = useTerminalStore((state) => state.activeTerminalId);
  const addTerminal = useTerminalStore((state) => state.addTerminal);
  const removeTerminal = useTerminalStore((state) => state.removeTerminal);
  const setActiveTerminal = useTerminalStore((state) => state.setActiveTerminal);
  const canAddTerminal = useTerminalStore((state) => state.canAddTerminal);

  // Handle adding a new terminal
  const handleAddTerminal = useCallback(() => {
    if (!canAddTerminal(projectPath)) {
      return;
    }

    const newTerminal = addTerminal(undefined, projectPath);
    if (newTerminal) {
      // Notify backend to create PTY
      ipc.send('create-terminal', {
        terminalId: newTerminal.id,
        cwd: newTerminal.cwd,
        projectPath
      });
    }
  }, [addTerminal, canAddTerminal, projectPath]);

  // Handle removing a terminal
  const handleRemoveTerminal = useCallback((terminalId: string, e: React.MouseEvent) => {
    e.stopPropagation();

    // Notify backend to destroy PTY
    ipc.send('destroy-terminal', { terminalId });

    // Remove from store
    removeTerminal(terminalId);
  }, [removeTerminal]);

  // Handle switching active terminal
  const handleSwitchTerminal = useCallback((terminalId: string) => {
    setActiveTerminal(terminalId);
  }, [setActiveTerminal]);

  // Get the active terminal or first terminal if none selected
  const activeTerminal = useMemo(() => {
    if (terminals.length === 0) return null;

    const active = terminals.find(t => t.id === activeTerminalId);
    return active || terminals[0];
  }, [terminals, activeTerminalId]);

  // Ensure we have an active terminal if terminals exist
  React.useEffect(() => {
    if (terminals.length > 0 && !activeTerminal) {
      setActiveTerminal(terminals[0].id);
    }
  }, [terminals, activeTerminal, setActiveTerminal]);

  // Create a terminal if none exist
  React.useEffect(() => {
    if (terminals.length === 0 && canAddTerminal(projectPath)) {
      handleAddTerminal();
    }
  }, [terminals.length, canAddTerminal, projectPath, handleAddTerminal]);

  return (
    <div className="flex flex-col h-full w-full bg-[#1e1e1e]">
      {/* Terminal tabs header */}
      <div className="flex items-center gap-1 bg-[#2d2d2d] border-b border-[#3e3e3e] px-2 py-1">
        {terminals.map((terminal) => (
          <button
            key={terminal.id}
            onClick={() => handleSwitchTerminal(terminal.id)}
            className={cn(
              'flex items-center gap-2 px-3 py-1.5 text-sm rounded-t transition-colors',
              'hover:bg-[#3e3e3e]',
              activeTerminal?.id === terminal.id
                ? 'bg-[#1e1e1e] text-white'
                : 'bg-[#2d2d2d] text-gray-400'
            )}
          >
            <span className="truncate max-w-[120px]">{terminal.title}</span>
            <button
              onClick={(e) => handleRemoveTerminal(terminal.id, e)}
              className={cn(
                'p-0.5 rounded hover:bg-red-500/20 transition-colors',
                'opacity-60 hover:opacity-100'
              )}
            >
              <X className="h-3 w-3" />
            </button>
          </button>
        ))}

        {/* Add terminal button */}
        {canAddTerminal(projectPath) && (
          <Button
            variant="ghost"
            size="sm"
            onClick={handleAddTerminal}
            className="h-8 w-8 p-0 text-gray-400 hover:text-white hover:bg-[#3e3e3e]"
            title="Add terminal"
          >
            <Plus className="h-4 w-4" />
          </Button>
        )}
      </div>

      {/* Terminal content area */}
      <div className="flex-1 relative">
        {terminals.map((terminal) => (
          <div
            key={terminal.id}
            className={cn(
              'absolute inset-0',
              activeTerminal?.id === terminal.id ? 'block' : 'hidden'
            )}
          >
            <Terminal
              id={terminal.id}
              cwd={terminal.cwd}
              onClose={() => handleRemoveTerminal(terminal.id, { stopPropagation: () => {} } as React.MouseEvent)}
            />
          </div>
        ))}

        {/* Empty state */}
        {terminals.length === 0 && (
          <div className="flex items-center justify-center h-full text-gray-500">
            <div className="text-center">
              <p className="mb-4">No terminals open</p>
              <Button onClick={handleAddTerminal} variant="outline">
                <Plus className="h-4 w-4 mr-2" />
                Open Terminal
              </Button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
