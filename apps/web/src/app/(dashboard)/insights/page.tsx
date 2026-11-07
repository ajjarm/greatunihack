"use client";

import { useEffect } from "react";
import type { Home, Insights, Purchase, TimelineResponse } from "@/lib/types";
import { Card, PageState, category, date, money, useApi } from "@/components/dashboard/shared";
import { BAND_VAR, FlatBar, PageHeader, PgChip, bandOf } from "@/components/dashboard/page-ui";
import { AssessmentFactors } from "@/components/dashboard/factors";
import { Timeline } from "@/components/dashboard/timeline";
import { ScoreInfo } from "@/components/dashboard/score-info";

const insightSections = [
  { title: "What you buy", keys: ["category", "duplicates"] },
  { title: "When you shop", keys: ["late_night", "friday", "payday"] },
  { title: "Checkout pressure", keys: ["pressure"] },
  { title: "How the agent learns", keys: ["calibration"] },
];

export default function InsightsPage() {
  const insights = useApi<Insights>("insights");
  const timeline = useApi<TimelineResponse>("timeline");
  const purchases = useApi<Purchase[]>("purchases");
  const home = useApi<Home>("home");
  const reloadHome = home.reload;
  useEffect(() => { const timer = setInterval(() => { void reloadHome(); }, 10000); return () => clearInterval(timer); }, [reloadHome]);
  if (!insights.data || !timeline.data) return <PageState loading={insights.loading || timeline.loading} error={insights.error || timeline.error} retry={() => { void insights.reload(); void timeline.reload(); }} />;
  const data = insights.data;
  const groupedInsights = insightSections.map(section => ({ title: section.title, items: data.sentences.filter(sentence => section.keys.includes(sentence.key)) })).filter(section => section.items.length > 0);
  const remainingInsights = data.sentences.filter(sentence => !insightSections.some(section => section.keys.includes(sentence.key)));
  if (remainingInsights.length) groupedInsights.push({ title: "More findings", items: remainingInsights });
  const regretted = purchases.data?.filter(purchase => purchase.feedback === "regretted" && purchase.amountPence > 0) ?? [];
  const regrettedPence = regretted.reduce((total, purchase) => total + purchase.amountPence, 0);
  // evidence that is only raw purchase ids reads as noise on the surface; keep it for the hover-free list only when readable
  const readable = (evidence?: string) => evidence && !/\bp_\d+/.test(evidence) ? evidence : null;
  const lateNight = data.sentences.find(sentence => sentence.key === "late_night");
  const duplicateSentence = data.sentences.find(sentence => sentence.key === "duplicates");
  const pressureBand = bandOf(data.pressure.withCueRatePct);
  const decision = (value: string) => value.replaceAll("_", " ").replace(/^./, c => c.toUpperCase());
  return <div className="pg-stack">
    <PageHeader title="Insights" sub={purchases.data ? `From ${purchases.data.filter(p => p.feedback).length} purchases you’ve rated.` : "What your spending has been telling me."} />

    <div className="pg-grid three">
      <Card><p className="pg-label">Late at night</p>{lateNight ? <><p className="mt-2 text-lg font-medium leading-snug">{lateNight.text}</p>{readable(lateNight.evidence) && <p className="pg-label mt-3">{lateNight.evidence}</p>}</> : <p className="pg-sub mt-2">No late-night pattern yet.</p>}</Card>
      <Card><p className="pg-label">Under pressure</p><div className="mt-2 flex items-end justify-between gap-4"><div className="min-w-0"><ScoreInfo label={`With a sales cue: ${data.pressure.withCueRatePct}%`} className="pg-big" details={<><p>Regret rate for reviewed purchases made with a sales cue, such as a countdown or limited-stock message.</p><p>{data.pressure.sentence}</p></>}><span style={{ color: BAND_VAR[pressureBand] }}>{data.pressure.withCueRatePct}%</span></ScoreInfo><p className="pg-label mt-1">regretted with a sale or “only 2 left” banner</p></div><div className="shrink-0 text-right"><ScoreInfo label={`Without a sales cue: ${data.pressure.withoutCueRatePct}%`} className="pg-big" details={<><p>Regret rate for reviewed purchases without a recorded sales cue.</p><p>{data.pressure.sentence}</p></>}>{data.pressure.withoutCueRatePct}%</ScoreInfo><p className="pg-label mt-1">without one</p></div></div><p className="pg-label mt-3">{data.pressure.sentence}</p></Card>
      <Card><p className="pg-label">Duplicates</p>{duplicateSentence ? <><p className="mt-2 text-lg font-medium leading-snug">{duplicateSentence.text}</p>{readable(duplicateSentence.evidence) && <p className="pg-label mt-3">{duplicateSentence.evidence}</p>}</> : data.duplicates.length ? <div className="mt-2">{data.duplicates.map(d => <div key={d.item} className="pg-kv"><span>{d.item}</span><strong className="pg-num">{d.count} found</strong></div>)}</div> : <p className="pg-sub mt-2">No duplicates spotted.</p>}</Card>
    </div>

    <div className="pg-grid three">
      <Card><h2 className="pg-card-title">Regret by category</h2><div className="mt-4 flex flex-col gap-4">{data.regretByCategory.map(row => <div key={row.category}><div className="mb-2 flex justify-between gap-2 text-sm"><span>{category(row.category)}</span><ScoreInfo label={`${category(row.category)} regret rate: ${row.ratePct}%`} className="font-semibold pg-num" details={<><p>{row.regretted} of {row.reviewed} reviewed purchases in this category were marked regretted.</p><p>The percentage is regretted ÷ reviewed, rounded to a whole number.</p></>}><span style={{ color: BAND_VAR[bandOf(row.ratePct)] }}>{row.ratePct}%</span></ScoreInfo></div><FlatBar value={row.ratePct} color={BAND_VAR[bandOf(row.ratePct)]} /><p className="pg-label mt-2">{row.regretted} of {row.reviewed} regretted</p></div>)}{!data.regretByCategory.length && <p className="pg-sub">Rate some purchases to see patterns.</p>}</div></Card>
      <Card><h2 className="pg-card-title">Risky times</h2><div className="mt-4 flex flex-col gap-4">{data.riskyWindows.map(w => <div key={w.label}><div className="mb-2 flex justify-between gap-2 text-sm"><span>{w.label}</span><ScoreInfo label={`${w.label} regret rate: ${w.ratePct}%`} className="font-semibold pg-num" details={<><p>The share of reviewed purchases in this time window that were regretted.</p><p>{w.evidence}</p></>}><span style={{ color: BAND_VAR[bandOf(w.ratePct)] }}>{w.ratePct}%</span></ScoreInfo></div><FlatBar value={w.ratePct} color={BAND_VAR[bandOf(w.ratePct)]} /><p className="pg-label mt-2">{w.evidence}</p></div>)}{!data.riskyWindows.length && <p className="pg-sub">No clear time pattern yet.</p>}</div></Card>
      <Card><h2 className="pg-card-title">Limits this week</h2><div className="mt-4 flex flex-col gap-4">{data.limits.map(l => { const over = l.spentThisWeekPence > l.weeklyLimitPence; return <div key={l.category}><div className="mb-2 flex justify-between gap-2 text-sm"><span>{category(l.category)}</span><span className="pg-num"><strong style={{ color: over ? "var(--color-stop)" : undefined }}>{money(l.spentThisWeekPence)}</strong> <span className="pg-muted">of {money(l.weeklyLimitPence)}</span></span></div><FlatBar value={l.spentThisWeekPence} max={l.weeklyLimitPence} color={over ? "var(--color-stop)" : "var(--color-text)"} /></div>; })}{!data.limits.length && <p className="pg-sub">No weekly limits set.</p>}</div></Card>
    </div>

    <div className="pg-grid three">
      <Card><div className="flex items-center justify-between gap-3"><h2 className="pg-card-title">Next 5 weeks</h2><PgChip tone={timeline.data.safeToSpendPence >= 0 ? "go" : "stop"}>{timeline.data.safeToSpendPence >= 0 ? "Above £0" : "Below £0"}</PgChip></div>
        <p className="pg-label mt-2 pg-num">Balance {money(timeline.data.balancePence)} · safe to spend {money(timeline.data.safeToSpendPence)} · next income {date(timeline.data.nextIncome.date)}</p>
        <div className="mt-4"><Timeline points={timeline.data.points} regrettedPence={regrettedPence} /></div>
        {purchases.data ? <div className="mt-4 grid grid-cols-2 gap-3"><div className="pg-tile"><p className="pg-label">Regretted</p><p className="mt-1 font-semibold pg-num">{regretted.length} · {money(regrettedPence)}</p></div><div className="pg-tile"><p className="pg-label">Could have today</p><p className="mt-1 font-semibold pg-num pg-go">{money(timeline.data.balancePence + regrettedPence)}</p></div></div> : purchases.error ? <div role="alert" className="mt-4 text-sm"><p>Could not load regretted purchases: {purchases.error}</p><button type="button" onClick={() => void purchases.reload()} className="pg-btn mt-2">Try again</button></div> : <p className="pg-sub mt-4">Loading regretted purchases…</p>}
        {purchases.data && regrettedPence > 0 && <p className="pg-label mt-3">“Could have today” adds back what you marked regretted. Income and bills are assumed unchanged.</p>}
      </Card>
      <Card><h2 className="pg-card-title">Tuned to you</h2><ScoreInfo label={`Overall calibration: ${data.calibration.overallPct}%`} className="pg-big mt-3" details={<><p>How closely the agent&apos;s regret predictions have matched later purchase feedback overall.</p><p>It changes as you rate purchases. Category scores below show where it is more or less tuned to you.</p></>}>{data.calibration.overallPct}%</ScoreInfo>
        <div className="mt-3">{data.calibration.byCategory.map(c => <div key={c.category} className="pg-kv"><span className="min-w-0">{category(c.category)}<ScoreInfo label={`${category(c.category)} risk adjustment: ×${c.multiplier.toFixed(1)}`} className="pg-label ml-2" details={<><p>This multiplier adjusts future regret predictions for {category(c.category).toLowerCase()}.</p><p>Feedback can move it by 0.1 at a time: happy outcomes lower risk and regretted outcomes raise it, within ×0.5–×1.5.</p></>}>×{c.multiplier.toFixed(1)}</ScoreInfo></span><ScoreInfo label={`${category(c.category)} calibration: ${c.pct}%`} className="shrink-0 pg-num" details={<><p>Share of recent predictions in this category that matched your later feedback.</p><p>Change from the starting estimate: {c.deltaPct >= 0 ? "+" : ""}{c.deltaPct} percentage points.</p></>}><span className="pg-label" style={{ color: c.deltaPct >= 0 ? "var(--color-go)" : "var(--color-stop)" }}>{c.deltaPct >= 0 ? "+" : "−"}{Math.abs(c.deltaPct)}</span> <strong>{c.pct}%</strong></ScoreInfo></div>)}</div>
      </Card>
      <Card><h2 className="pg-card-title">Avoided</h2><p className="pg-big mt-3">{money(data.avoidedPence)}</p><p className="pg-label mt-1">estimated</p><div className="mt-4 flex flex-col gap-2">{data.avoidedCouldBe.map(c => <p key={c.label} className="text-sm leading-relaxed"><span className="pg-muted">{c.label}:</span> {c.text}</p>)}</div></Card>
    </div>

    <Card id="spending-patterns"><div className="flex flex-wrap items-center justify-between gap-3"><h2 className="pg-card-title">What I noticed</h2><PgChip>{data.sentences.length} findings</PgChip></div>
      {groupedInsights.length ? <div role="region" aria-label="Spending insight findings" tabIndex={0} className="pg-focus mt-4 grid gap-4 md:grid-cols-2">
        {groupedInsights.map(section => <section key={section.title} aria-label={section.title}><h3 className="pg-label mb-2">{section.title}</h3><ul className="flex flex-col gap-2">{section.items.map(item => <li key={item.key} className="pg-tile"><p className="font-medium leading-snug">{item.text}</p>{readable(item.evidence) && <p className="pg-label mt-2">{item.evidence}</p>}</li>)}</ul></section>)}
      </div> : <p className="pg-sub mt-3">No patterns yet. Check back after you rate some purchases.</p>}
    </Card>

    <Card><div className="flex items-center justify-between gap-3"><h2 className="pg-card-title">Agent log</h2><PgChip tone="go">Live</PgChip></div><p className="pg-sub">Recent checkout assessments, refreshed automatically.</p><div aria-live="polite" className="mt-3">{home.loading && !home.data && <p className="pg-sub">Loading recent checkouts…</p>}{home.error && <div role="alert" className="text-sm pg-stop"><p>{home.error}</p><button type="button" onClick={() => void home.reload()} className="pg-btn mt-2">Try again</button></div>}{home.data?.recentAssessments.map(a => <div key={a.id} className="border-t border-[var(--color-border)] py-3 first:border-0"><div className="flex flex-wrap items-center justify-between gap-2"><span className="font-medium">{a.merchant} <span className="pg-num" style={{ color: BAND_VAR[bandOf(a.regretRisk)] }}>{a.regretRisk}%</span></span><div className="flex flex-wrap gap-2"><PgChip>{decision(a.decision)}</PgChip>{a.outcome && <PgChip tone={a.outcome === "happy" ? "go" : a.outcome === "regretted" ? "stop" : "think"}>{decision(a.outcome)}</PgChip>}</div></div><p className="mt-1 text-sm">{a.headline}</p><p className="pg-label mt-1">{date(a.createdAt)} · {decision(a.verdict)}</p><AssessmentFactors id={a.id} score={a.regretRisk} /></div>)}{home.data && !home.data.recentAssessments.length && <p className="pg-sub">No assessments yet.</p>}</div></Card>
  </div>;
}
