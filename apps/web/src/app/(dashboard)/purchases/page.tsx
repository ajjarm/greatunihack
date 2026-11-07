"use client";

import { useEffect, useState } from "react";
import { CATEGORIES, CATEGORY_LABELS, type Category, type Feedback, type Purchase } from "@/lib/types";
import { api, Card, PageState, dayKey, money, useApi } from "@/components/dashboard/shared";
import { BAND_VAR, FEEDBACK_LABEL, FEEDBACK_ORDER, FaceIcon, FeedbackControl, Mark, PageHeader, PgChip, Segmented, bandOf } from "@/components/dashboard/page-ui";
import { AssessmentFactors } from "@/components/dashboard/factors";
import { ScoreInfo } from "@/components/dashboard/score-info";

type Segment = "all" | "wants" | "essentials" | "regretted";
const dayLabel = (key: string) => new Intl.DateTimeFormat("en-GB", { timeZone: "Europe/London", weekday: "long", day: "numeric", month: "long" }).format(new Date(`${key}T12:00:00Z`));
const boughtAt = (value: string) => new Intl.DateTimeFormat("en-GB", { timeZone: "Europe/London", weekday: "long", day: "numeric", month: "long", hour: "numeric", minute: "2-digit", hour12: true }).format(new Date(value)).replace(" at ", ", ").replace(/\s?(am|pm)$/i, (_, x: string) => x.toLowerCase());
const spent = (pence: number) => `−${money(pence)}`;

const SCORE_STORAGE_KEY = "greatunihack-purchase-score-adjustments";

export default function PurchasesPage() {
  const { data, setData, error, loading, reload } = useApi<Purchase[]>("purchases");
  const pending = useApi<Purchase[]>("pending-reflections");
  const reloadPending = pending.reload;
  // reflections come due while the page is open (60s in the demo): check again every 15s
  useEffect(() => {
    const timer = setInterval(() => void reloadPending(), 15_000);
    return () => clearInterval(timer);
  }, [reloadPending]);
  const [category, setCategory] = useState<Category | "all">("all");
  const [feedback, setFeedback] = useState<Feedback | "all" | "unrated">("all");
  const [kind, setKind] = useState<"all" | "wants" | "essentials">("all");
  const [reason, setReason] = useState<Record<string, string>>({});
  const [busy, setBusy] = useState<string | null>(null);
  const [actionError, setActionError] = useState("");
  const [scoreOverrides, setScoreOverrides] = useState<Record<string, number>>({});
  const [scoreDrafts, setScoreDrafts] = useState<Record<string, string>>({});
  useEffect(() => {
    try {
      const stored = JSON.parse(localStorage.getItem(SCORE_STORAGE_KEY) ?? "{}");
      if (stored && typeof stored === "object" && !Array.isArray(stored)) {
        // browser storage is read after hydration so the server and first client render match
        // eslint-disable-next-line react-hooks/set-state-in-effect
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
  const filtered = data.filter(p => (category === "all" || p.category === category) && (kind === "all" || (kind === "essentials" ? p.essential : !p.essential)) && (feedback === "all" || (feedback === "unrated" ? p.feedback === null : p.feedback === feedback)));
  const dueItems = filtered.filter(p => !p.feedback && pendingIds.has(p.id));
  const allRated = pending.data.length > 0 && data.filter(p => pendingIds.has(p.id)).every(p => p.feedback);
  const groups = filtered.reduce<Record<string, Purchase[]>>((result, purchase) => {
    const day = dayKey(purchase.purchasedAt);
    (result[day] ??= []).push(purchase);
    return result;
  }, {});
  const segment: Segment = feedback === "regretted" ? "regretted" : kind;
  function pickSegment(next: Segment) {
    if (next === "regretted") { setKind("all"); setFeedback("regretted"); return; }
    setKind(next);
    if (feedback === "regretted") setFeedback("all");
  }
  const due = dueItems[0];
  const dueRisk = due ? scoreOverrides[due.id] ?? due.predictedRegret : undefined;
  return <div className="pg-stack">
    <PageHeader title="Purchases" sub="Rate what you bought. It’s how I learn you.">
      <Segmented label="Filter purchases" value={segment} onChange={pickSegment} options={[{ value: "all", label: "All" }, { value: "wants", label: "Wants" }, { value: "essentials", label: "Essentials" }, { value: "regretted", label: "Regretted" }]} />
    </PageHeader>
    <div className="flex flex-wrap gap-2">
      <label className="sr-only" htmlFor="pg-cat">Category</label>
      <select id="pg-cat" value={category} onChange={e => setCategory(e.target.value as Category | "all")} className="pg-select"><option value="all">All categories</option>{CATEGORIES.map(c => <option key={c} value={c}>{CATEGORY_LABELS[c]}</option>)}</select>
      <label className="sr-only" htmlFor="pg-fb">Feedback</label>
      <select id="pg-fb" value={feedback} onChange={e => setFeedback(e.target.value as Feedback | "all" | "unrated")} className="pg-select"><option value="all">All feedback</option><option value="unrated">Not rated</option><option value="happy">Happy</option><option value="regretted">Regretted</option><option value="unsure">Unsure</option></select>
    </div>

    {due ? <Card>
      <div className="flex items-start justify-between gap-4">
        <div className="min-w-0">
          <p className="pg-label">Due for a rating · bought {boughtAt(due.purchasedAt)}</p>
          <h2 className="pg-reflect-q mt-2">How do you feel about the {due.item.toLowerCase()} now?</h2>
          <p className="pg-sub pg-num">{due.merchant} · {spent(due.amountPence)}{dueRisk !== undefined && <> · I guessed {dueRisk}% regret risk</>}</p>
        </div>
        <span className="hidden sm:block"><Mark name={due.merchant} /></span>
      </div>
      <input aria-label={`Reason for ${due.item} feedback (optional)`} placeholder="Why? (optional)" value={reason[due.id] ?? ""} onChange={e => setReason({ ...reason, [due.id]: e.target.value })} className="pg-input mt-4 w-full" />
      <div className="mt-3 flex flex-wrap gap-2">{FEEDBACK_ORDER.map(answer => <button key={answer} type="button" className="pg-bigfb" data-v={answer} aria-pressed={false} disabled={busy === due.id} onClick={() => void rate(due, answer)}><FaceIcon kind={answer} />{FEEDBACK_LABEL[answer]}</button>)}</div>
      {dueItems.length > 1 && <p className="pg-label mt-4">Also due: {dueItems.slice(1).map((p, i) => <span key={p.id}>{i ? ", " : ""}<a href={`#purchase-${p.id}`} className="pg-focus underline" style={{ color: "var(--color-text)" }}>{p.item}</a></span>)}</p>}
    </Card> : allRated && <Card><p className="pg-card-title">All caught up.</p><p className="pg-sub">One less thing. I’ll ask about the next one when it’s due.</p></Card>}

    {actionError && <p role="alert" className="text-sm pg-stop">{actionError}</p>}

    {filtered.length > 0 ? <Card>
      {Object.entries(groups).map(([day, items]) => <section key={day} aria-label={dayLabel(day)}>
        <h2 className="pg-day">{dayLabel(day)}</h2>
        {items?.map(p => {
          const isDue = !p.feedback && pendingIds.has(p.id);
          const risk = scoreOverrides[p.id] ?? p.predictedRegret;
          return <div key={p.id} id={`purchase-${p.id}`} className="pg-row scroll-mt-24" data-due={isDue}>
            <Mark name={p.merchant} />
            <div className="min-w-0">
              <p className="pg-row-name truncate">{p.item}</p>
              <p className="pg-row-meta truncate">{p.merchant} · {CATEGORY_LABELS[p.category]}{risk !== undefined && <span className="sm:hidden"> · <span style={{ color: BAND_VAR[bandOf(risk)] }}>{risk}%</span></span>}</p>
            </div>
            <span className="pg-row-risk" style={{ color: risk !== undefined ? BAND_VAR[bandOf(risk)] : undefined }}>{risk !== undefined ? `${risk}%` : ""}</span>
            <span className="pg-row-amt">{spent(p.amountPence)}</span>
            <div className="pg-row-ctl">{p.essential ? <PgChip>Essential</PgChip> : <FeedbackControl value={p.feedback} item={p.item} disabled={busy === p.id} onPick={answer => void rate(p, answer)} />}</div>
            <details className="pg-details pg-row-more">
              <summary>{isDue ? "Your check-in" : p.feedback ? "Update your feedback" : "Details"} <span className="pg-caret" aria-hidden="true">⌄</span></summary>
              <div className="pg-tile mt-2 flex flex-col gap-3">
                {p.predictedRegret !== undefined && p.assessmentId && <AssessmentFactors id={p.assessmentId} score={p.predictedRegret} itemName={p.item} fallbackPurchase={p} />}
                <label className="pg-label block">Predicted regret score (editable)
                  <span className="mt-1 flex items-center gap-2"><input type="number" min={0} max={100} step={1} inputMode="numeric" aria-label={`Predicted regret score for ${p.item}`} title="Predicted regret risk from 0 to 100. Your edit is saved only in this browser." value={scoreDrafts[p.id] ?? scoreOverrides[p.id] ?? p.predictedRegret ?? ""} onChange={e => setScoreDrafts(current => ({ ...current, [p.id]: e.target.value }))} onBlur={() => saveScore(p)} onKeyDown={e => { if (e.key === "Enter") e.currentTarget.blur(); }} className="pg-input w-24 pg-num" /><span className="text-sm" style={{ color: "var(--color-text)" }}>/ 100</span></span>
                </label>
                <ScoreInfo label={`Predicted regret score for ${p.item}`} className="self-start text-xs font-semibold underline" details={<><p>This is the agent&apos;s original 0–100 estimate of regret risk. The badge above shows its recorded factors, such as past outcomes, timing, sales pressure and money impact.</p><p>Your edited number is saved in this browser only and does not change the original assessment or calibration.</p></>}>What does this score mean?</ScoreInfo>
                <p className="pg-label">Your adjustment is saved in this browser. It does not change the agent&apos;s original score or calibration.</p>
                <input aria-label={`Reason for ${p.item} feedback (optional)`} placeholder="Why? (optional)" value={reason[p.id] ?? ""} onChange={e => setReason({ ...reason, [p.id]: e.target.value })} className="pg-input w-full" />
                {p.essential && <div className="flex items-center gap-3"><span className="pg-label">Rate it anyway</span><FeedbackControl value={p.feedback} item={p.item} disabled={busy === p.id} onPick={answer => void rate(p, answer)} /></div>}
              </div>
            </details>
          </div>;
        })}
      </section>)}
    </Card> : <Card><p className="pg-card-title">Nothing here.</p><p className="pg-sub">No purchases match these filters.</p></Card>}
  </div>;
}
