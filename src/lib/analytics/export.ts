import type { AnalyticsEvent, AnalyticsReport, Breakdown } from "./types";
import { evaluateFunnel } from "./metrics";

type Cell = string | number | boolean | null;
type Funnel = { steps: string[]; windowMs: number };

function csvCell(value: Cell): string {
  if (value === null) return "";
  let text = String(value);
  // Collected labels are untrusted. Quotes alone do not prevent spreadsheet formulas.
  if (typeof value === "string" && /^(?:[=+\-@\t\r\n]|\s+[=+\-@])/.test(text)) text = "'" + text;
  return /[",\n\r]/.test(text) ? '"' + text.replaceAll('"', '""') + '"' : text;
}

/** Export the same measured data and counting rules as the active report. */
export function reportCsv(
  report: AnalyticsReport,
  view: string,
  options: { events?: AnalyticsEvent[]; funnel?: Funnel; goalNames?: string[] } = {},
): string {
  let header: string[];
  let rows: Cell[][];
  let overview = false;
  const breakdown = (items: Breakdown[]) => items.map(item => [item.name, item.value]);
  switch (view) {
    case "pages":
      header = ["page", "pageviews"];
      rows = breakdown(report.pages);
      break;
    case "acquisition":
      header = ["dimension", "name", "pageviews"];
      rows = [
        ...report.sources.map(item => ["source", item.name, item.value]),
        ...report.campaigns.map(item => ["campaign", item.name, item.value]),
      ];
      break;
    case "audience":
      header = ["dimension", "name", "pageviews"];
      rows = [
        ...report.countries.map(item => ["country", item.name, item.value]),
        ...report.devices.map(item => ["device", item.name, item.value]),
      ];
      break;
    case "events":
      header = ["event", "count", "conversion_goal"];
      rows = report.events.map(item => [item.name, item.value, (options.goalNames || []).includes(item.name)]);
      break;
    case "performance":
      header = ["metric", "p75", "samples"];
      rows = (["LCP", "INP", "CLS"] as const).map(metric => [metric, report.performance[metric].p75, report.performance[metric].samples]);
      break;
    case "retention":
      header = ["cohort_day", "cohort_size", ...Array.from({ length: 7 }, (_, i) => `day_${i}`)];
      rows = report.cohorts.map(cohort => [cohort.day, cohort.size, ...cohort.retained]);
      break;
    case "realtime":
      header = ["event", "time", "page", "source", "country", "device"];
      rows = report.live.map(event => [event.name, event.time, event.path, event.source, event.country, event.device]);
      break;
    case "funnels": {
      header = ["step", "sessions", "completion_rate"];
      const funnel = options.funnel || { steps: ["pageview", "signup"], windowMs: 1800000 };
      const share = report.sessionSample ?? report.sample;
      const factor = share ? 1 / share : 1;
      rows = evaluateFunnel(options.events || [], funnel.steps, funnel.windowMs).map(step => [step.step, Math.round(step.sessions * factor), step.rate]);
      break;
    }
    default:
      overview = true;
      header = ["metric", "value"];
      rows = [
        ["Visitors", report.visitors],
        ["Sessions", report.sessions],
        ["Pageviews", report.pageviews],
        ["Conversions", report.conversions],
        ["Conversion rate", report.conversionRate.toFixed(2)],
      ];
  }
  const share = view === "funnels" ? report.sessionSample ?? report.sample : report.sample;
  if ((share || (overview && report.sessionSample)) && view !== "realtime") {
    header.push("sample_share");
    rows = rows.map(row => [
      ...row,
      overview && ["Sessions", "Conversions", "Conversion rate"].includes(String(row[0]))
        ? report.sessionSample ?? report.sample ?? 1
        : share ?? 1,
    ]);
  }
  if (report.historyAvailable === false) {
    header.push("history_available");
    rows = rows.map(row => [...row, false]);
  }
  return [header, ...rows].map(row => row.map(csvCell).join(",")).join("\n");
}
