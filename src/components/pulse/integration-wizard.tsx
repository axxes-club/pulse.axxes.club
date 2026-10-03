"use client";
import { useState, useEffect } from "react";
import Link from "next/link";
import { Icon } from "./icon";
import {
  platforms,
  getInstallationRecipe,
  type IntegrationPlatform,
} from "@/lib/analytics/recipes";
export function IntegrationWizard({
  demo = false,
  organizationKey,
}: {
  demo?: boolean;
  organizationKey?: string;
}) {
  const storageKey = demo
    ? "pulse-demo-setup"
    : `pulse-setup:${organizationKey || "workspace"}`;
  const [identityMode, setIdentityMode] = useState<"ephemeral" | "persistent">(
    "ephemeral",
  );
  const [platform, setPlatform] = useState<IntegrationPlatform>("html"),
    [name, setName] = useState(""),
    [origin, setOrigin] = useState(""),
    [environment, setEnvironment] = useState<"production" | "development">(
      "production",
    ),
    [siteId, setSiteId] = useState("YOUR_PUBLIC_APP_ID"),
    [copied, setCopied] = useState(false),
    [status, setStatus] = useState("waiting"),
    [error, setError] = useState(""),
    [pending, setPending] = useState(false),
    [serverKey, setServerKey] = useState("");
  useEffect(() => {
    try {
      const saved = JSON.parse(localStorage.getItem(storageKey) || "null");
      if (saved) {
        setName(saved.name || "");
        setOrigin(saved.origin || "");
        if (platforms.some((p) => p.id === saved.platform))
          setPlatform(saved.platform);
        setEnvironment(
          saved.environment === "development" ? "development" : "production",
        );
        if (/^[a-zA-Z0-9_-]{1,100}$/.test(saved.siteId || ""))
          setSiteId(saved.siteId);
      }
    } catch {}
  }, []);
  const recipe = getInstallationRecipe(platform, {
    publicSiteId: siteId,
    endpoint: "https://pulse.axxes.app",
    environment,
  });
  if (identityMode === "persistent" && !["node", "http"].includes(platform))
    recipe.code = recipe.code.replace(
      "data-site=",
      'data-identity="persistent" data-consent="required" data-site=',
    );
  async function copy() {
    try {
      await navigator.clipboard.writeText(recipe.code);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      setError(
        "Select and copy the setup code below. Clipboard access is unavailable.",
      );
    }
  }
  async function create() {
    if (demo) {
      setError(
        "This is a demo. Sign in to create an app and receive your own tracking identifier.",
      );
      return;
    }
    setPending(true);
    setError("");
    try {
      const response = await fetch("/api/pulse/sites", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name,
          origin,
          platform,
          environment,
          identityMode,
        }),
      });
      const data = await response.json();
      if (!response.ok)
        throw new Error(data.error || "Could not create your app");
      setSiteId(data.publicId);
      setStatus("waiting");
      localStorage.setItem(
        storageKey,
        JSON.stringify({
          name,
          origin,
          platform,
          environment,
          siteId: data.publicId,
        }),
      );
      if (["node", "http"].includes(platform)) {
        const keyResponse = await fetch(
          `/api/pulse/sites/${data.publicId}/credentials`,
          { method: "POST" },
        );
        const keyData = await keyResponse.json();
        if (!keyResponse.ok)
          throw new Error(keyData.error || "Could not issue server credential");
        setServerKey(keyData.credential);
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not create app");
    } finally {
      setPending(false);
    }
  }
  async function verify() {
    if (demo) {
      setError(
        "Demo setup does not send or verify production events. Connect your own app after signing in.",
      );
      return;
    }
    if (siteId === "YOUR_PUBLIC_APP_ID") {
      setError("Create your app first to get its tracking identifier.");
      return;
    }
    setPending(true);
    try {
      const r = await fetch(
        `/api/pulse/sites/${siteId}/verify?environment=${environment}`,
      );
      const data = await r.json();
      if (!r.ok) throw new Error(data.error || "Verification unavailable");
      setStatus(data.connected ? "connected" : "waiting");
      setError(
        data.connected
          ? ""
          : "No persisted event yet. Check your script identifier, allowed origin, and consent settings.",
      );
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not verify");
    } finally {
      setPending(false);
    }
  }
  return (
    <>
      <div className="workspace-title">
        <div>
          <h1>Connect your app</h1>
          <p>Choose your platform. Add a little code. Get a clearer picture.</p>
        </div>
        <Link href="/docs" className="button secondary small">
          Read the docs <Icon name="external" size={14} />
        </Link>
      </div>
      {demo && (
        <div className="demo-notice">
          <Icon name="help" size={15} /> You're exploring sample setup. Sign in
          to connect a real app.
        </div>
      )}
      <div className="integration-intro">
        <div>
          <h2>One integration. Everything starts to make sense.</h2>
          <p>
            Pageviews are automatic for browser apps. Custom events are yours to
            define.
          </p>
        </div>
        <Icon name="code" size={35} />
      </div>
      <div className="installation-step">
        <span className="step-number">1</span>
        <div>
          <h3>What are you building?</h3>
          <p>Pick your platform for setup that fits your app.</p>
        </div>
      </div>
      <div className="integration-platforms">
        {platforms.map((p) => (
          <button
            key={p.id}
            className={`platform-card ${platform === p.id ? "active" : ""}`}
            onClick={() => {
              setPlatform(p.id);
              setError("");
            }}
            aria-pressed={platform === p.id}
          >
            <span className="platform-symbol">{p.symbol}</span>
            <strong>{p.name}</strong>
            <small>{p.description}</small>
            {platform === p.id && <Icon name="check" size={15} />}
          </button>
        ))}
      </div>
      <div className="integration-form">
        <label>
          App name
          <input
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="My awesome app"
            maxLength={100}
          />
        </label>
        {!["node", "http"].includes(platform) && (
          <label>
            Website address
            <input
              type="url"
              value={origin}
              onChange={(e) => setOrigin(e.target.value)}
              placeholder="https://your-app.com"
            />
          </label>
        )}
        <label>
          Environment
          <select
            value={environment}
            onChange={(e) =>
              setEnvironment(e.target.value as "production" | "development")
            }
          >
            <option value="production">Production</option>
            <option value="development">Development</option>
          </select>
        </label>
      </div>
      <button
        className="button primary small"
        onClick={create}
        disabled={pending || !name.trim()}
      >
        Create app & get setup <Icon name="arrow" size={15} />
      </button>
      {serverKey && (
        <div className="installation-code" style={{ marginTop: 20 }}>
          <div className="installation-code-header">
            Server environment · shown once
          </div>
          <pre>
            <code>PULSE_SERVER_KEY={serverKey}</code>
          </pre>
          <p style={{ padding: 15, fontSize: 12, color: "var(--muted)" }}>
            Copy this into your server environment. It is not saved in this
            browser and must never enter client code.
          </p>
        </div>
      )}
      <div className="installation-area">
        <div>
          <div className="installation-step">
            <span className="step-number">2</span>
            <div>
              <h3>Add Pulse to your app</h3>
              <p>{recipe.instruction}</p>
            </div>
          </div>
          <div className="installation-code">
            <div className="installation-code-header">
              <span>{recipe.file}</span>
              <button onClick={copy} className="copy-button">
                <Icon name={copied ? "check" : "copy"} size={13} />
                {copied ? "Copied" : "Copy code"}
              </button>
            </div>
            <pre>
              <code>{recipe.code}</code>
            </pre>
          </div>
          <details className="integration-advanced">
            <summary>Consent, custom events, and advanced setup</summary>
            <label
              style={{
                display: "flex",
                gap: 10,
                alignItems: "center",
                marginTop: 18,
              }}
            >
              <input
                type="checkbox"
                disabled={siteId !== "YOUR_PUBLIC_APP_ID"}
                checked={identityMode === "persistent"}
                onChange={(e) =>
                  setIdentityMode(e.target.checked ? "persistent" : "ephemeral")
                }
              />
              Enable opt-in persistent identity for retention
            </label>
            <p>
              Use <code>data-consent="required"</code> to wait for consent, then
              call <code>window.pulse.consent(true)</code> from your consent
              manager. Pulse respects Global Privacy Control.
            </p>
            <p>
              Track a feature with{" "}
              <code>{`window.pulse.track('feature_used', { feature: 'export' })`}</code>
              . Never send passwords, payment details, or document content.
            </p>
            <p>
              Browser identifiers are public. Authoritative purchases and
              revenue require a scoped server credential. Development traffic
              stays separate from your production reports.
            </p>
          </details>
        </div>
        <div className="verification-card">
          <div className="installation-step">
            <span className="step-number">3</span>
            <h3>See your first event</h3>
          </div>
          <div className="verification-status">
            <span
              className="live-dot"
              style={{
                background: status === "connected" ? "#61d4a0" : "#d8a657",
              }}
            />
            {status === "connected"
              ? "Connected · event received"
              : "Waiting for your first event"}
          </div>
          <p>
            Open your app after installing the script. Pulse confirms the
            connection once an event is safely stored.
          </p>
          <button
            className="button secondary"
            onClick={verify}
            disabled={pending}
          >
            {pending ? "Checking…" : "Check connection"}
            <Icon name="arrow" size={15} />
          </button>
          {status === "connected" && (
            <Link href="/dashboard" className="button primary">
              Open analytics <Icon name="arrow" size={15} />
            </Link>
          )}
          <p className="muted">
            No event yet? Check the app ID and allowed origin, then verify that
            consent permits tracking.
          </p>
        </div>
      </div>
      {error && (
        <p className="demo-notice" role="status" style={{ marginTop: 20 }}>
          {error}
        </p>
      )}
      <div className="connection-list">
        <h2>Built for your entire stack</h2>
        <div className="connection-row">
          <span className="project-avatar">
            <Icon name="layers" size={15} />
          </span>
          <div>
            AXXES ecosystem
            <p className="muted" style={{ fontSize: 11, marginTop: 4 }}>
              Shared accounts, organizations, and app branding.
            </p>
          </div>
          <span>Connect & verify per app</span>
        </div>
        <div className="connection-row">
          <span className="project-avatar">
            <Icon name="terminal" size={15} />
          </span>
          <div>
            Backends & mobile apps
            <p className="muted" style={{ fontSize: 11, marginTop: 4 }}>
              Send trusted events through your backend using the HTTP API.
            </p>
          </div>
          <span>Scoped server credentials</span>
        </div>
      </div>
    </>
  );
}
