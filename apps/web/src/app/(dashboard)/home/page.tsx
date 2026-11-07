"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import type { Home, Report, SpendScore } from "@/lib/types";
import { AssessmentFactors } from "@/components/dashboard/factors";
import { BillsCalendar } from "@/components/dashboard/bills-calendar";
import { ScoreExamples } from "@/components/dashboard/score-examples";
import { SpendScoreBreakdown } from "@/components/dashboard/spend-score-breakdown";
import { Bar, Card, Chip, Label, MerchantMark, MoneyFigure, PageHeader, PageState, Tile, date, money, useApi } from "@/components/dashboard/shared";

const shortDate = (value: string) => new Intl.DateTimeFormat("en-GB", { timeZone: "Europe/London", day: "numeric", month: "short" }).format(new Date(`${value}T12:00:00Z`));
const weekdayDate = (value: string) => new Intl.DateTimeFormat("en-GB", { timeZone: "Europe/London", weekday: "short", day: "numeric", month: "short" }).format(new Date(`${value.slice(0, 10)}T12:00:00Z`));
const dayNumber = (value: string) => new Intl.DateTimeFormat("en-GB", { timeZone: "Europe/London", day: "numeric" }).format(new Date(`${value}T12:00:00Z`));
const decisionLabel: Record<string, string> = { wait: "Waiting", buy_anyway: "Bought anyway", dismiss: "Dismissed", pending: "Open" };

const glyph = { width: 16, height: 16, viewBox: "0 0 24 24", fill: "none", stroke: "currentColor", strokeWidth: 2.2, strokeLinecap: "round" as const, "aria-hidden": true };

/** Eight weeks: past hatched, current solid accent. Hover shows the score and change; click selects the week. */
function ScoreHistory({ score, selectedWeek, onSelect }: { score: SpendScore; selectedWeek: string | null; onSelect: (week: string | null) => void }) {
  const points = score.history.slice(-8);
  if (points.length < 2) return null;
  const offset = score.history.length - points.length;
  return <div className="min-w-0">
    <ol className="ds-bars" aria-label="Weekly Spend Score history">
      {points.map((point, index) => {
        const last = index === points.length - 1;
        const selected = selectedWeek === point.weekStart || (selectedWeek === null && last);
        const prev = score.history[offset + index - 1];
        const change = prev ? point.value - prev.value : null;
        return <li key={point.weekStart} className="contents"><button type="button" onClick={() => onSelect(last ? null : point.weekStart)} aria-pressed={selected} data-now={last} aria-label={`Week of ${date(point.weekStart)}: Spend Score ${point.value}. Show details.`} className="ds-sb" style={{ "--k": index } as React.CSSProperties}>
          <span className="ds-sbcol" style={{ height: `${Math.min(100, Math.max(4, point.value))}%` }} />
          <span className="ds-sbtip" aria-hidden="true"><b>{point.value}</b>{change === null ? "first week" : change === 0 ? "no change" : `${change > 0 ? "+" : "−"}${Math.abs(change)} on the week before`}</span>
        </button></li>;
      })}
    </ol>
    <div className="ds-xaxis" aria-hidden="true">{points.map((point, index) => <span key={point.weekStart} data-now={index === points.length - 1}><span className="ds-lg">{shortDate(point.weekStart)}</span><span className="ds-sh">{dayNumber(point.weekStart)}</span></span>)}</div>
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

  const bandWord = veryGood ? "Very good" : band === "green" ? "Doing well" : band === "amber" ? "Making progress" : "Needs attention";
  const billCovered = data.balancePence >= data.nextBill.amountPence;

  return <div className="flex flex-col gap-[14px]">
    <PageHeader title="Home" sub={data.insight} action={<Link href="/profile" className="ds-btn ds-btn-acc shrink-0">Add a rule <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" aria-hidden="true"><path d="M12 5v14M5 12h14" /></svg></Link>} />

    <div className="grid gap-[14px] lg:grid-cols-[minmax(0,1fr)_340px]">
      <Card className="flex flex-col gap-[18px]">
        <h2 className="ds-h2">Money</h2>
        <div className="grid grid-cols-2 gap-[10px] md:grid-cols-3 md:gap-3">
          <Tile><p className="ds-label">until {weekdayDate(data.nextIncome.date)}</p><p className="mt-0.5 text-base font-medium">Safe to spend</p><p className="ds-big mt-4"><MoneyFigure pence={data.safeToSpendPence} /></p><span className="ds-glyph"><svg {...glyph}><rect x="3" y="6" width="18" height="12" rx="3" /><path d="M3 10h18" /></svg></span></Tile>
          <Tile><p className="ds-label">in {data.daysToNextIncome} day{data.daysToNextIncome === 1 ? "" : "s"}</p><p className="mt-0.5 text-base font-medium">Next payday</p><p className="ds-big mt-4"><MoneyFigure pence={data.nextIncome.amountPence} /></p><span className="ds-glyph"><svg {...glyph}><path d="M12 19V5M6 11l6-6 6 6" /></svg></span></Tile>
          <Tile className="col-span-2 md:col-span-1"><p className="ds-label truncate pr-10 max-md:pr-0">{data.nextBill.name} · {weekdayDate(data.nextBill.date)}</p><p className="mt-0.5 text-base font-medium">Next bill</p><p className="mt-4 flex flex-wrap items-baseline gap-x-2.5 gap-y-1"><span className="ds-big"><MoneyFigure pence={data.nextBill.amountPence} /></span>{billCovered ? <Chip tone="go">Covered</Chip> : <Chip tone="stop">Not covered</Chip>}</p><span className="ds-glyph"><svg {...glyph}><rect x="5" y="3" width="14" height="18" rx="3" /><path d="M11 17h2" /></svg></span></Tile>
        </div>
        <div className="grid items-end gap-[18px] md:grid-cols-[minmax(0,300px)_minmax(0,1fr)] md:gap-7">
          <div className="flex h-full min-w-0 flex-col justify-between" aria-live="polite">
            <div>
              <div className="flex items-center justify-between gap-3"><h2 className="ds-h2">Spend Score</h2>{viewingPast && <span className="ds-label">Week of {shortDate(selectedPoint!.weekStart)}</span>}</div>
              <div className="mt-2.5 flex flex-wrap items-center gap-x-3 gap-y-2">
                <SpendScoreBreakdown value={displayedScore} tone={tone} report={viewingPast ? selectedReport || null : weekly.data?.weekStart === lastHistoryPoint?.weekStart ? weekly.data : null} current={!viewingPast} explanation={score.explanation} safeToSpendPence={data.safeToSpendPence} />
                <span className="flex flex-wrap gap-1.5"><Chip tone={tone}>{bandWord}</Chip>{change !== null && <Chip tone={change > 0 ? "go" : change < 0 ? "stop" : "neutral"}>{change > 0 ? `↗ +${change}` : change < 0 ? `↘ −${Math.abs(change)}` : "→ no change"}</Chip>}</span>
              </div>
              {viewingPast ? selectedReport ? <div className="mt-3 grid grid-cols-2 gap-2 text-sm"><div><Label>Nudges heeded</Label><strong className="font-semibold">{selectedReport.heeded} of {selectedReport.nudgesShown}</strong></div><div><Label>Limits kept</Label><strong className="font-semibold">{selectedReport.limitsKept} of {selectedReport.limitsKept + selectedReport.limitsExceeded}</strong></div><div><Label>Overrides regretted</Label><strong className="font-semibold">{selectedReport.overriddenRegretted}</strong></div><div><Label>Money kept · estimated</Label><strong className="font-semibold">{money(selectedReport.avoidedPence)}</strong></div></div> : <p className="mt-3 text-sm text-[var(--color-text-muted)]">The score is recorded for this week; a detailed weekly report is not available.</p> : <p className="mt-3 text-[var(--color-text-muted)]">{score.explanation}</p>}
            </div>
            <div className="mt-[18px] flex flex-wrap gap-2">
              {viewingPast ? <button type="button" onClick={() => setSelectedWeek(null)} className="ds-btn ds-btn-sec">Back to this week</button> : data.pendingReflections > 0 ? <Link href="/purchases" className="ds-btn ds-btn-acc">Reflect on {data.pendingReflections} purchase{data.pendingReflections === 1 ? "" : "s"}</Link> : <span className="ds-btn ds-btn-sec cursor-default">All caught up</span>}
              <Link href="/waiting" className="ds-btn ds-btn-sec">Waiting</Link>
            </div>
          </div>
          <ScoreHistory score={score} selectedWeek={viewingPast ? selectedWeek : null} onSelect={setSelectedWeek} />
        </div>
      </Card>

      <Card className="flex flex-col gap-4">
        <div className="flex items-center justify-between gap-3"><h2 className="ds-h2">This week</h2>{weekly.data && <Chip tone="go">Kept · estimated</Chip>}</div>
        {weekly.data ? <>
          <div><p className="ds-big"><MoneyFigure pence={weekly.data.avoidedPence} /></p><p className="ds-label mt-1.5">kept by waiting, week of {shortDate(weekly.data.weekStart)}</p></div>
          <div><div className="mb-2 flex justify-between gap-3 text-sm"><span>Nudges heeded</span><span className="font-semibold">{weekly.data.heeded} of {weekly.data.nudgesShown}</span></div><Bar value={weekly.data.heeded} max={weekly.data.nudgesShown} tone="white" /></div>
          <div><div className="mb-2 flex justify-between gap-3 text-sm"><span>Limits kept</span><span className="font-semibold">{weekly.data.limitsKept} of {weekly.data.limitsKept + weekly.data.limitsExceeded}</span></div><Bar value={weekly.data.limitsKept} max={weekly.data.limitsKept + weekly.data.limitsExceeded} tone="accent" /></div>
          <div className="border-t border-[var(--color-border)] pt-3"><p className="ds-label">Balance today</p><p className="mt-1 text-xl font-semibold tracking-tight"><MoneyFigure pence={data.balancePence} /></p></div>
          <Link href="/insights#spending-patterns" className="ds-btn ds-btn-sec self-start">See the evidence</Link>
        </> : weekly.error ? <div role="alert" className="text-sm"><p>{weekly.error}</p><button type="button" onClick={() => void weekly.reload()} className="ds-btn ds-btn-sec mt-2">Try again</button></div> : <p className="text-sm text-[var(--color-text-muted)]">Having a look at this week…</p>}
      </Card>
    </div>

    <Card>
      <div className="flex items-center justify-between gap-3"><h2 className="ds-h2">Recent checkouts</h2><Link href="/purchases" className="ds-btn ds-btn-sec min-h-[34px] px-3.5 text-xs">See all</Link></div>
      <div className="mt-2">{data.recentAssessments.length ? data.recentAssessments.slice(0, 5).map(a => <div key={a.id} className="ds-row flex-wrap md:flex-nowrap">
        <MerchantMark name={a.merchant} />
        <div className="min-w-0 flex-1"><p className="truncate font-medium">{a.merchant}</p><p className="ds-label truncate">{a.headline} · {date(a.createdAt)}</p></div>
        <span className="shrink-0 font-medium">{money(a.totalPence)}</span>
        <span className="flex shrink-0 items-center gap-2 max-md:w-full max-md:pl-12"><AssessmentFactors id={a.id} score={a.regretRisk} />{a.outcome ? <Chip tone={a.outcome === "happy" ? "go" : a.outcome === "regretted" ? "stop" : "think"}>{a.outcome === "happy" ? "Happy" : a.outcome === "regretted" ? "Regretted" : "Unsure"}</Chip> : <Chip>{decisionLabel[a.decision] ?? a.decision.replaceAll("_", " ")}</Chip>}</span>
      </div>) : <p className="ds-label py-3">No checkouts yet.</p>}</div>
    </Card>

    <BillsCalendar nextBill={data.nextBill} demoNow={data.demoNow} onSaved={() => void reload()} />
    <ScoreExamples />
  </div>;
}
