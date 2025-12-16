/**
 * Mock implementation for Claude profile management operations
 */

export const claudeProfileMock = {
  getClaudeProfiles: async () => ({
    success: true,
    data: {
      profiles: [],
      activeProfileId: 'default'
    }
  }),

  saveClaudeProfile: async (profile: unknown) => ({
    success: true,
    data: profile
  }),

  deleteClaudeProfile: async () => ({ success: true }),

  renameClaudeProfile: async () => ({ success: true }),

  setActiveClaudeProfile: async () => ({ success: true }),

  switchClaudeProfile: async () => ({ success: true }),

  initializeClaudeProfile: async () => ({ success: true }),

  setClaudeProfileToken: async () => ({ success: true }),

  getAutoSwitchSettings: async () => ({
    success: true,
    data: {
      enabled: false,
      sessionThreshold: 80,
      weeklyThreshold: 90,
      autoSwitchOnRateLimit: false,
      usageCheckInterval: 0
    }
  }),

  updateAutoSwitchSettings: async () => ({ success: true }),

  fetchClaudeUsage: async () => ({ success: true }),

  getBestAvailableProfile: async () => ({
    success: true,
    data: null
  }),

  onSDKRateLimit: () => () => {},

  retryWithProfile: async () => ({ success: true })
};
