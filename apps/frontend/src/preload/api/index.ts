import { ProjectAPI, createProjectAPI } from './project-api';
import { TerminalAPI, createTerminalAPI } from './terminal-api';
import { TaskAPI, createTaskAPI } from './task-api';
import { SettingsAPI, createSettingsAPI } from './settings-api';
import { TemplateAPI, createTemplateAPI } from './template-api';
import { SecretsAPI, createSecretsAPI } from './secrets-api';
import { FileAPI, createFileAPI } from './file-api';
import { AgentAPI, createAgentAPI } from './agent-api';
import { IdeationAPI, createIdeationAPI } from './modules/ideation-api';
import { InsightsAPI, createInsightsAPI } from './modules/insights-api';
import { AppUpdateAPI, createAppUpdateAPI } from './app-update-api';

export interface ElectronAPI extends
  ProjectAPI,
  TerminalAPI,
  TaskAPI,
  SettingsAPI,
  TemplateAPI,
  SecretsAPI,
  FileAPI,
  AgentAPI,
  IdeationAPI,
  InsightsAPI,
  AppUpdateAPI {}

export const createElectronAPI = (): ElectronAPI => ({
  ...createProjectAPI(),
  ...createTerminalAPI(),
  ...createTaskAPI(),
  ...createSettingsAPI(),
  ...createTemplateAPI(),
  ...createSecretsAPI(),
  ...createFileAPI(),
  ...createAgentAPI(),
  ...createIdeationAPI(),
  ...createInsightsAPI(),
  ...createAppUpdateAPI()
});

// Export individual API creators for potential use in tests or specialized contexts
export {
  createProjectAPI,
  createTerminalAPI,
  createTaskAPI,
  createSettingsAPI,
  createTemplateAPI,
  createSecretsAPI,
  createFileAPI,
  createAgentAPI,
  createIdeationAPI,
  createInsightsAPI,
  createAppUpdateAPI
};

export type {
  ProjectAPI,
  TerminalAPI,
  TaskAPI,
  SettingsAPI,
  TemplateAPI,
  SecretsAPI,
  FileAPI,
  AgentAPI,
  IdeationAPI,
  InsightsAPI,
  AppUpdateAPI
};
