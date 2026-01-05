declare module '@sentry/electron/main' {
  export interface ErrorEvent {
    [key: string]: unknown;
  }

  export interface Scope {
    setContext: (key: string, value: Record<string, unknown>) => void;
  }

  export interface InitOptions {
    beforeSend?: (event: ErrorEvent) => ErrorEvent | null;
    tracesSampleRate?: number;
    profilesSampleRate?: number;
    dsn?: string;
    environment?: string;
    release?: string;
    debug?: boolean;
    enabled?: boolean;
  }

  export function init(options: InitOptions): void;
  export function captureException(error: Error): void;
  export function withScope(callback: (scope: Scope) => void): void;
}

declare module '@sentry/electron/renderer' {
  export interface ErrorEvent {
    [key: string]: unknown;
  }

  export interface Scope {
    setContext: (key: string, value: Record<string, unknown>) => void;
  }

  export interface InitOptions {
    beforeSend?: (event: ErrorEvent) => ErrorEvent | null;
    tracesSampleRate?: number;
    profilesSampleRate?: number;
    dsn?: string;
    environment?: string;
    release?: string;
    debug?: boolean;
    enabled?: boolean;
  }

  export function init(options: InitOptions): void;
  export function captureException(error: Error): void;
  export function withScope(callback: (scope: Scope) => void): void;
}
