"use client";

import { useState } from "react";
import type { Assessment, FactorKey } from "@/lib/types";
import { api, Bar } from "@/components/dashboard/shared";

const factorGuide: { key: FactorKey; label: string; max: string; description: string }[] = [
  { key: "want_level", label: "Want or need", max: "25", description: "How necessary the item looks, including your answer if we ask." },
  { key: "history", label: "Past outcomes", max: "20", description: "How you felt about similar purchases before. This is skipped when there is too little history." },
  { key: "duplicate", label: "Similar purchases", max: "15", description: "Whether you already bought something similar." },
  { key: "pressure", label: "Sales pressure", max: "10", description: "Checkout cues such as scarcity, countdowns or a sale." },
  { key: "timing", label: "Timing", max: "10", description: "Patterns such as a late-night checkout or a risky shopping window." },
  { key: "money_strain", label: "Money impact", max: "15", description: "The effect on your available money and category limit." },
  { key: "reason", label: "Your reason", max: "up to −30", description: "A relevant explanation can lower the risk estimate." },
];

const labelFor = (key: FactorKey) => factorGuide.find(factor => factor.key === key)?.label ?? key.replaceAll("_", " ");

export function FactorGuide() {
  return <section className="border border-[var(--color-border)] bg-[var(--color-surface)] p-5 shadow-[var(--shadow-card)]" style={{ borderRadius: "var(--radius-lg)" }}>
    <h2 className="text-xl font-bold">What affects regret risk?</h2>
    <p className="mt-2 text-sm text-[var(--color-text-muted)]">Each checkout is scored from the factors below. Points and evidence vary by item; the basket score also reflects item prices and your past feedback.</p>
    <div className="mt-5 grid gap-3 sm:grid-cols-2">
      {factorGuide.map(factor => <div key={factor.key} className="border border-[var(--color-border)] bg-[var(--color-surface-2)] p-3" style={{ borderRadius: "var(--radius-md)" }}>
        <div className="flex items-start justify-between gap-3 text-sm"><strong>{factor.label}</strong><span className="shrink-0 font-semibold text-[var(--color-accent)]">{factor.max} pts</span></div>
        <p className="mt-1 text-xs leading-relaxed text-[var(--color-text-muted)]">{factor.description}</p>
      </div>)}
    </div>
    <p className="mt-3 text-xs text-[var(--color-text-muted)]">These are factor limits, not points assigned to every checkout. Risk is an estimate, not a certainty.</p>
  </section>;
}

export function AssessmentFactors({ id }: { id: string }) {
  const [open, setOpen] = useState(false);
  const [assessment, setAssessment] = useState<Assessment | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  async function toggle() {
    if (open) { setOpen(false); return; }
    setOpen(true);
    if (assessment) return;
    setLoading(true);
    try { setAssessment(await api<Assessment>(`assessments/${encodeURIComponent(id)}`)); setError(""); }
    catch (cause) { setError(cause instanceof Error && cause.message.startsWith("Unknown assessment:") ? "Detailed factors are not available for this older checkout." : "Could not load factor details. Try again."); }
    finally { setLoading(false); }
  }

  return <div className="mt-3 border-t border-[var(--color-border)] pt-3">
    <button type="button" onClick={() => void toggle()} aria-expanded={open} className="text-left text-sm font-semibold text-[var(--color-accent)] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--color-accent)]">{open ? "Hide factor points" : "See factor points"}</button>
    {open && <div className="mt-3" aria-live="polite">
      {loading && <p className="text-sm text-[var(--color-text-muted)]">Loading factors…</p>}
      {error && <p className="text-sm text-[var(--color-text-muted)]">{error}</p>}
      {assessment && <div className="space-y-4">
        <p className="text-xs text-[var(--color-text-muted)]">{assessment.regretRisk}% basket risk · item scores are combined by price and adjusted for your feedback.</p>
        {assessment.items.map(item => <div key={item.index} className="border border-[var(--color-border)] p-3" style={{ borderRadius: "var(--radius-md)" }}>
          <div className="flex justify-between gap-3 text-sm"><strong>{item.name}</strong><span className="shrink-0 font-semibold">{item.regretRisk}% risk</span></div>
          {item.factors.length ? <div className="mt-3 space-y-3">{item.factors.map((factor, index) => <div key={`${factor.key}-${index}`}>
            <div className="flex justify-between gap-3 text-xs"><span className="font-semibold">{labelFor(factor.key)}</span><span>{factor.points > 0 ? "+" : ""}{factor.points} / {factor.max}</span></div>
            {factor.points >= 0 && factor.max > 0 && <div className="mt-1"><Bar value={factor.points} max={factor.max} tone="think" /></div>}
            <p className="mt-1 text-xs text-[var(--color-text-muted)]">{factor.text}</p>
            {factor.evidence && <p className="mt-1 text-xs text-[var(--color-text-muted)]">Evidence: {factor.evidence}</p>}
          </div>)}</div> : <p className="mt-2 text-xs text-[var(--color-text-muted)]">No item factors recorded.</p>}
          {item.limitedHistory && <p className="mt-2 text-xs text-[var(--color-text-muted)]">Limited purchase history; no past-outcomes points applied.</p>}
        </div>)}
      </div>}
    </div>}
  </div>;
}
