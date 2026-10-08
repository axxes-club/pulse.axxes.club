import { validTimezone, completeDayRange } from "./timezone";
export type ReportQuery = {
  range: number;
  from?: string;
  to?: string;
  path?: string;
  country?: string;
  campaign?:string;
  device?:string;
  timezone?: string;
  source: string;
  metric: "visitors" | "pageviews" | "conversions";
  environment: "production" | "development";
  compare: boolean;
};
export function parseReportQuery(
  search: URLSearchParams,
  _now = new Date(),
): ReportQuery {
  const range = Number(search.get("range") || 7);
  const metric = search.get("metric");
  const from=search.get("from") || "", to=search.get("to") || "";
  const timezone=validTimezone(search.get("timezone") || "UTC");
  const customDays=completeDayRange(from,to,timezone,_now);
  return {
    from: customDays ? from : "",
    to: customDays ? to : "",
    range: customDays || ([1, 7, 30, 90].includes(range) ? range : 7),
    path: (search.get("path") || "").slice(0,2048),
    country: (search.get("country") || "").slice(0,100),
    campaign:(search.get("campaign") || "").slice(0,256),
    device:(search.get("device") || "").slice(0,100),
    timezone,
    source: (search.get("source") || "").slice(0, 100),
    metric:
      metric === "pageviews" || metric === "conversions" ? metric : "visitors",
    environment:
      search.get("environment") === "development"
        ? "development"
        : "production",
    compare: search.get("compare") !== "false",
  };
}
export function queryString(query: ReportQuery): string {
  return new URLSearchParams({
    range: String(query.range),
    from:query.from || "",
    to:query.to || "",
    source: query.source,
    path: query.path || "",
    country: query.country || "",
    campaign:query.campaign || "",
    device:query.device || "",
    timezone: query.timezone || "UTC",
    metric: query.metric,
    environment: query.environment,
    compare: String(query.compare),
  }).toString();
}
/** Report and export routes use identical app defaults, while preserving explicit URL filters. */
export function parseSiteReportQuery(
  search: URLSearchParams,
  site: { timezone: string; environment: "production" | "development" },
  now = new Date(),
): ReportQuery {
  const parameters = new URLSearchParams(search);
  if (!parameters.has("timezone")) parameters.set("timezone", site.timezone);
  if (!parameters.has("environment")) parameters.set("environment", site.environment);
  return parseReportQuery(parameters, now);
}
