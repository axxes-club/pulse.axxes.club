export type PulseProperties = Record<string, string | number | boolean>;
export interface PulseClient {
  page(): void;
  track(name: string, properties?: PulseProperties): void;
  flush(): void;
  consent(granted: boolean): void;
  destroy(): void;
}
export interface PulseOptions {
  siteId: string;
  endpoint?: string;
  environment?: 'production' | 'development';
  performance?: boolean;
  consentRequired?: boolean;
  identity?: 'ephemeral' | 'persistent';
}
export function loadPulse(options: PulseOptions): Promise<PulseClient | null>;
declare global { interface Window { pulse?: PulseClient } }
