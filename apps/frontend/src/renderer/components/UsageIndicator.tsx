/**
 * Usage Indicator - Real-time Claude usage display in header
 *
 * Displays current session/weekly usage as a badge with color-coded status.
 * Shows detailed breakdown on hover.
 */

import React, { useState, useEffect } from "react";
import { Activity, TrendingUp, AlertCircle } from "lucide-react";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "./ui/tooltip";
import type { ClaudeUsageSnapshot } from "../../shared/types/agent";

export function UsageIndicator() {
  const [usage, setUsage] = useState<ClaudeUsageSnapshot | null>(null);
  const [isVisible, setIsVisible] = useState(false);

  useEffect(() => {
    // Listen for usage updates from main process
    const unsubscribe = window.electronAPI.onUsageUpdated(
      (snapshot: ClaudeUsageSnapshot) => {
        setUsage(snapshot);
        setIsVisible(true);
      }
    );

    // Request initial usage on mount
    window.electronAPI.requestUsageUpdate().then((result) => {
      if (result.success && result.data) {
        setUsage(result.data);
        setIsVisible(true);
      }
    });

    return () => {
      unsubscribe();
    };
  }, []);

  // if (!isVisible || !usage) {
  //   return null;
  // }

  const safeUsage = usage || {
    sessionPercent: 0,
    weeklyPercent: 0,
    profileName: "...",
    sessionResetTime: null,
    weeklyResetTime: null,
  };

  // Determine color based on highest usage percentage
  const maxUsage = Math.max(safeUsage.sessionPercent, safeUsage.weeklyPercent);

  const colorClasses =
    maxUsage >= 95
      ? "text-red-500 bg-red-500/10 border-red-500/20"
      : maxUsage >= 91
      ? "text-orange-500 bg-orange-500/10 border-orange-500/20"
      : maxUsage >= 71
      ? "text-yellow-500 bg-yellow-500/10 border-yellow-500/20"
      : "text-green-500 bg-green-500/10 border-green-500/20";

  const Icon =
    maxUsage >= 91 ? AlertCircle : maxUsage >= 71 ? TrendingUp : Activity;

  return (
    <TooltipProvider delayDuration={200}>
      <Tooltip>
        <TooltipTrigger asChild>
          <button
            className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-md border transition-all hover:opacity-80 ${colorClasses}`}
            aria-label="Claude usage status"
          >
            <Icon className="h-3.5 w-3.5" />
            <span className="text-xs font-semibold font-mono">
              {Math.round(maxUsage)}%
            </span>
          </button>
        </TooltipTrigger>
        <TooltipContent side="bottom" className="text-xs w-64 py-3">
          <div className="space-y-2">
            {/* Session usage */}
            <div>
              <div className="flex items-center justify-between gap-4 mb-1">
                <span className="text-muted-foreground font-medium">
                  Session Usage
                </span>
                <span className="font-semibold tabular-nums">
                  {Math.round(safeUsage.sessionPercent)}%
                </span>
              </div>
              {safeUsage.sessionResetTime && (
                <div className="text-[10px] text-muted-foreground">
                  Resets: {safeUsage.sessionResetTime}
                </div>
              )}
              {/* Progress bar */}
              <div className="mt-1.5 h-1.5 bg-muted rounded-full overflow-hidden">
                <div
                  className={`h-full transition-all ${
                    safeUsage.sessionPercent >= 95
                      ? "bg-red-500"
                      : safeUsage.sessionPercent >= 91
                      ? "bg-orange-500"
                      : safeUsage.sessionPercent >= 71
                      ? "bg-yellow-500"
                      : "bg-green-500"
                  }`}
                  style={{
                    width: `${Math.min(safeUsage.sessionPercent, 100)}%`,
                  }}
                />
              </div>
            </div>

            <div className="h-px bg-border" />

            {/* Weekly usage */}
            <div>
              <div className="flex items-center justify-between gap-4 mb-1">
                <span className="text-muted-foreground font-medium">
                  Weekly Usage
                </span>
                <span className="font-semibold tabular-nums">
                  {Math.round(safeUsage.weeklyPercent)}%
                </span>
              </div>
              {safeUsage.weeklyResetTime && (
                <div className="text-[10px] text-muted-foreground">
                  Resets: {safeUsage.weeklyResetTime}
                </div>
              )}
              {/* Progress bar */}
              <div className="mt-1.5 h-1.5 bg-muted rounded-full overflow-hidden">
                <div
                  className={`h-full transition-all ${
                    safeUsage.weeklyPercent >= 99
                      ? "bg-red-500"
                      : safeUsage.weeklyPercent >= 91
                      ? "bg-orange-500"
                      : safeUsage.weeklyPercent >= 71
                      ? "bg-yellow-500"
                      : "bg-green-500"
                  }`}
                  style={{
                    width: `${Math.min(safeUsage.weeklyPercent, 100)}%`,
                  }}
                />
              </div>
            </div>

            <div className="h-px bg-border" />

            {/* Active profile */}
            <div className="flex items-center justify-between gap-4 pt-1">
              <span className="text-muted-foreground text-[10px] uppercase tracking-wide">
                Active Account
              </span>
              <span className="font-semibold text-primary">
                {safeUsage.profileName}
              </span>
            </div>
          </div>
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
}
