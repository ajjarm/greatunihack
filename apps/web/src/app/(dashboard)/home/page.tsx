"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import type { Home, Report, SpendScore } from "@/lib/types";
import { AssessmentFactors } from "@/components/dashboard/factors";
import { Card, Chip, Label, PageState, ScoreDial, date, money, useApi } from "@/components/dashboard/shared";

const shortDate = (value: string) => new Intl.DateTimeFormat("en-GB", { timeZone: "Europe/London", day: "numeric", month: "short" }).format(new Date(`${value}T12:00:00Z`));
const scoreColor = (value: number) => value >= 90 ? "var(--color-accent)" : value >= 75 ? "var(--color-go)" : value >= 50 ? "var(--color-think)" : "var(--color-stop)";

function ScoreHistory({ score, selectedWeek, onSelect }: { score: SpendScore; selectedWeek: string | null; onSelect: (week: string | null) => void }) {
  const points = score.history;
  if (points.length < 2) return null;
  return <div className="mt-6 border-t border-[var(--color-border)] pt-5">
    <div className="flex items-center justify-between gap-3"><h3 className="text-sm font-semibold">Score over time</h3><span className="text-xs text-[var(--color-text-muted)]">Choose a week</span></div>
    <ol className="mt-4 grid grid-cols-4 gap-2 sm:grid-cols-8" aria-label="Weekly Spend Score history">
      {points.map((point, index) => {
        const selected = selectedWeek === point.weekStart || (selectedWeek === null && index === points.length - 1);
        return <li key={point.weekStart} className="min-w-0 text-center"><button type="button" onClick={() => onSelect(index === points.length - 1 ? null : point.weekStart)} aria-pressed={selected} aria-label={`Week of ${date(point.weekStart)}: Spend Score ${point.value}. Show details.`} className={`w-full border p-2 transition-colors duration-[var(--motion-fast)] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--color-accent)] ${selected ? "border-[var(--color-accent)] bg-[var(--color-accent-bg)]" : "border-[var(--color-border)] bg-[var(--color-surface)]"}`} style={{ borderRadius: "var(--radius-sm)" }}>
          <span className="text-xs font-semibold">{point.value}</span>
          <span className="mt-1 flex h-16 items-end bg-[var(--color-surface-2)]" style={{ borderRadius: "var(--radius-sm)" }}><span className="w-full" style={{ height: `${Math.min(100, Math.max(0, point.value))}%`, backgroundColor: scoreColor(point.value), borderRadius: "var(--radius-sm)" }} /></span>
          <span className="mt-1 block text-[10px] text-[var(--color-text-muted)]">{shortDate(point.weekStart)}</span>
        </button></li>;
      })}
    </ol>
    <div className="mt-3 flex flex-wrap gap-x-4 gap-y-1 text-xs text-[var(--color-text-muted)]"><span><span className="text-[var(--color-stop)]">●</span> Below 50</span><span><span className="text-[var(--color-think)]">●</span> 50–74</span><span><span className="text-[var(--color-go)]">●</span> 75–89</span><span><span className="text-[var(--color-accent)]">●</span> 90–100</span></div>
  </div>;
}

export default function HomePage() {
  const { data, error, loading, reload } = useApi<Home>("home");
  const weekly = useApi<Report>("report?week=current");
  const [selectedWeek, setSelectedWeek] = useState<string | null>(null);
  useEffect(() => { const timer = setInterval(() => { void reload(); }, 10000); return () => clearInterval(timer); }, [reload]);
  if (!data) return <PageState loading={loading} error={error} retry={reload} />;

  const score = data.spendScore;
  const lastHistoryPoint = score.history.at(-1);
  const selectedPoint = score.history.find(point => point.weekStart === selectedWeek);
  const viewingPast = Boolean(selectedPoint && selectedPoint.weekStart !== lastHistoryPoint?.weekStart);
  const selectedIndex = viewingPast ? score.history.findIndex(point => point.weekStart === selectedWeek) : score.history.length - 1;
  const displayedScore = viewingPast ? selectedPoint!.value : score.value;
  const band = viewingPast ? displayedScore >= 75 ? "green" : displayedScore >= 50 ? "amber" : "red" : score.band;
  const veryGood = displayedScore >= 90;
  const tone = veryGood ? "accent" : band === "green" ? "go" : band === "amber" ? "think" : "stop";
  const previousWeek = viewingPast ? score.history[selectedIndex - 1] : lastHistoryPoint?.value === score.value ? score.history.at(-2) : lastHistoryPoint;
  const change = previousWeek ? displayedScore - previousWeek.value : null;
  const selectedReport = viewingPast && weekly.data?.weekStart === selectedWeek ? weekly.data : null;

  return <div className="space-y-5">
    <header><Label>Overview</Label><h1 className="mt-1 text-3xl font-bold">Your money, today</h1><p className="mt-1 text-sm text-[var(--color-text-muted)]">{date(data.demoNow)}</p></header>
    {data.pendingReflections > 0 && <Link href="/purchases" className="block border border-[var(--color-accent)] bg-[var(--color-accent-bg)] p-4 text-sm font-semibold text-[var(--color-accent)]" style={{ borderRadius: "var(--radius-md)" }}>{data.pendingReflections} purchase{data.pendingReflections === 1 ? " is" : "s are"} ready for a check-in →</Link>}

    <Card>
      <div className="flex flex-col gap-5 sm:flex-row sm:items-center sm:gap-7">
        <ScoreDial value={displayedScore} tone={tone} />
        <div className="min-w-0 flex-1" aria-live="polite">
          <Label>{viewingPast ? `Week of ${date(selectedPoint!.weekStart)}` : "Current Spend Score"}</Label>
          <h2 className="mt-1 text-2xl font-bold">{veryGood ? "Very good" : band === "green" ? "Doing well" : band === "amber" ? "Making progress" : "Needs attention"}</h2>
          <div className="mt-3 flex flex-wrap items-center gap-2"><Chip tone={tone}>{veryGood ? "very good" : band}</Chip>{change !== null && <span className="text-sm font-semibold">{change > 0 ? `+${change}` : change} points vs previous week</span>}</div>
          {viewingPast ? selectedReport ? <div className="mt-4 grid grid-cols-2 gap-3 text-sm"><div><Label>Nudges heeded</Label><strong>{selectedReport.heeded} of {selectedReport.nudgesShown}</strong></div><div><Label>Limits kept</Label><strong>{selectedReport.limitsKept} of {selectedReport.limitsKept + selectedReport.limitsExceeded}</strong></div><div><Label>Overrides regretted</Label><strong>{selectedReport.overriddenRegretted}</strong></div><div><Label>Money kept · estimated</Label><strong>{money(selectedReport.avoidedPence)}</strong></div></div> : <p className="mt-4 text-sm text-[var(--color-text-muted)]">The score is recorded for this week; a detailed weekly report is not available.</p> : <p className="mt-4 text-sm leading-relaxed">{score.explanation}</p>}
          {viewingPast && <button type="button" onClick={() => setSelectedWeek(null)} className="mt-3 text-sm font-semibold text-[var(--color-accent)] underline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--color-accent)]">Back to current week</button>}
          <div className="mt-4"><Link href="/insights" className="inline-flex min-h-11 items-center gap-2 bg-[var(--color-accent)] px-4 py-2 text-sm font-semibold text-[var(--color-surface)] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--color-accent)]" style={{ borderRadius: "var(--radius-sm)" }}>Explore your insights <span aria-hidden="true">→</span></Link></div>
        </div>
      </div>
      <ScoreHistory score={score} selectedWeek={viewingPast ? selectedWeek : null} onSelect={setSelectedWeek} />
      <p className="mt-4 text-xs text-[var(--color-text-muted)]">The score reflects nudges, later feedback, weekly limits and your cash position. Spending alone does not lower it.</p>
    </Card>

    <div className="grid gap-5 lg:grid-cols-2">
      <Card><Label>Safe to spend until {date(data.nextIncome.date)}</Label><p className="mt-3 text-4xl font-bold">{money(data.safeToSpendPence)}</p><p className="mt-3 text-sm text-[var(--color-text-muted)]">{data.daysToNextIncome} day{data.daysToNextIncome === 1 ? "" : "s"} until {data.nextIncome.name} ({money(data.nextIncome.amountPence)})</p><div className="mt-6 border-t border-[var(--color-border)] pt-4"><Label>Current balance</Label><p className="mt-1 text-2xl font-semibold">{money(data.balancePence)}</p></div></Card>
      <Card>
        <Label>Money kept from nudges · estimated</Label>
        {weekly.data ? <><p className="mt-3 text-4xl font-bold text-[var(--color-go)]">{money(weekly.data.avoidedPence)}</p><p className="mt-2 text-sm text-[var(--color-text-muted)]">Week of {date(weekly.data.weekStart)}</p><p className="mt-5 border-t border-[var(--color-border)] pt-4 text-sm">{weekly.data.heeded} of {weekly.data.nudgesShown} nudges heeded that week</p></> : weekly.error ? <div role="alert" className="mt-3 text-sm"><p>{weekly.error}</p><button type="button" onClick={() => void weekly.reload()} className="mt-2 font-semibold text-[var(--color-accent)] underline">Try again</button></div> : <p className="mt-3 text-sm text-[var(--color-text-muted)]">Loading weekly savings…</p>}
      </Card>
    </div>

    <Card><Label>Next bill</Label><div className="mt-2 flex items-end justify-between gap-4"><div><p className="font-semibold">{data.nextBill.name}</p><p className="text-sm text-[var(--color-text-muted)]">{date(data.nextBill.date)}</p></div><p className="text-xl font-bold">{money(data.nextBill.amountPence)}</p></div></Card>
    <Card className="bg-[var(--color-accent-bg)]"><Label>Worth knowing</Label><p className="mt-2 text-lg font-medium leading-snug">{data.insight}</p></Card>
    <section><div className="mb-3 flex items-center justify-between"><h2 className="text-xl font-bold">Recent checkouts</h2><Link href="/purchases" className="text-sm font-semibold text-[var(--color-accent)]">Purchases →</Link></div><div className="space-y-3">{data.recentAssessments.length ? data.recentAssessments.map(a => <Card key={a.id}><div className="flex items-start justify-between gap-3"><div><p className="font-semibold">{a.merchant}</p><p className="mt-1 text-sm text-[var(--color-text-muted)]">{a.headline}</p><p className="mt-2 text-xs text-[var(--color-text-muted)]">{date(a.createdAt)} · {a.decision.replaceAll("_", " ")}</p></div><p className="shrink-0 font-bold">{money(a.totalPence)}</p></div><AssessmentFactors id={a.id} score={a.regretRisk} /></Card>) : <Card><p className="text-sm text-[var(--color-text-muted)]">No checkouts yet.</p></Card>}</div></section>
  </div>;
}
