import { ipcMain, BrowserWindow } from "electron";

export function registerWindowHandlers(
  getMainWindow: () => BrowserWindow | null
): void {
  ipcMain.on("window:minimize", () => {
    const mainWindow = getMainWindow();
    if (mainWindow) mainWindow.minimize();
  });

  ipcMain.on("window:maximize", () => {
    const mainWindow = getMainWindow();
    if (mainWindow) {
      if (mainWindow.isMaximized()) mainWindow.unmaximize();
      else mainWindow.maximize();
    }
  });

  ipcMain.on("window:close", () => {
    const mainWindow = getMainWindow();
    if (mainWindow) mainWindow.close();
  });

  console.log("[IPC] Registered window handlers");
}
