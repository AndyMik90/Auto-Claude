/**
 * Shared utility functions
 *
 * This file provides common utilities that can be used across renderer and shared components.
 * Re-exports from renderer/lib/utils for compatibility with @/lib/utils imports.
 */

import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';

/**
 * Utility function to merge Tailwind CSS classes
 */
export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}
