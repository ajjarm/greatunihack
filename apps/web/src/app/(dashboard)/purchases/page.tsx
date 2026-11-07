"use client";

import { useEffect, useState } from "react";
import { CATEGORIES, CATEGORY_LABELS, type Category, type Feedback, type Purchase } from "@/lib/types";
import { api, Card, Chip, Button, Label, PageState, date, dayKey, money, useApi } from "@/components/dashboard/shared";
import { AssessmentFactors } from "@/components/dashboard/factors";
import { ScoreInfo } from "@/components/dashboard/score-info";

const SCORE_STORAGE_KEY = "greatunihack-purchase-score-adjustments";

export default function PurchasesPage() {
  const { data, setData, error, loading, reload } = useApi<Purchase[]>("purchases");
  const pending = useApi<Purchase[]>("pending-reflections");
  const [category, setCategory] = useState<Category | "all">("all");
  const [feedback, setFeedback] = useState<Feedback | "all" | "unrated">("all");
  const [reason, setReason] = useState<Record<string, string>>({});
  const [busy, setBusy] = useState<string | null>(null);
  const [actionError, setActionError] = useState("");
  const [scoreOverrides, setScoreOverrides] = useState<Record<string, number>>({});
  const [scoreDrafts, setScoreDrafts] = useState<Record<string, string>>({});
  useEffect(() => {
    try {
      const stored = JSON.parse(localStorage.getItem(SCORE_STORAGE_KEY) ?? "{}");
      if (stored && typeof stored === "object" && !Array.isArray(stored)) {
        setScoreOverrides(Object.fromEntries(Object.entries(stored).filter((entry): entry is [string, number] => typeof entry[1] === "number" && Number.isInteger(entry[1]) && entry[1] >= 0 && entry[1] <= 100)));
      }
    } catch { /* Browser storage is optional. */ }
  }, []);
  function saveScore(purchase: Purchase) {
    const draft = scoreDrafts[purchase.id];
    if (draft === undefined) return;
    const parsed = Number(draft);
    if (draft.trim() !== "" && (!Number.isInteger(parsed) || parsed < 0 || parsed > 100)) {
      setActionError("Enter a whole-number regret score from 0 to 100.");
      return;
    }
    const next = { ...scoreOverrides };
    if (draft.trim() === "") delete next[purchase.id];
    else next[purchase.id] = parsed;
    setScoreOverrides(next);
    setScoreDrafts(current => { const updated = { ...current }; delete updated[purchase.id]; return updated; });
    setActionError("");
    try { localStorage.setItem(SCORE_STORAGE_KEY, JSON.stringify(next)); } catch { /* Keep the edit for this page session. */ }
  }
  async function rate(purchase: Purchase, answer: Feedback) {
    setBusy(purchase.id); setActionError("");
    try {
      const result = await api<{ purchase: Purchase }>(`purchases/${encodeURIComponent(purchase.id)}/feedback`, { method: "PATCH", body: JSON.stringify({ feedback: answer, ...(reason[purchase.id]?.trim() ? { reason: reason[purchase.id].trim() } : {}) }) });
      setData(items => items?.map(p => p.id === purchase.id ? result.purchase : p) ?? null);
    } catch (e) { setActionError(e instanceof Error ? e.message : "Could not save feedback"); }
    finally { setBusy(null); }
  }
  if (!data || !pending.data) return <PageState loading={loading || pending.loading} error={error || pending.error} retry={() => { void reload(); void pending.reload(); }} />;
  const pendingIds = new Set(pending.data.map(item => item.id));
  const filtered = data.filter(p => (category === "all" || p.category === category) && (feedback === "all" || (feedback === "unrated" ? p.feedback === null : p.feedback === feedback)));
  const dueItems = filtered.filter(p => !p.feedback && pendingIds.has(p.id));
  const groups = filtered.reduce<Record<string, Purchase[]>>((result, purchase) => {
    const day = dayKey(purchase.purchasedAt);
    (result[day] ??= []).push(purchase);
    return result;
  }, {});
  return <div className="space-y-5"><header><Label>Your history</Label><h1 className="mt-1 text-3xl font-bold">Purchases</h1><p className="mt-2 text-sm text-[var(--color-text-muted)]">A quick check-in helps your predictions learn.</p></header>
    {dueItems.length > 0 && <Card className="bg-[var(--color-accent-bg)]"><Label>Ready for a check-in</Label><p className="mt-1 text-sm text-[var(--color-text-muted)]">Choose a purchase to jump to its reflection.</p><div className="mt-3 flex flex-wrap gap-2">{dueItems.map(p => <a key={p.id} href={`#purchase-${p.id}`} className="inline-flex min-h-11 items-center bg-[var(--color-surface)] px-3 text-sm font-semibold text-[var(--color-accent)] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--color-accent)]" style={{ borderRadius: "var(--radius-sm)" }}>{p.item} →</a>)}</div></Card>}
    <div className="grid grid-cols-2 gap-3"><label className="text-xs font-semibold text-[var(--color-text-muted)]">Category<select value={category} onChange={e => setCategory(e.target.value as Category | "all")} className="mt-1 block min-h-11 w-full border border-[var(--color-border)] bg-[var(--color-surface)] px-3 text-sm text-[var(--color-text)]" style={{ borderRadius: "var(--radius-sm)" }}><option value="all">All categories</option>{CATEGORIES.map(c => <option key={c} value={c}>{CATEGORY_LABELS[c]}</option>)}</select></label><label className="text-xs font-semibold text-[var(--color-text-muted)]">Feedback<select value={feedback} onChange={e => setFeedback(e.target.value as Feedback | "all" | "unrated")} className="mt-1 block min-h-11 w-full border border-[var(--color-border)] bg-[var(--color-surface)] px-3 text-sm text-[var(--color-text)]" style={{ borderRadius: "var(--radius-sm)" }}><option value="all">All feedback</option><option value="unrated">Not rated</option><option value="happy">Happy</option><option value="regretted">Regretted</option><option value="unsure">Unsure</option></select></label></div>
    {actionError && <p role="alert" className="text-sm text-[var(--color-stop)]">{actionError}</p>}
    {Object.entries(groups).map(([day, items]) => <section key={day}><h2 className="mb-3 text-sm font-semibold text-[var(--color-text-muted)]">{date(`${day}T12:00:00Z`)}</h2><div className="space-y-3">{items?.map(p => {
      const due = !p.feedback && pendingIds.has(p.id);
      return <Card key={p.id} id={`purchase-${p.id}`}>
        {due && <p className="mb-4 border-b border-[var(--color-border)] pb-3 text-sm font-semibold text-[var(--color-accent)]">How do you feel about this now?</p>}
        <div className="flex justify-between gap-3"><div className="min-w-0"><p className="font-semibold">{p.merchant}</p><p className="text-sm text-[var(--color-text-muted)]">{p.item}</p></div><p className="shrink-0 font-bold">{money(p.amountPence)}</p></div>
        <div className="mt-3 flex flex-wrap items-center gap-2"><Chip>{CATEGORY_LABELS[p.category]}</Chip>{p.feedback && <Chip tone={p.feedback === "happy" ? "go" : p.feedback === "regretted" ? "stop" : "neutral"}>{p.feedback}</Chip>}</div>
        {p.predictedRegret !== undefined && p.assessmentId && <AssessmentFactors id={p.assessmentId} score={p.predictedRegret} itemName={p.item} fallbackPurchase={p} />}
        <div className="mt-4 border-t border-[var(--color-border)] pt-4">
          <p className="text-sm font-semibold">{p.feedback ? "Update your feedback" : due ? "Your check-in" : "How did it turn out?"}</p>
          <label className="mt-3 block text-xs font-semibold text-[var(--color-text-muted)]">Predicted regret score (editable)
            <span className="mt-1 flex items-center gap-2"><input type="number" min={0} max={100} step={1} inputMode="numeric" aria-label={`Predicted regret score for ${p.item}`} title="Predicted regret risk from 0 to 100. Hover over the regret risk badge above for the original factor breakdown. Your edit is saved only in this browser." value={scoreDrafts[p.id] ?? scoreOverrides[p.id] ?? p.predictedRegret ?? ""} onChange={e => setScoreDrafts(current => ({ ...current, [p.id]: e.target.value }))} onBlur={() => saveScore(p)} onKeyDown={e => { if (e.key === "Enter") e.currentTarget.blur(); }} className="min-h-11 w-24 border border-[var(--color-border)] bg-[var(--color-surface)] px-3 text-base text-[var(--color-text)] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--color-accent)]" style={{ borderRadius: "var(--radius-sm)" }} /><span className="text-sm">/ 100</span></span>
          </label>
          <ScoreInfo label={`Predicted regret score for ${p.item}`} className="mt-1 text-xs font-semibold text-[var(--color-accent)] underline" details={<><p>This is the agent&apos;s original 0–100 estimate of regret risk. The badge above shows its recorded factors, such as past outcomes, timing, sales pressure and money impact.</p><p>Your edited number is saved in this browser only and does not change the original assessment or calibration.</p></>}>What does this score mean?</ScoreInfo>
          <p className="mt-1 text-xs text-[var(--color-text-muted)]">Your adjustment is saved in this browser. It does not change the agent&apos;s original score or calibration.</p>
          <input aria-label={`Reason for ${p.item} feedback (optional)`} placeholder="Why? (optional)" value={reason[p.id] ?? ""} onChange={e => setReason({ ...reason, [p.id]: e.target.value })} className="mt-3 min-h-11 w-full border border-[var(--color-border)] bg-[var(--color-surface)] px-3 text-sm focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--color-accent)]" style={{ borderRadius: "var(--radius-sm)" }} />
          <div className="mt-2 flex flex-wrap gap-2">{(["happy", "regretted", "unsure"] as const).map(answer => <Button key={answer} variant={p.feedback === answer ? "default" : "quiet"} disabled={busy === p.id} onClick={() => void rate(p, answer)}>{answer === "happy" ? "Happy" : answer === "regretted" ? "Regretted" : "Unsure"}</Button>)}</div>
        </div>
      </Card>;
    })}</div></section>)}{filtered.length === 0 && <Card><p className="text-sm text-[var(--color-text-muted)]">No purchases match these filters.</p></Card>}</div>;
}
