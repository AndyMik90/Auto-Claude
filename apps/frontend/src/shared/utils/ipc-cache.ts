/**
 * IPC Response Cache
 * 
 * Provides caching for IPC responses to reduce redundant calls
 */

import { debugLog } from './debug-logger';
import type { IPCResult } from '../types/common';

/**
 * Cache entry with timestamp
 */
interface CacheEntry<T> {
  data: T;
  timestamp: number;
  ttl: number;
}

/**
 * Cache key generator function
 */
type CacheKeyFn = (...args: unknown[]) => string;

/**
 * IPC Cache configuration
 */
export interface CacheConfig {
  /** Time-to-live in milliseconds */
  ttlMs?: number;
  
  /** Maximum cache size (number of entries) */
  maxSize?: number;
  
  /** Custom key generator function */
  keyFn?: CacheKeyFn;
  
  /** Whether to cache failed responses */
  cacheErrors?: boolean;
}

/**
 * Default cache key generator
 */
const defaultKeyFn: CacheKeyFn = (...args: unknown[]) => {
  return JSON.stringify(args);
};

/**
 * IPC Response Cache
 * 
 * Caches IPC responses with configurable TTL and size limits
 */
export class IPCCache {
  private cache = new Map<string, CacheEntry<unknown>>();
  private accessOrder: string[] = [];
  private ttlMs: number;
  private maxSize: number;
  private keyFn: CacheKeyFn;
  private cacheErrors: boolean;

  constructor(config: CacheConfig = {}) {
    this.ttlMs = config.ttlMs ?? 60000; // 1 minute default
    this.maxSize = config.maxSize ?? 100;
    this.keyFn = config.keyFn ?? defaultKeyFn;
    this.cacheErrors = config.cacheErrors ?? false;
  }

  /**
   * Generate cache key for channel and arguments
   */
  private getCacheKey(channel: string, ...args: unknown[]): string {
    return `${channel}:${this.keyFn(...args)}`;
  }

  /**
   * Check if cached entry is still valid
   */
  private isValid(entry: CacheEntry<unknown>): boolean {
    return Date.now() - entry.timestamp < entry.ttl;
  }

  /**
   * Evict oldest entry to make room
   */
  private evictOldest(): void {
    if (this.accessOrder.length === 0) return;
    
    const oldestKey = this.accessOrder.shift()!;
    this.cache.delete(oldestKey);
    debugLog(`[Cache] Evicted oldest entry: ${oldestKey}`);
  }

  /**
   * Update access order for LRU
   */
  private updateAccessOrder(key: string): void {
    const index = this.accessOrder.indexOf(key);
    if (index > -1) {
      this.accessOrder.splice(index, 1);
    }
    this.accessOrder.push(key);
  }

  /**
   * Get cached value if available and valid
   */
  get<T>(channel: string, ...args: unknown[]): T | undefined {
    const key = this.getCacheKey(channel, ...args);
    const entry = this.cache.get(key) as CacheEntry<T> | undefined;
    
    if (!entry) {
      debugLog(`[Cache] Miss for ${channel}`);
      return undefined;
    }
    
    // Check if entry is still valid
    if (!this.isValid(entry)) {
      debugLog(`[Cache] Expired for ${channel}`);
      this.cache.delete(key);
      const orderIndex = this.accessOrder.indexOf(key);
      if (orderIndex > -1) {
        this.accessOrder.splice(orderIndex, 1);
      }
      return undefined;
    }
    
    debugLog(`[Cache] Hit for ${channel}`);
    this.updateAccessOrder(key);
    return entry.data;
  }

  /**
   * Set cached value
   */
  set<T>(channel: string, data: T, ttl?: number, ...args: unknown[]): void {
    // Don't cache if data is an error and cacheErrors is false
    if (!this.cacheErrors && typeof data === 'object' && data !== null) {
      const result = data as any;
      if (result && typeof result === 'object' && 'success' in result && !result.success) {
        debugLog(`[Cache] Skipping error response for ${channel}`);
        return;
      }
    }
    
    const key = this.getCacheKey(channel, ...args);
    
    // Evict if at max size
    if (this.cache.size >= this.maxSize && !this.cache.has(key)) {
      this.evictOldest();
    }
    
    this.cache.set(key, {
      data,
      timestamp: Date.now(),
      ttl: ttl ?? this.ttlMs,
    });
    
    this.updateAccessOrder(key);
    debugLog(`[Cache] Set for ${channel} (TTL: ${ttl ?? this.ttlMs}ms)`);
  }

  /**
   * Invalidate cache entries
   * 
   * @param channel - If provided, only invalidate entries for this channel
   * @param predicate - Optional function to filter which entries to invalidate
   */
  invalidate(channel?: string, predicate?: (key: string) => boolean): void {
    if (!channel) {
      this.cache.clear();
      this.accessOrder = [];
      debugLog('[Cache] Cleared all entries');
      return;
    }
    
    const keysToDelete: string[] = [];
    
    for (const key of this.cache.keys()) {
      if (key.startsWith(`${channel}:`)) {
        if (!predicate || predicate(key)) {
          keysToDelete.push(key);
        }
      }
    }
    
    for (const key of keysToDelete) {
      this.cache.delete(key);
      const orderIndex = this.accessOrder.indexOf(key);
      if (orderIndex > -1) {
        this.accessOrder.splice(orderIndex, 1);
      }
    }
    
    debugLog(`[Cache] Invalidated ${keysToDelete.length} entries for ${channel}`);
  }

  /**
   * Get cache statistics
   */
  getStats() {
    return {
      size: this.cache.size,
      maxSize: this.maxSize,
      ttlMs: this.ttlMs,
    };
  }

  /**
   * Clear all cache entries
   */
  clear(): void {
    this.invalidate();
  }
}

/**
 * Create a cached version of an API object
 * 
 * @example
 * const cachedAPI = createCachedAPI(window.electronAPI, {
 *   getRoadmap: 60000, // Cache for 1 minute
 *   getProjects: 30000, // Cache for 30 seconds
 * });
 */
export function createCachedAPI<T extends Record<string, unknown>>(
  api: T,
  cacheConfig: Partial<Record<keyof T, number | CacheConfig>>
): T {
  const caches = new Map<keyof T, IPCCache>();
  
  return new Proxy(api, {
    get(target, prop: string | symbol) {
      const key = prop as keyof T;
      
      // Return non-function properties as-is
      if (typeof target[key] !== 'function') {
        return target[key];
      }
      
      const config = cacheConfig[key];
      
      // No caching configured for this method
      if (!config) {
        return target[key];
      }
      
      // Get or create cache for this method
      if (!caches.has(key)) {
        const cacheOptions: CacheConfig = typeof config === 'number'
          ? { ttlMs: config }
          : config as CacheConfig;
        caches.set(key, new IPCCache(cacheOptions));
      }
      
      const cache = caches.get(key)!;
      
      // Return cached version of function
      return async (...args: unknown[]) => {
        const cached = cache.get(String(prop), ...args);
        if (cached !== undefined) {
          return cached;
        }
        
        const result = await (target[key] as Function)(...args);
        
        // Add cache metadata to result
        const ttl = typeof config === 'number' ? config : config.ttlMs;
        cache.set(String(prop), result, ttl, ...args);
        
        // Add cache indicator to result metadata
        if (typeof result === 'object' && result !== null) {
          const ipcResult = result as any;
          if (ipcResult.metadata) {
            ipcResult.metadata.cached = false;
          }
        }
        
        return result;
      };
    },
  }) as T;
}

/**
 * Global cache instance for shared caching
 */
export const globalIPCCache = new IPCCache({
  ttlMs: 60000,
  maxSize: 200,
});
