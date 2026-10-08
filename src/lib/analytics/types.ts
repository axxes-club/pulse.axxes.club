export type AnalyticsEvent = {
  id: string;
  name: string;
  time: string;
  visitor: string;
  session: string;
  path: string;
  source: string;
  country: string;
  device: string;
  environment: "production" | "development";
  properties?: Record<string, string | number | boolean>;
};
export type Breakdown = { name: string; value: number };
export type AnalyticsReport = {
  identityMode: "ephemeral" | "persistent";
  performance: Record<
    "LCP" | "INP" | "CLS",
    { p75: number | null; samples: number }
  >;
  cohorts: Array<{ day: string; size: number; retained: Array<number|null> }>;
  visitors: number;
  pageviews: number;
  sessions: number;
  conversions: number;
  conversionRate: number;
  series: Array<{ time: string; value: number }>;
  comparison: Array<{ time: string; value: number }>;
  /** False when the requested comparison includes expired raw history. */
  comparisonAvailable?: boolean;
  /** False when part of the current date range is outside retained raw history. */
  historyAvailable?: boolean;
  sources: Breakdown[];
  campaigns: Breakdown[];
  pages: Breakdown[];
  countries: Breakdown[];
  devices: Breakdown[];
  events: Breakdown[];
  recent: AnalyticsEvent[];
  live: AnalyticsEvent[];
  updatedAt: string;
  /** Share of visitors the report was computed from, when a large window was sampled; null when exact. */
  sample?: number | null;
  /** Share of complete sessions used for sessions, conversion counts/rates, and funnels. */
  sessionSample?: number | null;
  previous: { visitors: number; pageviews: number; conversions: number };
};
