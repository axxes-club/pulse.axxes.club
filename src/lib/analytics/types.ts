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
  cohorts: Array<{ day: string; size: number; retained: number[] }>;
  visitors: number;
  pageviews: number;
  sessions: number;
  conversions: number;
  conversionRate: number;
  series: Array<{ time: string; value: number }>;
  comparison: Array<{ time: string; value: number }>;
  sources: Breakdown[];
  pages: Breakdown[];
  countries: Breakdown[];
  devices: Breakdown[];
  events: Breakdown[];
  recent: AnalyticsEvent[];
  updatedAt: string;
  previous: { visitors: number; pageviews: number; conversions: number };
};
