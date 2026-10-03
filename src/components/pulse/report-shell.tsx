"use client";
import Link from "next/link";
import { useState } from "react";
import { useRouter, useSearchParams, usePathname } from "next/navigation";
import { PulseBrand } from "./brand";
import { ThemeToggle } from "./theme";
import { OrgSwitcher } from "@/components/org-switcher";
import { AllAppsSwitcher } from "@/components/all-apps-switcher";
import type { AppContext } from "@/lib/context";
import { Icon } from "./icon";
import { reportPath } from "@/lib/analytics/navigation";
const nav = [
  ["overview", "Overview", "grid"],
  ["realtime", "Live", "live"],
  ["audience", "Audience", "users"],
  ["acquisition", "Acquisition", "globe"],
  ["events", "Events", "bolt"],
  ["integrations", "Integrations", "code"],
];
const advanced = [
  ["funnels", "Funnels", "filter"],
  ["performance", "Performance", "chart"],
  ["retention", "Retention", "layers"],
];
export function ReportShell({
  view,
  children,
  demo = false,
  organization = "Your workspace",
  sites = [],
  selectedSiteId,
  context,
}: {
  view: string;
  children: React.ReactNode;
  demo?: boolean;
  organization?: string;
  sites?: Array<{ id: string; name: string; environment: string }>;
  selectedSiteId?: string;
  context?: AppContext;
}) {
  const router = useRouter();
  const embedded = usePathname().startsWith("/embed/");
  const search = useSearchParams();
  const [open, setOpen] = useState(false);
  const link = (v: string) => { const params = new URLSearchParams(search.toString()); if(demo) params.set("view",v); else params.delete("view"); return `${demo ? "/demo" : reportPath(v,embedded)}?${params}`; };
  return (
    <div className="workspace">
      <button
        className={`workspace-scrim ${open ? "open" : ""}`}
        aria-label="Close navigation"
        onClick={() => setOpen(false)}
      />
      <aside className={`workspace-rail ${open ? "open" : ""}`}>
        <PulseBrand />
        <div className="workspace-project">
          <span className="project-avatar">A</span>
          <div>
            {sites.length ? (
              <select
                aria-label="App"
                style={{
                  background: "transparent",
                  maxWidth: 130,
                  fontSize: 12,
                }}
                value={selectedSiteId}
                onChange={(e) => {
                  const site = sites.find((s) => s.id === e.target.value);
                  router.push(
                    `${reportPath("overview",embedded)}?site=${e.target.value}&environment=${site?.environment || "production"}`,
                  );
                }}
              >
                {sites.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.name} · {s.environment}
                  </option>
                ))}
              </select>
            ) : demo ? (
              "AXXES demo"
            ) : (
              organization
            )}
            <small>
              {demo ? "Sample app · axxes.app" : "Organization workspace"}
            </small>
          </div>
          <Icon name="down" size={13} />
        </div>
        <span className="rail-label">WORKSPACE</span>
        <nav className="workspace-nav" aria-label="Analytics navigation">
          {nav.map(([key, label, icon]) => (
            <Link
              href={link(key)}
              onClick={() => setOpen(false)}
              className={view === key ? "active" : ""}
              key={key}
            >
              <Icon name={icon} size={17} />
              {label}
              {key === "realtime" && <span className="nav-live-dot" />}
            </Link>
          ))}
        </nav>
        <span className="rail-label" style={{ marginTop: 20 }}>
          EXPLORE
        </span>
        <nav className="workspace-nav">
          {advanced.map(([key, label, icon]) => (
            <Link
              href={link(key)}
              onClick={() => setOpen(false)}
              className={view === key ? "active" : ""}
              key={key}
            >
              <Icon name={icon} size={17} />
              {label}
            </Link>
          ))}
        </nav>
        <div className="workspace-rail-bottom">
          {demo && (
            <div className="rail-demo-card">
              <strong>Your app belongs here.</strong>
              <p>Explore sample analytics, then connect your own app.</p>
              <Link href="/dashboard/integrations" className="button primary">
                Connect your app <Icon name="arrow" size={13} />
              </Link>
            </div>
          )}
          <nav className="workspace-nav">
            <Link href={link("settings")}><Icon name="shield" size={16}/> App settings</Link>
            <Link href="/docs">
              <Icon name="help" size={16} />
              Documentation
            </Link>
            <Link href="https://axxes.app">
              <Icon name="external" size={16} />
              Back to AXXES
            </Link>
          </nav>
          {context && <div style={{padding:"12px 0"}}><OrgSwitcher current={context.memberships.find(m=>m.tenantId===context.tenant.id)!} memberships={context.memberships}/><AllAppsSwitcher tenantId={context.tenant.id}/></div>}
          <div className="rail-user">
            <span className="project-avatar">
              <Icon name={demo ? "users" : "shield"} size={14} />
            </span>
            <div>
              {demo ? "Demo workspace" : organization}
              <small>
                {demo ? "No account required" : "Organization-scoped analytics"}
              </small>
            </div>
          </div>
        </div>
      </aside>
      <div className="workspace-main">
        <header className="workspace-header">
          <div className="workspace-breadcrumb">
            <button
              className="icon-button mobile-rail-button"
              aria-label="Open navigation"
              onClick={() => setOpen(true)}
            >
              <Icon name="menu" />
            </button>
            <span>Workspace</span>
            <Icon name="chevron" size={12} />
            <strong>
              {[...nav, ...advanced].find((n) => n[0] === view)?.[1] ||
                "Overview"}
            </strong>
          </div>
          <div className="workspace-header-actions">
            {demo && <span className="demo-badge">◌ Demo workspace</span>}
            <Link href="/docs">Help & feedback</Link>
            <ThemeToggle />
          </div>
        </header>
        <main className="workspace-content">{children}</main>
      </div>
    </div>
  );
}
