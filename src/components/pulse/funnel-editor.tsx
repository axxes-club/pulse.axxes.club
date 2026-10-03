"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { Icon } from "./icon";
export function FunnelEditor({
  siteId,
  eventNames,
  demo = false,
}: {
  siteId?: string;
  eventNames: string[];
  demo?: boolean;
}) {
  const [name, setName] = useState("Signup journey"),
    [steps, setSteps] = useState(["pageview", "signup"]),
    [windowMs, setWindowMs] = useState(1800000),
    [error, setError] = useState(""),
    [pending, setPending] = useState(false);
  const router = useRouter();
  async function save() {
    if (demo) {
      setError("Sign in and connect your app to save this funnel.");
      return;
    }
    setPending(true);
    try {
      const r = await fetch(`/api/pulse/sites/${siteId}/funnels`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name, steps, windowMs }),
      });
      const data = await r.json();
      if (!r.ok) throw new Error(data.error || "Could not save funnel");
      router.refresh();
      setError("Funnel saved.");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not save");
    } finally {
      setPending(false);
    }
  }
  return (
    <details className="feature-card" style={{ marginBottom: 20 }}>
      <summary style={{ cursor: "pointer", fontSize: 14 }}>
        Build a funnel from your events
      </summary>
      <div className="integration-form">
        <label>
          Funnel name
          <input value={name} onChange={(e) => setName(e.target.value)} />
        </label>
        <label>
          Completion window
          <select
            value={windowMs}
            onChange={(e) => setWindowMs(Number(e.target.value))}
          >
            <option value={600000}>10 minutes</option>
            <option value={1800000}>30 minutes</option>
            <option value={3600000}>1 hour</option>
          </select>
        </label>
      </div>
      <div className="integration-form">
        {steps.map((step, i) => (
          <label key={i}>
            Step {i + 1}
            <select
              value={step}
              onChange={(e) =>
                setSteps(steps.map((s, j) => (j === i ? e.target.value : s)))
              }
            >
              {[...new Set(["pageview", "signup", ...eventNames])].map((s) => (
                <option key={s}>{s}</option>
              ))}
            </select>
          </label>
        ))}
      </div>
      <div style={{ display: "flex", gap: 10 }}>
        <button
          className="button secondary small"
          disabled={steps.length >= 8}
          onClick={() => setSteps([...steps, "signup"])}
        >
          <Icon name="plus" size={14} />
          Add step
        </button>
        <button
          className="button primary small"
          onClick={save}
          disabled={pending}
        >
          {pending ? "Saving…" : "Save funnel"}
        </button>
      </div>
      {error && (
        <p
          role="status"
          className="muted"
          style={{ fontSize: 12, marginTop: 15 }}
        >
          {error}
        </p>
      )}
    </details>
  );
}
