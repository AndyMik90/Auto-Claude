## Summary

This PR implements comprehensive Conda environment management for Auto Claude, enabling isolated Python environments at both application and project levels. It also includes significant Windows/PowerShell compatibility fixes to ensure reliable terminal integration across platforms.

### Key Features

- **Conda Detection Service**: Automatically detects conda installations across OS-specific locations (miniconda, anaconda, mambaforge)
- **Application-Level Environment**: Managed conda env at `~/miniconda3/envs/auto-claude` using `apps/backend/requirements.txt`
- **Project-Level Environments**: Self-contained environments in `.envs/<project-name>/` within each project
- **Automatic Terminal Activation**: Conda environments auto-activate when opening terminals for configured projects
- **Cross-Platform Activation Scripts**: Generated scripts for CMD, PowerShell, and Bash
- **VS Code Integration**: Auto-generated `.code-workspace` files with conda terminal profiles
- **Python Version Detection**: Parses `requirements.txt`, `pyproject.toml`, and `environment.yml` for version constraints

### Windows Compatibility Fixes

- Added `windowsHide: true` to all spawn calls to prevent console window popups
- Fixed PowerShell command syntax (`;` instead of `&&`, `$env:PATH=` instead of `PATH=`)
- Platform-aware shell escaping (PowerShell uses `''` for quotes, bash uses `'\''`)
- Added `pathWasModified` optimization to skip unnecessary PATH modifications (eliminates massive PATH echo)
- PowerShell-specific conda activation using init scripts

## Test plan

- [ ] **Conda Detection**: Open App Settings > Paths, verify conda installation detected
- [ ] **App Env Setup**: Click "Setup Auto Claude Environment", verify stepper completes
- [ ] **Project Toggle**: Enable conda env for a project in Project Settings > General
- [ ] **Project Env Setup**: Navigate to Python Env section, run setup, verify environment created
- [ ] **Terminal Activation**: Open terminal for conda-enabled project, verify env activates automatically
- [ ] **Windows Popup**: Verify no external PowerShell windows appear during operations
- [ ] **Connect Claude (Windows)**: Click "Connect Claude", verify PowerShell syntax works without errors
- [ ] **Settings Persistence**: Navigate away and back, verify all conda settings retained

## Files Changed

### New Files (11)
- `conda-detector.ts` - Conda installation detection service
- `conda-env-manager.ts` - Environment creation and management
- `conda-workspace-generator.ts` - VS Code workspace file generation
- `conda-project-structure.ts` - Project structure detection (pure-python vs mixed)
- `conda-handlers.ts` - IPC handlers for conda operations
- `conda-api.ts` - Preload API for renderer access
- `PythonEnvSettings.tsx` - Project-level Python environment settings UI
- `CondaSetupWizard.tsx` - Multi-step setup wizard with progress
- `CondaDetectionDisplay.tsx` - Conda detection status display
- `useCondaSetup.ts` - React hook for setup progress
- `conda.ts` - TypeScript type definitions

### Modified Files (48)
- Terminal integration: `pty-manager.ts`, `terminal-lifecycle.ts`, `terminal-manager.ts`
- Claude integration: `claude-cli-utils.ts`, `claude-integration-handler.ts`
- Shell utilities: `shell-escape.ts`, `env-utils.ts`
- Settings UI: `GeneralSettings.tsx`, `AppSettings.tsx`, `ProjectSettingsContent.tsx`
- IPC handlers: Various handlers with `windowsHide` fixes
- Type definitions: `settings.ts`, `project.ts`, `terminal.ts`, `ipc.ts`
- i18n: English and French translation files

---

Generated with [Claude Code](https://claude.ai/code)
