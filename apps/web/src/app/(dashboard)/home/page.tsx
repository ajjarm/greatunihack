"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import type { Home } from "@/lib/types";
import { Card, Chip, Label, PageState, ScoreDial, date, money, useApi } from "@/components/dashboard/shared";
import { AssessmentFactors } from "@/components/dashboard/factors";

export default function HomePage() {
  const { data, error, loading, reload } = useApi<Home>("home");
  const [explain, setExplain] = useState(false);
  useEffect(() => { const timer = setInterval(() => { void reload(); }, 10000); return () => clearInterval(timer); }, [reload]);
  if (!data) return <PageState loading={loading} error={error} retry={reload} />;
  const score = data.spendScore;
  const tone = score.band === "green" ? "go" : score.band === "amber" ? "think" : "stop";
  return <div className="space-y-5">
    <header><Label>Overview</Label><h1 className="mt-1 text-3xl font-bold">Your money, today</h1><p className="mt-1 text-sm text-[var(--color-text-muted)]">{date(data.demoNow)}</p></header>
    {data.pendingReflections > 0 && <Link href="/purchases" className="block border border-[var(--color-accent)] bg-[var(--color-accent-bg)] p-4 text-sm font-semibold text-[var(--color-accent)]" style={{ borderRadius: "var(--radius-md)" }}>{data.pendingReflections} purchase{data.pendingReflections === 1 ? " is" : "s are"} ready for a check-in →</Link>}
    <div className="grid gap-5 lg:grid-cols-2">
      <Card><div className="flex items-center gap-5"><ScoreDial value={score.value} tone={tone} /><div className="min-w-0"><Label>Spend Score</Label><div className="mt-2"><Chip tone={tone}>{score.band} · {score.trend === "up" ? "rising" : score.trend === "down" ? "falling" : "steady"}</Chip></div><button onClick={() => setExplain(!explain)} aria-expanded={explain} className="mt-3 text-left text-sm font-semibold text-[var(--color-accent)]">{explain ? "Hide explanation" : "How is this scored?"}</button></div></div>{explain && <p className="mt-5 border-t border-[var(--color-border)] pt-4 text-sm leading-relaxed">{score.explanation}</p>}{score.history.length > 0 && <p className="mt-4 text-xs text-[var(--color-text-muted)]">Previous week: {score.history.at(-1)?.value}/100</p>}</Card>
      <Card><Label>Safe to spend until {date(data.nextIncome.date)}</Label><p className="mt-3 text-4xl font-bold">{money(data.safeToSpendPence)}</p><p className="mt-3 text-sm text-[var(--color-text-muted)]">{data.daysToNextIncome} day{data.daysToNextIncome === 1 ? "" : "s"} until {data.nextIncome.name} ({money(data.nextIncome.amountPence)})</p><div className="mt-6 border-t border-[var(--color-border)] pt-4"><Label>Current balance</Label><p className="mt-1 text-2xl font-semibold">{money(data.balancePence)}</p></div></Card>
    </div>
    <Card><Label>Next bill</Label><div className="mt-2 flex items-end justify-between gap-4"><div><p className="font-semibold">{data.nextBill.name}</p><p className="text-sm text-[var(--color-text-muted)]">{date(data.nextBill.date)}</p></div><p className="text-xl font-bold">{money(data.nextBill.amountPence)}</p></div></Card>
    <Card className="bg-[var(--color-accent-bg)]"><Label>Worth knowing</Label><p className="mt-2 text-lg font-medium leading-snug">{data.insight}</p></Card>
    <section><div className="mb-3 flex items-center justify-between"><h2 className="text-xl font-bold">Recent checkouts</h2><Link href="/purchases" className="text-sm font-semibold text-[var(--color-accent)]">Purchases →</Link></div><div className="space-y-3">{data.recentAssessments.length ? data.recentAssessments.map(a => <Card key={a.id}><div className="flex items-start justify-between gap-3"><div><p className="font-semibold">{a.merchant}</p><p className="mt-1 text-sm text-[var(--color-text-muted)]">{a.headline}</p><p className="mt-2 text-xs text-[var(--color-text-muted)]">{date(a.createdAt)} · {a.decision.replaceAll("_", " ")}</p></div><p className="shrink-0 font-bold">{money(a.totalPence)}</p></div><AssessmentFactors id={a.id} score={a.regretRisk} /></Card>) : <Card><p className="text-sm text-[var(--color-text-muted)]">No checkouts yet.</p></Card>}</div></section>
  </div>;
}
