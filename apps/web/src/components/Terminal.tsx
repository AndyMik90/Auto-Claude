import { useEffect, useRef, useState, forwardRef, useImperativeHandle, useCallback } from 'react';
import { Terminal as XTerm } from '@xterm/xterm';
import { FitAddon } from '@xterm/addon-fit';
import '@xterm/xterm/css/xterm.css';
import { ipc } from '../lib/ipc-abstraction';

// Minimum dimensions to prevent PTY creation with invalid sizes
const MIN_COLS = 10;
const MIN_ROWS = 3;

export interface TerminalProps {
  id: string;
  cwd?: string;
  onClose?: () => void;
}

/**
 * Handle interface exposed by Terminal component for external control.
 * Used by parent components to trigger operations like refitting the terminal
 * after container size changes.
 */
export interface TerminalHandle {
  /** Refit the terminal to its container size */
  fit: () => void;
}

/**
 * Terminal component with xterm.js
 *
 * Connects to backend PTY session via WebSocket/IPC abstraction
 */
export const Terminal = forwardRef<TerminalHandle, TerminalProps>(function Terminal({ id, cwd, onClose }, ref) {
  const terminalRef = useRef<HTMLDivElement>(null);
  const xtermRef = useRef<XTerm | null>(null);
  const fitAddonRef = useRef<FitAddon | null>(null);
  const [isReady, setIsReady] = useState(false);

  // Fit terminal to container with validation
  const fit = useCallback(() => {
    const fitAddon = fitAddonRef.current;
    const terminal = xtermRef.current;

    if (!fitAddon || !terminal) return;

    try {
      fitAddon.fit();

      // Validate dimensions before sending resize
      const cols = terminal.cols;
      const rows = terminal.rows;

      if (cols >= MIN_COLS && rows >= MIN_ROWS) {
        // Send resize to backend PTY
        if (ipc.isConnected()) {
          ipc.send('terminal', {
            type: 'resize',
            rows,
            cols,
          });
        }
      }
    } catch (error) {
      console.error('[Terminal] Failed to fit terminal:', error);
    }
  }, []);

  // Expose fit method to parent components via ref
  // This allows external triggering of terminal resize (e.g., after layout changes)
  useImperativeHandle(ref, () => ({
    fit,
  }), [fit]);

  // Initialize xterm.js
  useEffect(() => {
    if (!terminalRef.current) return;

    // Create xterm instance
    const terminal = new XTerm({
      cursorBlink: true,
      fontSize: 14,
      fontFamily: 'JetBrains Mono, Menlo, Monaco, Consolas, monospace',
      theme: {
        background: '#1e1e1e',
        foreground: '#cccccc',
        cursor: '#ffffff',
        selectionBackground: '#264f78',
      },
      allowProposedApi: true,
    });

    // Create and load fit addon
    const fitAddon = new FitAddon();
    terminal.loadAddon(fitAddon);

    // Open terminal in DOM
    terminal.open(terminalRef.current);

    // Fit terminal to container
    try {
      fitAddon.fit();
    } catch (error) {
      console.error('[Terminal] Failed to fit terminal:', error);
    }

    // Store refs
    xtermRef.current = terminal;
    fitAddonRef.current = fitAddon;
    setIsReady(true);

    // Handle terminal input (user typing)
    terminal.onData((data) => {
      if (ipc.isConnected()) {
        ipc.send('terminal', {
          type: 'input',
          data,
        });
      }
    });

    // Cleanup on unmount
    return () => {
      setIsReady(false);
      terminal.dispose();
      xtermRef.current = null;
      fitAddonRef.current = null;
    };
  }, [id]);

  // Start PTY session
  useEffect(() => {
    if (!isReady || !xtermRef.current) return;

    const terminal = xtermRef.current;
    const rows = terminal.rows;
    const cols = terminal.cols;

    // Start PTY session on backend
    // Note: Backend creates one PTY per WebSocket connection, not per terminal ID
    ipc.send('terminal', {
      type: 'start',
      rows,
      cols,
    });

    // Listen for terminal output from backend
    const handleOutput = (data: any) => {
      // Backend sends: {type: 'output', data: '...'}
      // No terminal ID is included since backend manages one PTY per WebSocket
      if (data.type === 'output' && terminal) {
        terminal.write(data.data);
      }
    };

    ipc.on('terminal', handleOutput);

    return () => {
      ipc.off('terminal', handleOutput);

      // Note: PTY cleanup happens automatically when WebSocket disconnects
      // The backend destroys the PTY session on connection close
    };
  }, [isReady, id, cwd]);

  // Handle window resize
  useEffect(() => {
    if (!isReady) return;

    const handleResize = () => {
      fit();
    };

    window.addEventListener('resize', handleResize);

    return () => {
      window.removeEventListener('resize', handleResize);
    };
  }, [isReady, fit]);

  // Handle container resize using ResizeObserver
  // This detects size changes from layout changes, not just window resize
  useEffect(() => {
    if (!isReady || !terminalRef.current) return;

    const resizeObserver = new ResizeObserver(() => {
      // Use requestAnimationFrame to debounce rapid resize events
      requestAnimationFrame(() => {
        fit();
      });
    });

    resizeObserver.observe(terminalRef.current);

    return () => {
      resizeObserver.disconnect();
    };
  }, [isReady, fit]);

  return (
    <div className="h-full w-full bg-[#1e1e1e]">
      <div ref={terminalRef} className="h-full w-full" />
    </div>
  );
});
