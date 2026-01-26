import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';

// Import English translation resources
import enCommon from './locales/en/common.json';
import enNavigation from './locales/en/navigation.json';
import enSettings from './locales/en/settings.json';
import enTasks from './locales/en/tasks.json';
import enWelcome from './locales/en/welcome.json';
import enOnboarding from './locales/en/onboarding.json';
import enDialogs from './locales/en/dialogs.json';
import enGitlab from './locales/en/gitlab.json';
import enTaskReview from './locales/en/taskReview.json';
import enTerminal from './locales/en/terminal.json';
import enErrors from './locales/en/errors.json';
import enInsights from './locales/en/insights.json';
import enRoadmap from './locales/en/roadmap.json';
import enIdeation from './locales/en/ideation.json';
import enChangelog from './locales/en/changelog.json';
import enContext from './locales/en/context.json';
import enWorkspace from './locales/en/workspace.json';

// Import French translation resources
import frCommon from './locales/fr/common.json';
import frNavigation from './locales/fr/navigation.json';
import frSettings from './locales/fr/settings.json';
import frTasks from './locales/fr/tasks.json';
import frWelcome from './locales/fr/welcome.json';
import frOnboarding from './locales/fr/onboarding.json';
import frDialogs from './locales/fr/dialogs.json';
import frGitlab from './locales/fr/gitlab.json';
import frTaskReview from './locales/fr/taskReview.json';
import frTerminal from './locales/fr/terminal.json';
import frErrors from './locales/fr/errors.json';
import frInsights from './locales/fr/insights.json';
import frRoadmap from './locales/fr/roadmap.json';
import frIdeation from './locales/fr/ideation.json';
import frChangelog from './locales/fr/changelog.json';
import frContext from './locales/fr/context.json';
import frWorkspace from './locales/fr/workspace.json';

// Import Japanese translation resources
import jaCommon from './locales/ja/common.json';
import jaNavigation from './locales/ja/navigation.json';
import jaSettings from './locales/ja/settings.json';
import jaTasks from './locales/ja/tasks.json';
import jaWelcome from './locales/ja/welcome.json';
import jaOnboarding from './locales/ja/onboarding.json';
import jaDialogs from './locales/ja/dialogs.json';
import jaGitlab from './locales/ja/gitlab.json';
import jaTaskReview from './locales/ja/taskReview.json';
import jaTerminal from './locales/ja/terminal.json';
import jaErrors from './locales/ja/errors.json';
import jaInsights from './locales/ja/insights.json';
import jaRoadmap from './locales/ja/roadmap.json';
import jaIdeation from './locales/ja/ideation.json';
import jaChangelog from './locales/ja/changelog.json';
import jaContext from './locales/ja/context.json';
import jaWorkspace from './locales/ja/workspace.json';

export const defaultNS = 'common';

export const resources = {
  en: {
    common: enCommon,
    navigation: enNavigation,
    settings: enSettings,
    tasks: enTasks,
    welcome: enWelcome,
    onboarding: enOnboarding,
    dialogs: enDialogs,
    gitlab: enGitlab,
    taskReview: enTaskReview,
    terminal: enTerminal,
    errors: enErrors,
    insights: enInsights,
    roadmap: enRoadmap,
    ideation: enIdeation,
    changelog: enChangelog,
    context: enContext,
    workspace: enWorkspace
  },
  fr: {
    common: frCommon,
    navigation: frNavigation,
    settings: frSettings,
    tasks: frTasks,
    welcome: frWelcome,
    onboarding: frOnboarding,
    dialogs: frDialogs,
    gitlab: frGitlab,
    taskReview: frTaskReview,
    terminal: frTerminal,
    errors: frErrors,
    insights: frInsights,
    roadmap: frRoadmap,
    ideation: frIdeation,
    changelog: frChangelog,
    context: frContext,
    workspace: frWorkspace
  },
  ja: {
    common: jaCommon,
    navigation: jaNavigation,
    settings: jaSettings,
    tasks: jaTasks,
    welcome: jaWelcome,
    onboarding: jaOnboarding,
    dialogs: jaDialogs,
    gitlab: jaGitlab,
    taskReview: jaTaskReview,
    terminal: jaTerminal,
    errors: jaErrors,
    insights: jaInsights,
    roadmap: jaRoadmap,
    ideation: jaIdeation,
    changelog: jaChangelog,
    context: jaContext,
    workspace: jaWorkspace
  }
} as const;

i18n
  .use(initReactI18next)
  .init({
    resources,
    lng: 'ja', // Default language (will be overridden by settings)
    fallbackLng: 'en',
    defaultNS,
    ns: ['common', 'navigation', 'settings', 'tasks', 'welcome', 'onboarding', 'dialogs', 'gitlab', 'taskReview', 'terminal', 'errors', 'insights', 'roadmap', 'ideation', 'changelog', 'context', 'workspace'],
    interpolation: {
      escapeValue: false // React already escapes values
    },
    react: {
      useSuspense: false // Disable suspense for Electron compatibility
    }
  });

export default i18n;
