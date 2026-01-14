// Postinstall script to patch @electron-toolkit/utils for ESM compatibility
const fs = require('fs');
const path = require('path');

const utilsPath = path.resolve(__dirname, '../node_modules/.pnpm/@electron-toolkit+utils@4.0.0_electron@39.2.7/node_modules/@electron-toolkit/utils/dist/index.mjs');

if (fs.existsSync(utilsPath)) {
  let content = fs.readFileSync(utilsPath, 'utf-8');
  
  // The electron module is actually a CJS module that needs to be loaded properly
  // We need to create a wrapper that handles this correctly
  const newImport = `// ESM import compatibility wrapper for electron
  import { createRequire } from 'module';
  const require = createRequire(import.meta.url);
  const { app, session, ipcMain, BrowserWindow } = require('electron');`;
  
  content = content.replace(
    "import { app, session, ipcMain, BrowserWindow } from 'electron';",
    newImport
  );
  
  fs.writeFileSync(utilsPath, content);
  console.log('Patched @electron-toolkit/utils for ESM compatibility');
} else {
  console.log('@electron-toolkit/utils not found, skipping patch');
}
