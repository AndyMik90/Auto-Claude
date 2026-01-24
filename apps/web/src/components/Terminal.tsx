import { useEffect, useRef, useState } from 'react';
import { Terminal as XTerm } from '@xterm/xterm';
import { FitAddon } from '@xterm/addon-fit';
import '@xterm/xterm/css/xterm.css';
import { ipc } from '../lib/ipc-abstraction';

export interface TerminalProps {
  id: string;
  cwd?: string;
  onClose?: () => void;
}

/**
 * Terminal component with xterm.js
 *
 * Connects to backend PTY session via WebSocket/IPC abstraction
 */
export function Terminal({ id, cwd, onClose }: TerminalProps) {
  const terminalRef = useRef<HTMLDivElement>(null);
  const xtermRef = useRef<XTerm | null>(null);
  const fitAddonRef = useRef<FitAddon | null>(null);
  const [isReady, setIsReady] = useState(false);

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
          id,
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
    ipc.send('terminal', {
      id,
      type: 'start',
      rows,
      cols,
      cwd: cwd || process.env.HOME || '/tmp',
    });

    // Listen for terminal output from backend
    const handleOutput = (data: any) => {
      if (data.id === id && data.type === 'output' && terminal) {
        terminal.write(data.data);
      }
    };

    ipc.on('terminal', handleOutput);

    return () => {
      ipc.off('terminal', handleOutput);

      // Cleanup PTY session on unmount
      if (ipc.isConnected()) {
        ipc.send('terminal', {
          id,
          type: 'exit',
        });
      }
    };
  }, [isReady, id, cwd]);

  // Handle window resize
  useEffect(() => {
    if (!isReady || !fitAddonRef.current || !xtermRef.current) return;

    const handleResize = () => {
      const fitAddon = fitAddonRef.current;
      const terminal = xtermRef.current;

      if (!fitAddon || !terminal) return;

      try {
        fitAddon.fit();

        // Send resize to backend PTY
        if (ipc.isConnected()) {
          ipc.send('terminal', {
            id,
            type: 'resize',
            rows: terminal.rows,
            cols: terminal.cols,
          });
        }
      } catch (error) {
        console.error('[Terminal] Failed to resize:', error);
      }
    };

    window.addEventListener('resize', handleResize);

    return () => {
      window.removeEventListener('resize', handleResize);
    };
  }, [isReady, id]);

  return (
    <div className="h-full w-full bg-[#1e1e1e]">
      <div ref={terminalRef} className="h-full w-full" />
    </div>
  );
}
