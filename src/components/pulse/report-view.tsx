"use client";
import { useMemo, useState, useEffect } from "react";
import { useRouter, useSearchParams, usePathname } from "next/navigation";
import Link from "next/link";
import { Icon } from "./icon";
import { PulseChart } from "./chart";
import {
  parseReportQuery,
  queryString,
  type ReportQuery,
} from "@/lib/analytics/query";
import { summarizeEvents, evaluateFunnel } from "@/lib/analytics/metrics";
import type {
  AnalyticsEvent,
  Breakdown,
  AnalyticsReport,
} from "@/lib/analytics/types";
import { completeDayRange, dateInZone, reportWindow } from "@/lib/analytics/timezone";
import { SiteSettings } from "./site-settings";
import { FunnelEditor } from "./funnel-editor";
import { IntegrationWizard } from "./integration-wizard";
const titles: Record<string, string> = {
  overview: "Overview",
  realtime: "Live activity",
  audience: "Your audience",
  pages: "Top pages",
  acquisition: "Where people come from",
  events: "Events & conversions",
  funnels: "Conversion funnels",
  performance: "App performance",
  retention: "Audience retention",
};
function BreakdownCard({
  title,
  rows,
  onSelect,
  icon = "globe",
  href,
  expanded = false,
  valueLabel = "PAGEVIEWS",
  showShare = true,
}: {
  title: string;
  rows: Breakdown[];
  onSelect?: (value: string) => void;
  icon?: string;
  href: string;
  expanded?: boolean;
  valueLabel?: string;
  /** False when values are already percentages, so a share of the column total means nothing. */
  showShare?: boolean;
}) {
  const total = rows.reduce((n, r) => n + r.value, 0);
  return (
    <section className="breakdown-card">
      <div className="breakdown-heading">
        <strong>{title}</strong>
        <Link href={href}>View report ↗</Link>
      </div>
      <div className="breakdown-subhead">
        <span>{title.toUpperCase()}</span>
        <span>{valueLabel}</span>
      </div>
      {rows.length ? (
        (expanded ? rows : rows.slice(0, 6)).map((row) => (
          <button
            className="breakdown-row"
            key={row.name}
            onClick={() => onSelect?.(row.name)}
            disabled={!onSelect}
          >
            <span
              className="row-bar"
              style={{
                width: `${Math.min((row.value / (rows[0]?.value || 1)) * 85, 85)}%`,
              }}
            />
            <span className="breakdown-name">
              <Icon name={icon} />
              <span className="row-name">{row.name}</span>
            </span>
            <span className="breakdown-value">
              {row.value.toLocaleString()}{showShare ? "" : "%"}
              {showShare && <small>
                {(total ? (row.value / total) * 100 : 0).toFixed(1)}%
              </small>}
            </span>
          </button>
        ))
      ) : (
        <p style={{ padding: 20, fontSize: 12, color: "var(--muted)" }}>
          No events in this period.
        </p>
      )}
      <Link className="breakdown-card-footer" href={href}>
        Explore {title.toLowerCase()} →
      </Link>
    </section>
  );
}
/** The one property that says what an automatic interaction was about. */
function eventDetail(e: { name: string; properties?: Record<string, string | number | boolean> }) {
  const p = e.properties || {};
  const detail = { contact_click: p.method, outbound_click: p.host, file_download: p.file, form_submit: p.form, scroll_depth: p.depth === undefined ? undefined : `${p.depth}%`, engagement: p.seconds === undefined ? undefined : `${p.seconds}s` }[e.name];
  return detail === undefined ? "" : String(detail);
}
function Interactions({ interactions, href }: { interactions: AnalyticsReport["interactions"]; href: string }) {
  const { contact, outbound, downloads, forms, scroll, engagement } = interactions;
  const any = contact.length || outbound.length || downloads.length || forms.length || scroll.length || engagement.pages;
  if (!any)
    return (
      <section className="feature-card" style={{ marginTop: 20 }}>
        <h3>Interactions</h3>
        <p>
          No automatic interactions in this period. Add <code>data-auto=&quot;all&quot;</code> to your tracking snippet to record contact clicks, outbound links, downloads, form submissions, scroll depth and engaged time.
        </p>
      </section>
    );
  const minutes = (s: number) => (s >= 60 ? `${Math.floor(s / 60)}m ${s % 60}s` : `${s}s`);
  return (
    <>
      <div className="integration-intro" style={{ marginTop: 20 }}>
        <div>
          <h2>Interactions</h2>
          <p>
            {engagement.averageSeconds === null
              ? "Engaged time appears once visitors leave a page."
              : `${minutes(engagement.averageSeconds)} average engaged time across ${engagement.pages.toLocaleString()} page visits.`}
          </p>
        </div>
      </div>
      <div className="breakdown-grid">
        {contact.length > 0 && <BreakdownCard title="Contact" rows={contact} valueLabel="CLICKS" href={href} icon="target" expanded />}
        {outbound.length > 0 && <BreakdownCard title="Outbound links" rows={outbound} valueLabel="CLICKS" href={href} icon="external" />}
        {downloads.length > 0 && <BreakdownCard title="Downloads" rows={downloads} valueLabel="DOWNLOADS" href={href} icon="layers" />}
        {forms.length > 0 && <BreakdownCard title="Forms" rows={forms} valueLabel="SUBMISSIONS" href={href} icon="target" />}
        {scroll.length > 0 && <BreakdownCard title="Scroll depth" rows={scroll} valueLabel="OF PAGEVIEWS" showShare={false} href={href} icon="layers" expanded />}
      </div>
    </>
  );
}
import { reportPath } from "@/lib/analytics/navigation";
export function ReportView({
  view = "overview",
  demo = false,
  events = [],
  data,
  siteId,
  organizationKey,
  funnels = [],
  goalNames = [],
  canManage = false,
  timezone = "UTC",
  environment = "production",
}: {
  view?: string;
  demo?: boolean;
  events?: AnalyticsEvent[];
  data?: AnalyticsReport;
  siteId?: string;
  organizationKey?: string;
  funnels?: Array<{
    id: string;
    name: string;
    steps: string[];
    windowMs: number;
  }>;
  goalNames?: string[];
  canManage?: boolean;
  timezone?: string;
  environment?: "production" | "development";
}) {
  const [ready, setReady] = useState(false);
  useEffect(() => setReady(true), []);
  const embedded = usePathname().startsWith("/embed/");
  const router = useRouter(),
    search = useSearchParams(),
    query = parseReportQuery(new URLSearchParams(search.toString()));
  if(!search.has("timezone")) query.timezone = timezone;
  if (!demo) query.environment = environment;
  const selectedFunnel = funnels.find(f => f.id === search.get("funnel")) || funnels[0];
  const funnelSuffix = selectedFunnel ? `&funnel=${encodeURIComponent(selectedFunnel.id)}` : "";
  const [now] = useState(() => new Date());
  const report = useMemo(
    () => data || summarizeEvents(events, query, now),
    [
      events,
      query.range,
      query.source,
      query.path,
      query.country,
      query.timezone,
      query.metric,
      query.environment,
      data,
      now,
    ],
  );
  const link = (v: string) =>
    demo
      ? `/demo?view=${v}&${queryString(query)}${funnelSuffix}`
      : `${reportPath(v,embedded)}?${queryString(query)}${siteId ? `&site=${siteId}` : ""}${funnelSuffix}`;
  const update = (patch: Partial<ReportQuery>) => {
    const next = { ...query, ...patch };
    router.push(
      `${demo ? `/demo?view=${view}&` : `${reportPath(view,embedded)}?`}${queryString(next)}${siteId ? `&site=${siteId}` : ""}${funnelSuffix}`,
      { scroll: false },
    );
  };
  useEffect(() => { if (!["realtime","overview"].includes(view) || demo) return; const timer = setInterval(() => { if(document.visibilityState === "visible") router.refresh(); },10000); return () => clearInterval(timer); },[view,demo,router]);
  const initialWindow = reportWindow(query.range,query.timezone || timezone,now,query.from,query.to);
  const [customFrom,setCustomFrom] = useState(query.from || dateInZone(initialWindow.start,query.timezone || timezone));
  const [customTo,setCustomTo] = useState(query.to || dateInZone(initialWindow.end-1,query.timezone || timezone));
  const [dateError,setDateError] = useState("");
  const [goalStatus, setGoalStatus] = useState("");
  if (view === "settings") return <SiteSettings key={`${organizationKey || "workspace"}:${siteId || "none"}`} siteId={siteId} canManage={canManage} demo={demo}/>;
  if (view === "integrations")
    return <IntegrationWizard demo={demo} organizationKey={organizationKey} />;
  const reportSample = view === "funnels" ? report.sessionSample ?? report.sample : report.sample;
  const metrics = [
    {
      key: "visitors",
      label: "Visitors",
      value: report.visitors,
      old: report.previous.visitors,
    },
    {
      key: "pageviews",
      label: "Pageviews",
      value: report.pageviews,
      old: report.previous.pageviews,
    },
    {
      key: "conversions",
      label: "Conversions",
      value: report.conversions,
      old: report.previous.conversions,
    },
    {
      key: "rate",
      label: "Conversion rate",
      value: report.conversionRate,
      old: null,
    },
  ];

  async function markGoal(eventName: string) {
    if (demo) {
      setGoalStatus("Sign in to save goals for your own app.");
      return;
    }
    try {
      const r = await fetch(`/api/pulse/sites/${siteId}/goals`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ eventName }),
      });
      const data = await r.json();
      if (!r.ok) throw new Error(data.error || "Could not save goal");
      router.refresh();
      setGoalStatus("Conversion goal saved.");
    } catch (e) {
      setGoalStatus(e instanceof Error ? e.message : "Could not save goal");
    }
  }
  async function removeConfiguration(resource: "goals" | "funnels", body: Record<string,string>, confirmation: string) {
    if (!siteId || !canManage || demo || !window.confirm(confirmation)) return;
    try {
      const response = await fetch(`/api/pulse/sites/${siteId}/${resource}`,{method:"DELETE",headers:{"Content-Type":"application/json"},body:JSON.stringify(body)});
      const result=await response.json();
      if(!response.ok)throw Error(result.error || "Could not remove configuration");
      setGoalStatus(resource === "goals" ? "Conversion goal removed." : "Funnel removed.");
      router.refresh();
    } catch(error) {setGoalStatus(error instanceof Error?error.message:"Could not remove configuration");}
  }
  const exportCsv = () => {
    if (!demo && siteId) {
      window.location.href = `/api/pulse/sites/${siteId}/export?${queryString(query)}&view=${encodeURIComponent(view)}${funnelSuffix}`;
      return;
    }
    const csv = [
      "metric,value",
      ...metrics.map((m) => `${m.label},${m.value}`),
    ].join("\n");
    const u = URL.createObjectURL(new Blob([csv], { type: "text/csv" }));
    const a = document.createElement("a");
    a.href = u;
    a.download = "pulse-demo-report.csv";
    a.click();
    URL.revokeObjectURL(u);
  };
  return (
    <>
      <div className="workspace-title">
        <div>
          <h1>
            {titles[view] || "Overview"}
            {view === "overview" && (
              <span className="live-pill">
                <i />
                {demo ? "Sample" : report.pageviews || report.live.length ? "Receiving data" : "Waiting for traffic"}
              </span>
            )}
          </h1>
          <p>
            {view === "overview"
              ? "The bigger picture, at a glance. Here’s how your app is doing."
              : "Explore what matters. Keep your filters as you go."}
            {reportSample ? (
              <span className="sample-note" title={view === "funnels" ? "Large funnel periods use a fixed share of complete sessions and scale the session counts up." : "Large periods are computed from a fixed share of visitors and scaled up. Live activity and recent events are exact."}>
                {" "}Estimated from {reportSample >= 0.1 ? Math.round(reportSample * 100) : (reportSample * 100).toFixed(reportSample < 0.001 ? 2 : 1)}% of {view === "funnels" ? "sessions" : "visitors"}.
              </span>
            ) : null}
          </p>
        </div>
        <div className="workspace-controls">
          <span className="select-control" title="Choose an app and environment in the app selector.">{query.environment === "production" ? "Production" : "Development"}</span>
          <select
            disabled={!ready}
            aria-label="Date range"
            value={query.from ? "custom" : query.range}
            onChange={(e) => update({ range: Number(e.target.value),from:"",to:"" })}
          >
            {query.from && <option value="custom">{query.from} – {query.to}</option>}
            {[1, 7, 30, 90].map((n) => (
              <option key={n} value={n}>
                Last {n} {n === 1 ? "day" : "days"}
              </option>
            ))}
          </select>
          <select aria-label="Reporting timezone" value={query.timezone || "UTC"} disabled={!ready} onChange={e=>update({timezone:e.target.value})}>{Array.from(new Set([timezone,"UTC","America/Puerto_Rico","America/New_York","America/Los_Angeles","Europe/London","Asia/Tokyo"])).map(zone=><option key={zone}>{zone}</option>)}</select>
          <button className="button secondary small" onClick={exportCsv}>
            <Icon name="download" size={14} />
            Export
          </button>
        </div>
      </div>
      <details className="integration-advanced" style={{marginBottom:18}}><summary>Choose custom dates</summary><div className="integration-form"><label>From<input type="date" value={customFrom} onChange={e=>setCustomFrom(e.target.value)}/></label><label>Through · complete day<input type="date" value={customTo} max={dateInZone(Date.now()-86400000,query.timezone || timezone)} onChange={e=>setCustomTo(e.target.value)}/></label></div><button className="button secondary small" onClick={()=>{const days=completeDayRange(customFrom,customTo,query.timezone || timezone);if(!days){setDateError("Choose 1–90 complete days, ending before today.");return;}setDateError("");update({from:customFrom,to:customTo,range:days})}}>Apply dates</button>{dateError&&<p role="status">{dateError}</p>}</details>
      <p className="muted" style={{fontSize:12,marginBottom:20}}>Complete days in {query.timezone} · updated {new Date(report.updatedAt).toLocaleTimeString("en-US",{timeZone:query.timezone})}. Visitors are site-scoped estimates; conversion rate counts sessions completing a goal.</p>
      {report.historyAvailable === false && <p className="demo-notice" role="status">Some of this date range is outside retained history. Totals cover available events.</p>}
      {report.comparisonAvailable === false && <p className="muted">The previous period is outside retained history; a comparison is unavailable.</p>}
      {demo && view !== "overview" && (
        <div className="demo-notice">
          Sample data · explore freely. Connect your app for real analytics.
        </div>
      )}
      {(query.source || query.path || query.country || query.campaign || query.device) && (
        <div className="filters-bar">
          {(["source","path","country","campaign","device"] as const).filter(key=>query[key]).map(key=><button key={key} className="filter-chip" onClick={()=>update({[key]:""})}>{key}: {query[key]}<Icon name="close" size={12}/></button>)}
          <button
            className="muted"
            style={{ fontSize: 11 }}
            onClick={() => update({ source: "", path:"", country:"", campaign:"", device:"" })}
          >
            Clear filters
          </button>
        </div>
      )}
      {view === "overview" && <section className="integration-intro" style={{marginBottom:20}}><div><h2><span className="live-dot" style={{marginRight:10}}/>{new Set(report.live.filter(e=>e.name === "pageview").map(e=>e.visitor)).size} visitors live now</h2><p>Persisted activity in the last five minutes. New traffic appears here as it arrives; complete-day totals fill in after midnight.</p></div><Link className="button secondary small" href={link("realtime")}>Open live activity →</Link></section>}
      {["overview", "acquisition", "audience", "pages"].includes(view) && (
        <>
          <section className="report-metrics">
            {metrics.map((m) => {
              const change = report.comparisonAvailable !== false && m.old ? ((m.value - m.old) / m.old) * 100 : null;
              return (
                <button
                  className={`report-metric ${query.metric === m.key ? "selected" : ""}`}
                  key={m.key}
                  onClick={() =>
                    m.key !== "rate" &&
                    update({ metric: m.key as ReportQuery["metric"] })
                  }
                  aria-pressed={query.metric === m.key}
                >
                  <span className="metric-label">
                    {m.label}
                    <span
                      title={
                        m.key === "visitors"
                          ? "Estimated distinct site-scoped visitors in this period."
                          : m.key === "rate"
                            ? "Sessions with a conversion divided by all sessions."
                            : "Accepted events in the selected period."
                      }
                    >
                      <Icon name="help" size={12} />
                    </span>
                  </span>
                  <strong className="metric-value">
                    {m.key === "rate"
                      ? `${m.value.toFixed(2)}%`
                      : m.value.toLocaleString()}
                  </strong>
                  <small
                    className={`metric-change ${change !== null && change < 0 ? "negative" : ""}`}
                  >
                    {change === null
                      ? "—"
                      : `${change >= 0 ? "↗" : "↘"} ${Math.abs(change).toFixed(1)}%`}
                    <span>
                      {change === null
                        ? "Period summary"
                        : "vs. previous period"}
                    </span>
                  </small>
                </button>
              );
            })}
          </section>
          <section className="report-chart-card">
            <div className="chart-card-header">
              <strong>
                {query.metric[0].toUpperCase() + query.metric.slice(1)} over
                time
              </strong>
              <div className="chart-legend">
                <span>
                  <i />
                  This period
                </span>
                {report.comparisonAvailable !== false && <button
                  onClick={() => update({ compare: !query.compare })}
                  aria-pressed={query.compare}
                >
                  <span>
                    <i className="previous-dot" /> Previous period{" "}
                    {query.compare ? "✓" : ""}
                  </span>
                </button>}
              </div>
            </div>
            <PulseChart
              series={report.series}
              comparison={query.compare && report.comparisonAvailable !== false ? report.comparison : undefined}
              label={query.metric}
            />
            <div className="chart-axis">
              {report.series
                .filter(
                  (_, i) =>
                    i === 0 ||
                    i === Math.floor(report.series.length / 3) ||
                    i === Math.floor((report.series.length * 2) / 3) ||
                    i === report.series.length - 1,
                )
                .map((p) => (
                  <span key={p.time}>{p.time}</span>
                ))}
            </div>
            <div className="report-footer">
              <span>
                <span className="live-dot" />
                {demo ? "Sample analytics" : "Persisted events"} <b>{query.timezone}</b>
              </span>
              <span>
                {report.sessions.toLocaleString()} sessions · visitors are
                estimates
              </span>
            </div>
          </section>
          <div className="breakdown-grid">
            {view === "acquisition" && <BreakdownCard title="Campaigns" rows={report.campaigns} expanded href={link("acquisition")} onSelect={campaign=>update({campaign})}/>}
            {view === "audience" ? (
              <>
                <BreakdownCard
                  title="Countries"
                  rows={report.countries}
                  expanded={view === "audience"}
                  onSelect={(country)=>update({country})}
                  href={link("audience")}
                />
                <BreakdownCard
                  title="Devices"
                  rows={report.devices}
                  expanded
                  onSelect={device=>update({device})}
                  href={link("audience")}
                  icon="layers"
                />
                <BreakdownCard
                  title="Sources"
                  rows={report.sources}
                  onSelect={(source) => update({ source })}
                  href={link("acquisition")}
                />
              </>
            ) : (
              <>
                <BreakdownCard
                  title="Sources"
                  rows={report.sources}
                  expanded={view === "acquisition"}
                  onSelect={(source) => update({ source })}
                  href={link("acquisition")}
                />
                <BreakdownCard
                  title="Pages"
                  rows={report.pages}
                  expanded={view === "pages"}
                  onSelect={(path)=>update({path})}
                  href={link("pages")}
                  icon="external"
                />
                <BreakdownCard
                  title="Countries"
                  rows={report.countries}
                  expanded={view === "audience"}
                  onSelect={(country)=>update({country})}
                  href={link("audience")}
                />
              </>
            )}
          </div>
        </>
      )}
      {["events", "realtime"].includes(view) && (
        <>
          <div className="integration-intro">
            <div>
              <h2>
                {view === "events"
                  ? `${report.conversions.toLocaleString()} conversion sessions`
                  : `${demo ? "Sample" : "Recent"} activity`}
              </h2>
              <p>
                {view === "events"
                  ? "Repeated goal events do not inflate your conversion rate."
                  : demo
                    ? "Generated samples, not a production live feed."
                    : "Persisted events in the last five minutes · refreshes every 10 seconds."}
              </p>
            </div>
            <Icon name={view === "events" ? "target" : "live"} size={30} />
          </div>
          <div className="table-scroll">
            <table className="events-table">
              <thead>
                <tr>
                  <th>Event</th>
                  <th>Page</th>
                  <th>Source</th>
                  <th>Time · {query.timezone}</th>
                </tr>
              </thead>
              <tbody>
                {(view === "events"
                  ? report.recent.filter((e) => e.name !== "pageview")
                  : report.live
                ).map((e) => (
                  <tr key={e.id}>
                    <td>{e.name}{eventDetail(e) && <span className="muted"> · {eventDetail(e)}</span>}</td>
                    <td>{e.path}</td>
                    <td>{e.source}</td>
                    <td>
                      {new Date(e.time).toLocaleTimeString("en-US", {
                        timeZone: query.timezone,
                      })}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      )}
      {view === "events" && <Interactions interactions={report.interactions} href={link("events")}/>}
      {view === "events" && (
        <section className="feature-card" style={{ marginTop: 20 }}>
          <h3>Your observed events</h3>
          <p>
            Turn an event into a conversion goal without adding a second
            tracking call.
          </p>
          {report.events.map((event) => (
            <div className="connection-row" key={event.name}>
              <span>{event.name}</span>
              <span>{event.value.toLocaleString()} events</span>
              {(demo || canManage) && (
                <button
                  className="button secondary small"
                  onClick={() => goalNames.includes(event.name) && !demo ? removeConfiguration("goals",{eventName:event.name},`Remove conversion goal “${event.name}”?`) : markGoal(event.name)}
                >
                  {goalNames.includes(event.name)
                    ? "Remove goal"
                    : "Mark as goal"}
                </button>
              )}
            </div>
          ))}
          {goalNames.filter(name=>!report.events.some(event=>event.name===name)).map(name=><div className="connection-row" key={name}><span>{name}</span><span>No events in this period</span>{canManage && !demo && <button className="button secondary small" onClick={()=>removeConfiguration("goals",{eventName:name},`Remove conversion goal “${name}”?`)}>Remove goal</button>}</div>)}
          {goalStatus && <p role="status">{goalStatus}</p>}
        </section>
      )}
      {view === "funnels" && goalStatus && <p role="status">{goalStatus}</p>}
      {view === "funnels" && (
        <>
          <div className="integration-intro">
            <div>
              <h2>{selectedFunnel?.name || "From first visit to signup"}</h2>
              <p>
                Ordered events in the same session, completed within{" "}
                {Math.round((selectedFunnel?.windowMs || 1800000) / 60000)} minutes.
              </p>
            </div>
            <Icon name="filter" size={30} />
          </div>
          {(demo || canManage) && (
            <FunnelEditor
              siteId={siteId}
              demo={demo}
              eventNames={report.events.map((e) => e.name)}
            />
          )}
          {funnels.length > 0 && <div className="workspace-controls" style={{marginBottom:20}}><label>Saved funnel <select aria-label="Saved funnel" value={selectedFunnel?.id} onChange={e=>{const params=new URLSearchParams(queryString(query));if(siteId)params.set("site",siteId);params.set("funnel",e.target.value);if(demo)params.set("view","funnels");router.push(`${demo?"/demo":reportPath("funnels",embedded)}?${params}`,{scroll:false})}}>{funnels.map(f=><option key={f.id} value={f.id}>{f.name}</option>)}</select></label>{canManage && !demo && selectedFunnel && <button className="button secondary small" onClick={()=>removeConfiguration("funnels",{funnelId:selectedFunnel.id},`Remove funnel “${selectedFunnel.name}”?`)}>Remove funnel</button>}</div>}
          <section className="breakdown-card">
            {evaluateFunnel(
              events,
              selectedFunnel?.steps || ["pageview", "signup"],
              selectedFunnel?.windowMs || 1800000,
            ).map((step, i) => (
              <div className="funnel-stage" key={`${i}-${step.step}`}>
                <div>
                  {i + 1}. {step.step}
                  <small>{step.rate.toFixed(1)}% of entrants</small>
                </div>
                <div className="funnel-bar">
                  <i style={{ width: `${step.rate}%` }} />
                  <span>{(reportSample ? Math.round(step.sessions / reportSample) : step.sessions).toLocaleString()} sessions</span>
                </div>
              </div>
            ))}
          </section>
        </>
      )}
      {view === "performance" && (
        <>
          <div className="integration-intro">
            <div>
              <h2>Measured from real page experiences.</h2>
              <p>
                75th percentile · full-page loads ·{" "}
                {demo ? "sample measurements" : "actual collected samples"}.
                Sparse data deserves a careful interpretation.
              </p>
            </div>
            <Icon name="bolt" size={30} />
          </div>
          <div className="breakdown-grid">
            {(["LCP", "INP", "CLS"] as const).map((metric) => (
              <section className="feature-card" key={metric}>
                <span className="tiny-label">{metric}</span>
                <h3
                  style={{
                    fontSize: 32,
                    marginTop: 20,
                    fontFamily: "var(--font-mono)",
                  }}
                >
                  {report.performance[metric].p75 === null
                    ? "—"
                    : metric === "CLS"
                      ? report.performance[metric].p75.toFixed(3)
                      : `${Math.round(report.performance[metric].p75)} ms`}
                </h3>
                <p>
                  {metric === "LCP"
                    ? "Largest Contentful Paint"
                    : metric === "INP"
                      ? "Interaction to Next Paint"
                      : "Cumulative Layout Shift"}
                </p>
                <p>
                  {report.performance[metric].samples} samples ·{" "}
                  {report.performance[metric].samples < 20
                    ? "limited data"
                    : "p75"}
                </p>
              </section>
            ))}
          </div>
        </>
      )}
      {view === "retention" &&
        (report.identityMode === "persistent" ? (
          <>
            <div className="integration-intro">
              <div>
                <h2>See who comes back.</h2>
                <p>
                  Daily cohorts · first observed in this report window ·
                  site-scoped opt-in identity. Retention includes verified persistent-identity events; older unmarked events are excluded.
                </p>
              </div>
              <Icon name="users" size={30} />
            </div>
            <div className="table-scroll">
              <table className="events-table">
                <thead>
                  <tr>
                    <th>Cohort · UTC</th>
                    <th>Visitors</th>
                    {Array.from({ length: 7 }, (_, i) => (
                      <th key={i}>Day {i}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {report.cohorts.map((c) => (
                    <tr key={c.day}>
                      <td>{c.day}</td>
                      <td>{c.size}</td>
                      {c.retained.map((value, i) => (
                        <td key={i}>{value === null ? "—" : `${((value / c.size) * 100).toFixed(0)}%`}</td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </>
        ) : (
          <div className="empty-report">
            <Icon name="layers" size={35} />
            <h2>Understand who comes back.</h2>
            <p>
              Retention requires explicitly enabled, site-scoped persistent
              identity. Default traffic analytics does not identify people
              across visits.
            </p>
            <Link className="button secondary" href={siteId ? `/dashboard/settings?${queryString(query)}&site=${siteId}` : link("integrations")}>
              Set up opt-in identity <Icon name="arrow" size={15} />
            </Link>
          </div>
        ))}
      <div className="workspace-bottom-note">
        <Icon name="shield" size={12} />
        {demo
          ? "Sample data. Real clarity. Connect your app when you’re ready."
          : "Your organization. Your analytics. Scoped by AXXES."}
      </div>
    </>
  );
}

export function ReportRetry() {
  const router=useRouter();
  return <button className="button secondary" onClick={()=>router.refresh()}>Try again</button>;
}
