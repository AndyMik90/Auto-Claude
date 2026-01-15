"use client";

import { useState, useEffect, createContext, useContext, type ReactNode } from "react";
import { ConvexReactClient } from "convex/react";
import { ConvexProvider } from "convex/react";
import type { ConvexClient as ConvexClientType } from "convex/react/client";
import { getAuthClient } from "@shared/lib/convex/auth-client";

interface AuthContextValue {
  convex: ConvexClientType | null;
  isAuthenticated: boolean;
  isLoading: boolean;
}

const AuthContext = createContext<AuthContextValue>({
  convex: null,
  isAuthenticated: false,
  isLoading: true,
});

/**
 * Convex Auth Provider Component
 *
 * Provides Convex client for data queries and exposes auth state.
 * Authentication is handled via Better Auth with session cookies.
 */
export function ConvexAuthProvider({ children }: { children: ReactNode }) {
  const [convex, setConvex] = useState<ConvexClientType | null>(null);
  const [isReady, setIsReady] = useState(false);

  useEffect(() => {
    const initializeConvex = async () => {
      try {
        // Fetch Convex URLs from the main process
        const result = await window.electronAPI.convex.getUrl();
        if (result.success && result.data) {
          const { convexUrl, siteUrl } = result.data;

          // Initialize Convex client with convexUrl (for WebSocket/real-time)
          const convexClient = new ConvexReactClient(convexUrl);

          // Initialize Better Auth client with siteUrl (for auth actions)
          getAuthClient(siteUrl);

          // Log the configuration for debugging
          console.info('Convex initialized:', {
            convexUrl,
            siteUrl,
            authBaseURL: `${siteUrl}/api/auth`
          });

          setConvex(convexClient);
          setIsReady(true);
        } else {
          // No Convex URL found - run without auth
          console.warn('Convex URL not found. Running without authentication.');
          setIsReady(true);
        }
      } catch (error) {
        console.error('Failed to initialize Convex:', error);
        setIsReady(true);
      }
    };

    initializeConvex();
  }, []);

  // While loading, show loading state
  if (!isReady) {
    return (
      <AuthContext.Provider value={{ convex: null, isAuthenticated: false, isLoading: true }}>
        {children}
      </AuthContext.Provider>
    );
  }

  // If Convex is not configured, render without Convex provider
  // The app will work but auth features won't be available
  if (!convex) {
    return (
      <AuthContext.Provider value={{ convex: null, isAuthenticated: false, isLoading: false }}>
        {children}
      </AuthContext.Provider>
    );
  }

  // Convex is configured - use ConvexProvider for data queries
  // Auth is handled separately via Better Auth client
  return (
    <ConvexProvider client={convex}>
      <AuthContext.Provider value={{ convex, isAuthenticated: false, isLoading: false }}>
        {children}
      </AuthContext.Provider>
    </ConvexProvider>
  );
}

/**
 * Hook to access the Convex auth context
 */
export function useConvexAuth() {
  return useContext(AuthContext);
}
