export type ErrorEvent = Record<string, unknown>;

export type Scope = {
  setContext: (key: string, value: Record<string, unknown>) => void;
};

export type InitOptions = {
  beforeSend?: (event: ErrorEvent) => ErrorEvent | null;
  tracesSampleRate?: number;
  profilesSampleRate?: number;
  dsn?: string;
  environment?: string;
  release?: string;
  debug?: boolean;
  enabled?: boolean;
};

export function init(_options: InitOptions): void {}

export function captureException(_error: Error): void {}

export function withScope(callback: (scope: Scope) => void): void {
  callback({
    setContext: () => {}
  });
}
