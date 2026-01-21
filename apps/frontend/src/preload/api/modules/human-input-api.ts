/**
 * Human Input API
 *
 * Exposes human input request functionality to the renderer.
 * Allows the UI to check for pending input requests from agents,
 * submit answers, and watch for new requests.
 */

import { ipcRenderer } from 'electron';
import { IPC_CHANNELS } from '../../../shared/constants/ipc';
import type { IPCResult } from '../../../shared/types/common';
import type { HumanInputRequest, HumanInputAnswer } from '../../../shared/types/human-input';

export interface HumanInputAPI {
  /** Check for pending human input request in a spec directory */
  humanInputCheck: (specPath: string) => Promise<IPCResult<HumanInputRequest | null>>;

  /** Submit an answer to a human input request */
  humanInputAnswer: (specPath: string, answer: HumanInputAnswer['answer']) => Promise<IPCResult<void>>;

  /** Skip a human input request (user doesn't want to answer) */
  humanInputSkip: (specPath: string) => Promise<IPCResult<void>>;

  /** Start watching a spec directory for human input requests */
  humanInputWatch: (specPath: string) => Promise<IPCResult<void>>;

  /** Stop watching a spec directory for human input requests */
  humanInputUnwatch: (specPath: string) => Promise<IPCResult<void>>;

  /** Listen for human input change events */
  onHumanInputChanged: (
    callback: (data: { specPath: string; request: HumanInputRequest }) => void
  ) => () => void;
}

export function createHumanInputAPI(): HumanInputAPI {
  return {
    humanInputCheck: (specPath: string) =>
      ipcRenderer.invoke(IPC_CHANNELS.HUMAN_INPUT_CHECK, specPath),

    humanInputAnswer: (specPath: string, answer: HumanInputAnswer['answer']) =>
      ipcRenderer.invoke(IPC_CHANNELS.HUMAN_INPUT_ANSWER, specPath, answer),

    humanInputSkip: (specPath: string) =>
      ipcRenderer.invoke(IPC_CHANNELS.HUMAN_INPUT_SKIP, specPath),

    humanInputWatch: (specPath: string) =>
      ipcRenderer.invoke(IPC_CHANNELS.HUMAN_INPUT_WATCH, specPath),

    humanInputUnwatch: (specPath: string) =>
      ipcRenderer.invoke(IPC_CHANNELS.HUMAN_INPUT_UNWATCH, specPath),

    onHumanInputChanged: (callback) => {
      const handler = (
        _event: Electron.IpcRendererEvent,
        data: { specPath: string; request: HumanInputRequest }
      ) => {
        callback(data);
      };

      ipcRenderer.on(IPC_CHANNELS.HUMAN_INPUT_CHANGED, handler);

      // Return cleanup function
      return () => {
        ipcRenderer.removeListener(IPC_CHANNELS.HUMAN_INPUT_CHANGED, handler);
      };
    },
  };
}
