"use client";

import { useState } from "react";
import type { Assessment, FactorKey, Purchase } from "@/lib/types";
import { api, Bar } from "@/components/dashboard/shared";

const factorLabels: Record<FactorKey, string> = {
  want_level: "Want or need",
  history: "Past outcomes",
  duplicate: "Similar purchases",
  pressure: "Sales pressure",
  timing: "Timing",
  money_strain: "Money impact",
  reason: "Your reason",
};

const labelFor = (key: FactorKey) => factorLabels[key];

export function AssessmentFactors({ id, score, itemName, fallbackPurchase }: { id: string; score: number; itemName?: string; fallbackPurchase?: Purchase }) {
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

  const items = itemName && assessment ? assessment.items.filter(item => item.name.toLocaleLowerCase() === itemName.toLocaleLowerCase()) : assessment?.items;
  const purchaseHour = fallbackPurchase ? Number(new Intl.DateTimeFormat("en-GB", { timeZone: "Europe/London", hour: "numeric", hourCycle: "h23" }).format(new Date(fallbackPurchase.purchasedAt))) : null;
  const purchaseSignals = fallbackPurchase ? [
    fallbackPurchase.essential ? "Marked as essential" : "Marked as non-essential",
    ...fallbackPurchase.cues.map(cue => `Sales cue: ${cue.replaceAll("_", " ")}`),
    ...(purchaseHour !== null && (purchaseHour >= 23 || purchaseHour < 4) ? ["Late-night purchase"] : []),
  ] : [];
  return <div className="mt-3 border-t border-[var(--color-border)] pt-3">
    <button type="button" onClick={() => void toggle()} aria-expanded={open} aria-label={`${open ? "Hide" : "Show"} factor breakdown for ${itemName ?? "checkout"}, ${score}% regret risk`} className={`inline-flex min-h-10 items-center px-3 py-1 text-left text-sm font-semibold focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--color-accent)] ${score >= 70 ? "bg-[var(--color-stop-bg)] text-[var(--color-stop)]" : score >= 40 ? "bg-[var(--color-think-bg)] text-[var(--color-think)]" : "bg-[var(--color-go-bg)] text-[var(--color-go)]"}`} style={{ borderRadius: "var(--radius-sm)" }}>{score}% regret risk · {open ? "Hide breakdown" : "See breakdown"}</button>
    {open && <div className="mt-3" aria-live="polite">
      {loading && <p className="text-sm text-[var(--color-text-muted)]">Loading factors…</p>}
      {error && <div className="text-sm text-[var(--color-text-muted)]"><p>{error}</p>{purchaseSignals.length > 0 && <><p className="mt-2">Signals recorded for this item:</p><ul className="mt-1 list-inside list-disc space-y-1">{purchaseSignals.map(signal => <li key={signal}>{signal}</li>)}</ul><p className="mt-2 text-xs">These signals do not reconstruct the original score&apos;s point allocation.</p></>}</div>}
      {assessment && <div className="space-y-4">
        {!itemName && <p className="text-xs text-[var(--color-text-muted)]">Basket risk combines item scores by price and adjusts for your feedback.</p>}
        {items?.length === 0 && <p className="text-sm text-[var(--color-text-muted)]">This purchase was not found in the checkout assessment.</p>}
        {items?.map(item => <div key={item.index} className="border border-[var(--color-border)] p-3" style={{ borderRadius: "var(--radius-md)" }}>
          <div className="flex justify-between gap-3 text-sm"><strong>{item.name}</strong><span className="shrink-0 font-semibold">{item.regretRisk}% risk</span></div>
          {item.factors.length ? <div className="mt-3 space-y-3">{item.factors.map((factor, index) => <div key={`${factor.key}-${index}`}>
            <div className="flex justify-between gap-3 text-xs"><span className="font-semibold">{labelFor(factor.key)}</span><span>{factor.points > 0 ? "+" : ""}{factor.points} / {factor.max} pts</span></div>
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
