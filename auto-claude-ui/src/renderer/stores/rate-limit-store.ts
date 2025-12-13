import { create } from 'zustand';
import type { RateLimitInfo } from '../../shared/types';

interface RateLimitState {
  isModalOpen: boolean;
  rateLimitInfo: RateLimitInfo | null;

  // Actions
  showRateLimitModal: (info: RateLimitInfo) => void;
  hideRateLimitModal: () => void;
}

export const useRateLimitStore = create<RateLimitState>((set) => ({
  isModalOpen: false,
  rateLimitInfo: null,

  showRateLimitModal: (info: RateLimitInfo) => {
    set({ isModalOpen: true, rateLimitInfo: info });
  },

  hideRateLimitModal: () => {
    set({ isModalOpen: false });
  },
}));
