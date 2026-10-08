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
  const [catalog,setCatalog] = useState<Array<{key:string;name:string;url:string;nativeAvailable:boolean;connections:Array<{publicId:string;environment:string;lastEventAt:string|null}>}>>([]);
  const [existingApps,setExistingApps] = useState<Array<{publicId:string;name:string;platform:IntegrationPlatform;collection:string;environment:"production"|"development";allowedOrigins:string[];identityMode:"ephemeral"|"persistent"}>>([]);
  const [appsError,setAppsError] = useState("");
  useEffect(()=>{if(demo)return;fetch("/api/pulse/sites").then(async response=>{const data=await response.json();if(!response.ok)throw Error(data.error || "Apps unavailable");setExistingApps(data.sites)}).catch(error=>setAppsError(error.message));},[demo,organizationKey]);
  const [integrationKey,setIntegrationKey] = useState("");
  const [catalogError,setCatalogError] = useState("");
  useEffect(()=>{if(demo)return;fetch("/api/pulse/catalog").then(async r=>{const data=await r.json();if(!r.ok)throw new Error(data.error || "Catalog unavailable");setCatalog(data.apps)}).catch(e=>setCatalogError(e.message));},[demo,organizationKey]);
  const [verificationToken, setVerificationToken] = useState("");
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
        if (saved.integrationKey) setIntegrationKey(saved.integrationKey);
        if (saved.identityMode === "persistent") setIdentityMode("persistent");
      }
    } catch {}
  }, [storageKey]);
  const nativeConnection = platform === "axxes" && environment === "production" && !!catalog.find(a=>a.key===integrationKey)?.nativeAvailable;
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
  if(verificationToken && !["node","http"].includes(platform)) recipe.code=recipe.code.replace("data-site=",`data-verify="${verificationToken}" data-site=`);
  function rememberSetup(serialized:string) { try { localStorage.setItem(storageKey,serialized); } catch {} }
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
          ...(platform === "axxes" ? {integrationKey} : {}),
        }),
      });
      const data = await response.json();
      if (!response.ok)
        throw new Error(data.error || "Could not create your app");
      setSiteId(data.publicId);
      setStatus("waiting");
      rememberSetup(
        JSON.stringify({
          name,
          origin,
          platform,
          environment,
          siteId: data.publicId,
          identityMode,
          ...(platform === "axxes" ? {integrationKey} : {}),
        }),
      );

      const verificationResponse = await fetch(
        `/api/pulse/sites/${data.publicId}/verify`,
        { method: "POST" },
      );
      const verification = await verificationResponse.json();
      if (!verificationResponse.ok)
        throw new Error(verification.error || "Could not start verification");
      setVerificationToken(verification.token);
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
  async function recoverCredential() {
    if(demo || siteId === "YOUR_PUBLIC_APP_ID") return;
    setPending(true);setError("");
    try {const response=await fetch(`/api/pulse/sites/${siteId}/credentials`,{method:"POST"});const result=await response.json();if(!response.ok)throw Error(result.error || "Could not issue server credential");setServerKey(result.credential);}
    catch(error){setError(error instanceof Error?error.message:"Could not issue server credential");}
    finally{setPending(false);}
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
      if(nativeConnection){const r=await fetch(`/api/pulse/sites/${siteId}/verify`);const result=await r.json();if(!r.ok)throw new Error(result.error||"Connection unavailable");setStatus(result.connected?"connected":"waiting");setError(result.connected?"":"Open the AXXES app in this organization or complete an action, then check again.");return;}
      if (!verificationToken) {
        const r = await fetch(`/api/pulse/sites/${siteId}/verify`, {
          method: "POST",
        });
        const challenge = await r.json();
        if (!r.ok)
          throw new Error(challenge.error || "Could not start verification");
        setVerificationToken(challenge.token);
        setError("Run the test event below in your app, then check again.");
        return;
      }
      const r = await fetch(
        `/api/pulse/sites/${siteId}/verify?token=${verificationToken}`,
      );
      const data = await r.json();
      if (!r.ok) throw new Error(data.error || "Verification unavailable");
      if(data.expired){setVerificationToken("");throw new Error("Your test token expired. Check again to get a new test event.");}
      setStatus(data.connected ? "connected" : "waiting");
      setError(
        data.connected
          ? ""
          : "No matching test event yet. Run the test call in your app, then check again. Check your app ID, allowed origin, and consent settings.",
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
        {siteId !== "YOUR_PUBLIC_APP_ID" && <button className="button secondary small" onClick={()=>{setSiteId("YOUR_PUBLIC_APP_ID");setVerificationToken("");setServerKey("");setStatus("waiting");setError("");setName("");setOrigin("");localStorage.removeItem(storageKey)}}>Connect another app</button>}
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
            disabled={!demo && siteId !== "YOUR_PUBLIC_APP_ID"}
            aria-pressed={platform === p.id}
          >
            <span className="platform-symbol">{p.symbol}</span>
            <strong>{p.name}</strong>
            <small>{p.description}</small>
            {platform === p.id && <Icon name="check" size={15} />}
          </button>
        ))}
      </div>
      {platform === "axxes" && <div className="integration-form"><label>Choose an AXXES app<select aria-label="AXXES app" value={integrationKey} disabled={!demo && siteId !== "YOUR_PUBLIC_APP_ID"} onChange={e=>{setIntegrationKey(e.target.value);const app=catalog.find(a=>a.key===e.target.value);if(app){setName(app.name);setOrigin(app.url)}}}><option value="">{demo?"Sign in to load your AXXES apps":"Choose an app"}</option>{catalog.map(app=><option key={app.key} value={app.key}>{app.name}{app.connections.length?" · already tracked":""}</option>)}</select></label>{catalogError&&<p role="status">{catalogError}</p>}</div>}
      <div className="integration-form">
        <label>
          App name
          <input
            disabled={!demo && siteId !== "YOUR_PUBLIC_APP_ID"}
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
              disabled={!demo && siteId !== "YOUR_PUBLIC_APP_ID"}
              value={origin}
              onChange={(e) => setOrigin(e.target.value)}
              placeholder="https://your-app.com"
            />
          </label>
        )}
        <label>
          Environment
          <select
            aria-label="Environment"
            disabled={!demo && siteId !== "YOUR_PUBLIC_APP_ID"}
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
        disabled={pending || !name.trim() || siteId !== "YOUR_PUBLIC_APP_ID"}
      >
        Create app & get setup <Icon name="arrow" size={15} />
      </button>
      {!demo && siteId !== "YOUR_PUBLIC_APP_ID" && <div style={{display:"flex",gap:10,flexWrap:"wrap",marginTop:16}}>{["node","http"].includes(platform) && <button className="button secondary small" aria-label="Create server credential" disabled={pending} onClick={recoverCredential}>{serverKey?"Create another server credential":"Create server credential"}</button>}<Link className="button secondary small" href={`/dashboard/settings?site=${siteId}&environment=${environment}`}>Manage app settings & credentials</Link></div>}
      {serverKey && (
        <div className="installation-code" style={{ marginTop: 20 }}>
          <div className="installation-code-header">
            Server environment · shown once
            <button className="copy-button" onClick={async()=>{try{await navigator.clipboard.writeText(`PULSE_SERVER_KEY=${serverKey}`);setError("Server credential copied.");}catch{setError("Select and copy the server credential. Clipboard access is unavailable.");}}}>Copy credential</button>
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
              <h3>{nativeConnection?"Your AXXES connection is ready":"Add Pulse to your app"}</h3>
              <p>{nativeConnection?"No code needed. Open this AXXES app in the same organization. Available page tracking and committed actions flow into Pulse automatically.":recipe.instruction}</p>
            </div>
          </div>
          {nativeConnection?<a className="button primary" href={origin} target="_blank" rel="noopener noreferrer">Open {name} ↗</a>:<div className="installation-code">
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
          </div>}
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
            {nativeConnection?"Open the connected AXXES app, then check here for its first persisted event.":"Open your app after installing the code. Browser setup sends a test automatically. Backend apps send the test event below. Test events stay out of traffic reports."}
          </p>
          {verificationToken && !nativeConnection && (
            <div className="installation-code" style={{ marginBottom: 16 }}>
              <pre>
                <code>
                  {["node", "http"].includes(platform)
                    ? JSON.stringify(
                        {
                          name: "pulse.verify",
                          properties: { verification_token: verificationToken },
                        },
                        null,
                        2,
                      )
                    : `window.pulse.track('pulse.verify', { verification_token: '${verificationToken}' }); window.pulse.flush();`}
                </code>
              </pre>
              <p className="muted" style={{ padding: 12 }}>
                This test expires in 10 minutes. Backend apps send the event
                through the server API.
              </p>
            </div>
          )}
          <button
            className="button secondary"
            onClick={verify}
            disabled={pending}
          >
            {pending ? "Checking…" : "Check connection"}
            <Icon name="arrow" size={15} />
          </button>
          {status === "connected" && (
            <Link
              href={`/dashboard?site=${siteId}&environment=${environment}`}
              className="button primary"
            >
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
        {appsError && <p role="status">{appsError}</p>}
        {existingApps.filter(app=>app.platform!=="axxes").length>0 && <><h2>Your apps</h2>{existingApps.filter(app=>app.platform!=="axxes").map(app=><div className="connection-row" key={app.publicId}><div><strong>{app.name}</strong><p className="muted">{app.environment} · {app.platform}</p></div><button className="button secondary small" aria-label={`Set up ${app.name} · ${app.environment}`} onClick={()=>{setPlatform(app.platform);setIntegrationKey("");setName(app.name);setOrigin(app.allowedOrigins[0] || "");setEnvironment(app.environment);setIdentityMode(app.identityMode);setSiteId(app.publicId);setVerificationToken("");setServerKey("");setStatus("waiting");setError("");rememberSetup(JSON.stringify({name:app.name,origin:app.allowedOrigins[0] || "",platform:app.platform,environment:app.environment,siteId:app.publicId,identityMode:app.identityMode}));window.scrollTo({top:0,behavior:"smooth"})}}>Set up</button></div>)}</>}
        {catalog.length>0 && <><h2>Your AXXES apps</h2>{catalog.filter(app=>["suite","handshake","pay","store","vibez","relay","lanes","folders","office","members","tollbooth"].includes(app.key)||app.connections.length).map(app=><div className="connection-row" key={app.key}><div><strong>{app.name}</strong><p className="muted">{app.connections.some(c=>c.lastEventAt)?"Traffic verified":app.connections.length?"Setup created · waiting for events":"Ready to connect"}</p></div><button className="button secondary small" onClick={()=>{setServerKey("");setError("");setPlatform("axxes");setIntegrationKey(app.key);setName(app.name);setOrigin(app.url);const existing=app.connections.find(c=>c.environment===environment);setSiteId(existing?.publicId || "YOUR_PUBLIC_APP_ID");setVerificationToken("");setStatus(existing?.lastEventAt?"connected":"waiting");window.scrollTo({top:0,behavior:"smooth"})}}>Set up</button></div>)}</>}

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
