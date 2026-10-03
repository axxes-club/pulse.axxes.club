export type ReportQuery = {
  range: number;
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
  return {
    range: [1, 7, 30, 90].includes(range) ? range : 7,
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
    source: query.source,
    metric: query.metric,
    environment: query.environment,
    compare: String(query.compare),
  }).toString();
}
