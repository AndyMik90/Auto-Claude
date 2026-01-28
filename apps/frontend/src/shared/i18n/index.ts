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
import enContext from './locales/en/context.json';
import enChangelog from './locales/en/changelog.json';
import enWorktrees from './locales/en/worktrees.json';

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
import frContext from './locales/fr/context.json';
import frChangelog from './locales/fr/changelog.json';
import frWorktrees from './locales/fr/worktrees.json';

// Import Russian translation resources
import ruCommon from './locales/ru/common.json';
import ruNavigation from './locales/ru/navigation.json';
import ruSettings from './locales/ru/settings.json';
import ruTasks from './locales/ru/tasks.json';
import ruWelcome from './locales/ru/welcome.json';
import ruOnboarding from './locales/ru/onboarding.json';
import ruDialogs from './locales/ru/dialogs.json';
import ruGitlab from './locales/ru/gitlab.json';
import ruTaskReview from './locales/ru/taskReview.json';
import ruTerminal from './locales/ru/terminal.json';
import ruErrors from './locales/ru/errors.json';
import ruInsights from './locales/ru/insights.json';
import ruRoadmap from './locales/ru/roadmap.json';
import ruIdeation from './locales/ru/ideation.json';
import ruContext from './locales/ru/context.json';
import ruChangelog from './locales/ru/changelog.json';
import ruWorktrees from './locales/ru/worktrees.json';

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
    context: enContext,
    changelog: enChangelog,
    worktrees: enWorktrees
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
    context: frContext,
    changelog: frChangelog,
    worktrees: frWorktrees
  },
  ru: {
    common: ruCommon,
    navigation: ruNavigation,
    settings: ruSettings,
    tasks: ruTasks,
    welcome: ruWelcome,
    onboarding: ruOnboarding,
    dialogs: ruDialogs,
    gitlab: ruGitlab,
    taskReview: ruTaskReview,
    terminal: ruTerminal,
    errors: ruErrors,
    insights: ruInsights,
    roadmap: ruRoadmap,
    ideation: ruIdeation,
    context: ruContext,
    changelog: ruChangelog,
    worktrees: ruWorktrees
  }
} as const;

i18n
  .use(initReactI18next)
  .init({
    resources,
    lng: 'en', // Default language (will be overridden by settings)
    fallbackLng: 'en',
    defaultNS,
    ns: ['common', 'navigation', 'settings', 'tasks', 'welcome', 'onboarding', 'dialogs', 'gitlab', 'taskReview', 'terminal', 'errors', 'insights', 'roadmap', 'ideation', 'context', 'changelog', 'worktrees'],
    interpolation: {
      escapeValue: false // React already escapes values
    },
    react: {
      useSuspense: false // Disable suspense for Electron compatibility
    }
  });

export default i18n;
