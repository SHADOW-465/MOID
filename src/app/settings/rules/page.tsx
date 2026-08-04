"use client";

import "../settings.css";

// Calculation rules — the conventions behind every number, owned by the GM.
//
// The point of this page is the WORKED EXAMPLE: each choice is computed against
// the live ledger both ways, so nobody has to take "9.73%" on faith or read
// rejection.ts to find out where it came from. Numbers here come from the same
// selectors the dashboard uses — never from a formula retyped into the UI.

import { useEffect, useMemo, useState } from "react";
import AppShell from "@/components/app/AppShell";
import Icon from "@/components/editorial/Icon";
import { useEvents } from "@/components/app/EventsContext";
import { useRegistry } from "@/components/app/RegistryContext";
import { usePersona } from "@/components/app/PersonaContext";
import { useTweaks } from "@/components/editorial/TweaksContext";
import { resolveScope, rejectionRate, totalChecked, totalRejected, fpy, copq } from "@/lib/analytics";
import type { CalculationPolicyT, PolicyVersion } from "@/core/policy/policy";

type RuleKey = keyof CalculationPolicyT;

interface Choice {
  value: string;
  label: string;
  /** Why a plant would pick this. Plain language, no variable names. */
  hint: string;
}

interface RuleCard {
  key: RuleKey;
  code: string;
  question: string;
  why: string;
  choices?: Choice[];
  /** Numeric rules render an input instead of radios. */
  numeric?: { min: number; max: number; step: number; suffix: string };
  affects: string;
}

const CARDS: RuleCard[] = [
  {
    key: "headlineRejection",
    code: "A1",
    question: "When we say the plant's rejection rate, what do we mean?",
    why:
      "These two legitimately disagree — they are different questions, not a right and a wrong answer. Adding the gates measures funnel loss; dividing measures what share of everything that entered was scrapped.",
    choices: [
      {
        value: "sum-of-stage-rates",
        label: "Add up each gate's own rate",
        hint: "Visual% + Balloon% + Valve% + Final%. Matches your REJECTION ANALYSIS / YEARLY sheets.",
      },
      {
        value: "pooled",
        label: "Total rejected ÷ units that entered",
        hint: "One fraction over the whole line. Lower than the sum, because later gates see fewer units.",
      },
    ],
    affects: "Dashboard KPI, trends, stage analysis, every report, target and alert status",
  },
  {
    key: "checkedMeasuredAt",
    code: "A2",
    question: "Where do we count the units that were checked?",
    why:
      "Your gates are sequential — the units Visual accepts are the units Balloon then checks. Adding every gate's checked count would count one catheter up to four times.",
    choices: [
      {
        value: "most-upstream",
        label: "Once, at the first gate in view",
        hint: "The units that entered the line. Correct when gates run one after another, as they do here.",
      },
      {
        value: "sum-of-gates",
        label: "Add every gate's checked count",
        hint: "Only correct if your gates inspect different units. On a sequential line this double-counts.",
      },
    ],
    affects: "Checked on every screen, and the denominator of pooled rates",
  },
  {
    key: "reworkCountsAs",
    code: "A3",
    question: "How do we treat units held for rework at a gate?",
    why:
      "Held units are pulled out of the flow. Whether they count as 'checked' depends on whether your plant re-inspects them at the same gate.",
    choices: [
      {
        value: "excluded",
        label: "Not counted as checked",
        hint: "They were removed, not passed through. Held units stay in their own bucket.",
      },
      {
        value: "checked",
        label: "Counted as checked",
        hint: "Use when held units are re-inspected and dispositioned at the same gate.",
      },
    ],
    affects: "Checked, every rejection rate, mass balance",
  },
  {
    key: "defaultSections",
    code: "B1",
    question: "Which parts of the floor are in view before anyone filters?",
    why:
      "Your own reports mean Assembly when they say 'rejection %'. Including Primary and Secondary by default would change every headline number without anyone asking for it.",
    choices: [
      { value: "assembly", label: "Assembly only", hint: "P15–P27. What your reports mean today." },
      { value: "primary,secondary,assembly", label: "The whole plant", hint: "All three sections together." },
      { value: "secondary,assembly", label: "Secondary + Assembly", hint: "From P10 onward." },
    ],
    affects: "The starting scope of every screen",
  },
  {
    key: "targetRejectionPct",
    code: "D1",
    question: "What is the plant's target rejection rate?",
    why: "The line on the trend charts, and the threshold that turns status red.",
    numeric: { min: 0, max: 100, step: 0.1, suffix: "%" },
    affects: "Target lines, at-risk status, savings opportunity",
  },
  {
    key: "watchRejectionPct",
    code: "D2",
    question: "At what rate should we start watching, before it hits target?",
    why: "The amber band. Should be below the target.",
    numeric: { min: 0, max: 100, step: 0.1, suffix: "%" },
    affects: "Watch status, alerts",
  },
  {
    key: "unitCostInr",
    code: "E1",
    question: "What does one finished unit cost?",
    why: "The basis for Cost of Poor Quality. Was previously stored per-browser, so different laptops showed different COPQ.",
    numeric: { min: 0, max: 100000, step: 0.5, suffix: "₹" },
    affects: "COPQ, savings opportunity, cost of rejection",
  },
];

function sectionsToValue(v: string[]): string {
  return [...v].sort().join(",");
}
function valueToSections(v: string): CalculationPolicyT["defaultSections"] {
  return v.split(",") as CalculationPolicyT["defaultSections"];
}

export default function RulesPage() {
  const { events } = useEvents();
  const { registry, policy: savedPolicy, refreshRegistry } = useRegistry();
  const { canConfigure } = usePersona();
  const { t } = useTweaks();

  const [draft, setDraft] = useState<CalculationPolicyT>(savedPolicy);
  const [note, setNote] = useState("");
  const [history, setHistory] = useState<PolicyVersion[]>([]);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Saved policy arrives after the schema fetch resolves.
  useEffect(() => setDraft(savedPolicy), [savedPolicy]);

  useEffect(() => {
    fetch("/api/policy")
      .then((r) => r.json())
      .then((d) => setHistory(d.history ?? []))
      .catch(() => setHistory([]));
  }, []);

  const dirty = useMemo(
    () => JSON.stringify(draft) !== JSON.stringify(savedPolicy),
    [draft, savedPolicy],
  );

  /** Run the real selectors under an arbitrary policy — this is what makes the
   *  preview trustworthy instead of a retyped formula. */
  const evaluate = useMemo(() => {
    const ev = events ?? [];
    return (p: CalculationPolicyT) => {
      const scope = resolveScope(ev, t, p);
      return {
        rejection: rejectionRate(ev, scope, registry ?? undefined).value,
        checked: totalChecked(ev, scope, registry ?? undefined).value,
        rejected: totalRejected(ev, scope).value,
        fpy: fpy(ev, scope, registry ?? undefined).value,
        copq: copq(ev, scope)?.value ?? 0,
      };
    };
  }, [events, t, registry]);

  const before = useMemo(() => evaluate(savedPolicy), [evaluate, savedPolicy]);
  const after = useMemo(() => evaluate(draft), [evaluate, draft]);

  const set = <K extends RuleKey>(k: K, v: CalculationPolicyT[K]) =>
    setDraft((d) => ({ ...d, [k]: v }));

  async function save() {
    setSaving(true);
    setError(null);
    try {
      const res = await fetch("/api/policy", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ policy: draft, note, changedBy: "GM" }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Save failed");
      setNote("");
      setHistory((h) => [data, ...h]);
      await refreshRegistry();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Save failed");
    } finally {
      setSaving(false);
    }
  }

  const pct = (n: number) => `${(n * 100).toFixed(2)}%`;
  const qty = (n: number) => Math.round(n).toLocaleString();
  const inr = (n: number) => `₹${Math.round(n).toLocaleString()}`;

  const IMPACT: { label: string; b: string; a: string }[] = [
    { label: "Overall rejection", b: pct(before.rejection), a: pct(after.rejection) },
    { label: "Units checked", b: qty(before.checked), a: qty(after.checked) },
    { label: "Units rejected", b: qty(before.rejected), a: qty(after.rejected) },
    { label: "First pass yield", b: pct(before.fpy), a: pct(after.fpy) },
    { label: "COPQ", b: inr(before.copq), a: inr(after.copq) },
  ];

  return (
    <AppShell active="settings">
      <div className="settings-page">
        <header className="settings-head">
          <h1 className="h1">Calculation rules</h1>
          <p className="body muted">
            How this application turns your ledger into numbers. Every figure below is
            computed from your live data — change a rule to see exactly what moves,
            before you save it.
          </p>
        </header>

        {!canConfigure && (
          <div className="settings-card" style={{ borderColor: "var(--accent)" }}>
            <p className="body">
              You can review these rules, but only a General Manager may change them.
            </p>
          </div>
        )}

        {CARDS.map((card) => {
          const current = draft[card.key];
          return (
            <section key={card.key} className="settings-card" style={{ marginBottom: 16 }}>
              <div style={{ display: "flex", alignItems: "baseline", gap: 8 }}>
                <span
                  className="mono small muted"
                  style={{ fontFamily: "var(--font-mono)", fontSize: 11 }}
                >
                  {card.code}
                </span>
                <h2 className="h3" style={{ margin: 0 }}>{card.question}</h2>
              </div>
              <p className="small muted" style={{ marginTop: 6 }}>{card.why}</p>

              {card.choices && (
                <div style={{ display: "flex", flexDirection: "column", gap: 8, marginTop: 12 }}>
                  {card.choices.map((c) => {
                    const selected =
                      card.key === "defaultSections"
                        ? sectionsToValue(draft.defaultSections) === c.value
                        : current === c.value;
                    return (
                      <label
                        key={c.value}
                        style={{
                          display: "flex",
                          gap: 10,
                          padding: "10px 12px",
                          borderRadius: 8,
                          cursor: canConfigure ? "pointer" : "not-allowed",
                          border: `1px solid ${selected ? "var(--accent)" : "var(--border)"}`,
                          background: selected
                            ? "color-mix(in srgb, var(--accent) 7%, transparent)"
                            : "transparent",
                        }}
                      >
                        <input
                          type="radio"
                          name={card.key}
                          checked={selected}
                          disabled={!canConfigure}
                          onChange={() =>
                            card.key === "defaultSections"
                              ? set("defaultSections", valueToSections(c.value))
                              : set(card.key, c.value as never)
                          }
                        />
                        <span>
                          <span className="body" style={{ fontWeight: 600 }}>{c.label}</span>
                          <br />
                          <span className="small muted">{c.hint}</span>
                        </span>
                      </label>
                    );
                  })}
                </div>
              )}

              {card.numeric && (
                <div style={{ marginTop: 12, display: "flex", alignItems: "center", gap: 8 }}>
                  <input
                    type="number"
                    className="settings-input"
                    disabled={!canConfigure}
                    min={card.numeric.min}
                    max={card.numeric.max}
                    step={card.numeric.step}
                    value={String(current)}
                    onChange={(e) => set(card.key, Number(e.target.value) as never)}
                    style={{ width: 140, fontFamily: "var(--font-mono)" }}
                  />
                  <span className="small muted">{card.numeric.suffix}</span>
                </div>
              )}

              <p className="small muted" style={{ marginTop: 10 }}>
                <Icon name="dot" /> Affects: {card.affects}
              </p>
            </section>
          );
        })}

        {/* E2 — per-gate cost weights. Rendered from the live catalog so a gate
            added on Data Schema gets a row without a code change. */}
        <section className="settings-card" style={{ marginBottom: 16 }}>
          <div style={{ display: "flex", alignItems: "baseline", gap: 8 }}>
            <span className="mono small muted" style={{ fontFamily: "var(--font-mono)", fontSize: 11 }}>
              E2
            </span>
            <h2 className="h3" style={{ margin: 0 }}>
              How much of a unit&apos;s cost is already sunk at each gate?
            </h2>
          </div>
          <p className="small muted" style={{ marginTop: 6 }}>
            A unit scrapped at Final has absorbed more work than one scrapped at Visual.
            1.00 means the full unit cost is lost.
          </p>
          <div style={{ display: "flex", flexWrap: "wrap", gap: 10, marginTop: 12 }}>
            {(registry?.stages ?? []).map((s: { stageId: string; label?: string }) => (
              <label key={s.stageId} style={{ display: "flex", flexDirection: "column", gap: 4 }}>
                <span className="small muted">{s.label ?? s.stageId}</span>
                <input
                  type="number"
                  className="settings-input"
                  disabled={!canConfigure}
                  min={0}
                  max={1}
                  step={0.05}
                  value={String(draft.stageCostWeights[s.stageId] ?? 0.6)}
                  onChange={(e) =>
                    set("stageCostWeights", {
                      ...draft.stageCostWeights,
                      [s.stageId]: Number(e.target.value),
                    })
                  }
                  style={{ width: 90, fontFamily: "var(--font-mono)" }}
                />
              </label>
            ))}
          </div>
          <p className="small muted" style={{ marginTop: 10 }}>
            <Icon name="dot" /> Affects: COPQ split by stage, cost of rejection
          </p>
        </section>

        {/* Impact preview — the selectors run twice, nothing is estimated. */}
        <section className="settings-card" style={{ position: "sticky", bottom: 16 }}>
          <h2 className="h3" style={{ marginTop: 0 }}>
            {dirty ? "What this change does to today's numbers" : "Today's numbers"}
          </h2>
          <table className="settings-table" style={{ width: "100%", fontFamily: "var(--font-mono)" }}>
            <thead>
              <tr>
                <th style={{ textAlign: "left" }}>Metric</th>
                <th style={{ textAlign: "right" }}>Now</th>
                {dirty && <th style={{ textAlign: "right" }}>After</th>}
              </tr>
            </thead>
            <tbody>
              {IMPACT.map((r) => (
                <tr key={r.label}>
                  <td className="muted">{r.label}</td>
                  <td style={{ textAlign: "right" }}>{r.b}</td>
                  {dirty && (
                    <td
                      style={{
                        textAlign: "right",
                        color: r.a === r.b ? "var(--text-3)" : "var(--accent)",
                        fontWeight: r.a === r.b ? 400 : 700,
                      }}
                    >
                      {r.a}
                    </td>
                  )}
                </tr>
              ))}
            </tbody>
          </table>

          {dirty && (
            <div style={{ marginTop: 14 }}>
              <label className="small muted" htmlFor="policy-note">
                Why are you changing this? (saved to the audit trail)
              </label>
              <input
                id="policy-note"
                className="settings-input"
                value={note}
                placeholder="e.g. Aligning with the FY26 quality plan"
                onChange={(e) => setNote(e.target.value)}
                style={{ width: "100%", marginTop: 6 }}
              />
              {error && (
                <p className="small" style={{ color: "var(--accent)" }}>{error}</p>
              )}
              <div style={{ display: "flex", gap: 8, marginTop: 10 }}>
                <button
                  className="settings-btn primary"
                  disabled={!canConfigure || saving || note.trim().length === 0}
                  onClick={save}
                >
                  {saving ? "Saving…" : "Save rules"}
                </button>
                <button className="settings-btn" onClick={() => setDraft(savedPolicy)}>
                  Discard
                </button>
              </div>
            </div>
          )}
        </section>

        <section className="settings-card">
          <h2 className="h3" style={{ marginTop: 0 }}>History</h2>
          {history.length === 0 ? (
            <p className="small muted">
              No changes yet — the app is using its shipped defaults.
            </p>
          ) : (
            <ul style={{ listStyle: "none", padding: 0, margin: 0 }}>
              {history.map((h) => (
                <li key={h.version} style={{ padding: "8px 0", borderBottom: "1px solid var(--border)" }}>
                  <span className="small" style={{ fontFamily: "var(--font-mono)" }}>
                    v{h.version}
                  </span>{" "}
                  <span className="small muted">
                    {h.changedAt ? new Date(h.changedAt).toLocaleString() : ""} · {h.changedBy}
                  </span>
                  <br />
                  <span className="small">{h.note}</span>{" "}
                  {canConfigure && (
                    <button
                      className="settings-btn"
                      style={{ marginLeft: 6, padding: "2px 8px", fontSize: 11 }}
                      onClick={() => setDraft(h.policy)}
                    >
                      Restore
                    </button>
                  )}
                </li>
              ))}
            </ul>
          )}
        </section>

        <section className="settings-card">
          <h2 className="h3" style={{ marginTop: 0 }}>Fixed by design</h2>
          <p className="small muted">
            The ledger is append-only — changing a rule never rewrites history, it only
            changes how the same records are read, so any change here is reversible.
            Corrections supersede values rather than overwriting them, and every number
            on every screen is computed in code, never by the AI.
          </p>
        </section>
      </div>
    </AppShell>
  );
}
