/// <reference types="vite/client" />
import { ElectronAPI } from "../preload/api";

declare global {
  interface Window {
    electronAPI: ElectronAPI;
  }
}
