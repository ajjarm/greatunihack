"use client";

import { useState } from "react";
import type { TimelinePoint } from "@/lib/types";
import { Chip, money } from "./shared";

const short = (value: string) => new Intl.DateTimeFormat("en-GB", { timeZone: "Europe/London", weekday: "short", day: "numeric", month: "short" }).format(new Date(`${value.slice(0, 10)}T12:00:00Z`));

/** Timeline strip (DESIGN 4): one 8px track, spans coloured by the balance after each event, dots for money events. */
export function Timeline({ points, regrettedPence = 0 }: { points: TimelinePoint[]; regrettedPence?: number }) {
  const [open, setOpen] = useState<number | null>(null);
  if (!points.length) return <p className="text-sm text-[var(--color-text-muted)]">No timeline yet.</p>;
  const n = Math.max(1, points.length - 1);
  const pos = (i: number) => (i / n) * 100;
  const events = points.flatMap((p, i) => p.events.map(event => ({ ...event, date: p.date, i, after: p.projectedPence })));
  const overdrawnDays = points.filter(p => p.projectedPence < 0).length;
  const low = points.reduce((min, p) => (p.projectedPence < min.projectedPence ? p : min), points[0]);
  const payday = events.find(e => e.type === "income");
  const lowBill = [...events].filter(e => e.type !== "income").sort((a, b) => a.after - b.after)[0];
  const rows = [payday, lowBill].filter((e): e is (typeof events)[number] => Boolean(e)).sort((a, b) => a.i - b.i);
  // spans: each starts at an event (or today) and is coloured by the balance after it
  const starts = [0, ...events.map(e => e.i).filter(i => i > 0)].filter((v, idx, arr) => arr.indexOf(v) === idx).sort((a, b) => a - b);
  const spans = starts.map((s, k) => ({ from: s, to: starts[k + 1] ?? points.length - 1, negative: points[s].projectedPence < 0 }));

  return <div className="relative">
    <div className="flex flex-wrap items-center justify-between gap-2">
      {overdrawnDays > 0
        ? <p className="text-sm font-medium text-[var(--color-stop)]">Overdrawn on {overdrawnDays} of the next {points.length} days</p>
        : <><p className="text-sm text-[var(--color-text-muted)]">Lowest point {money(low.projectedPence)} on {short(low.date)}</p><Chip tone="go">Above £0</Chip></>}
    </div>
    <div className="ds-strip" aria-hidden="true">
      {spans.map(span => <span key={span.from} className="ds-seg-fill" style={{ left: `${pos(span.from)}%`, width: `${Math.max(0.5, pos(span.to) - pos(span.from))}%`, background: span.negative ? "var(--color-stop)" : "color-mix(in srgb, var(--color-text) 45%, transparent)" }} />)}
    </div>
    <div className="relative mx-[7px] -mt-[8px] h-[8px]">
      {events.map((e, k) => <button key={`${e.date}-${e.name}-${k}`} type="button" className="ds-tdot" data-kind={e.type === "income" ? "pay" : "bill"} style={{ left: `${pos(e.i)}%` }} aria-expanded={open === k} aria-label={`${e.name}, ${short(e.date)}: ${e.type === "income" ? "+" : "−"}${money(Math.abs(e.amountPence))}. ${money(e.after)} after it.`} onMouseEnter={() => setOpen(k)} onMouseLeave={() => setOpen(null)} onFocus={() => setOpen(k)} onBlur={() => setOpen(null)} onClick={() => setOpen(open === k ? null : k)} />)}
      {open !== null && events[open] && <div role="tooltip" className="ds-pop dashboard-pop top-5 w-[250px]" style={{ left: `clamp(0px, calc(${pos(events[open].i)}% - 40px), calc(100% - 250px))` }}>
        <p className="ds-label">{events[open].name} · {short(events[open].date)}</p>
        <p className="mt-1">{events[open].type === "income" ? "+" : "−"}{money(Math.abs(events[open].amountPence))}. You&apos;ll have {money(events[open].after)} after it.</p>
      </div>}
    </div>
    <div className="mt-2.5 flex justify-between text-xs text-[var(--color-text-muted)]"><span>Today</span><span>{short(points.at(-1)!.date)}</span></div>
    {rows.length > 0 && <div className="mt-1">{rows.map(e => <div key={`${e.date}-${e.name}`} className="flex items-baseline gap-3 pt-2.5 text-sm">
      <span className="w-[86px] shrink-0 text-[var(--color-text-muted)]">{short(e.date)}</span>
      <span className="min-w-0 flex-1 truncate">{e.name}</span>
      <span className="shrink-0 text-[var(--color-text-muted)]">{e.type === "income" ? "+" : "−"}{money(Math.abs(e.amountPence))}</span>
      <span className={`w-[72px] shrink-0 text-right font-semibold ${e.after < 0 ? "text-[var(--color-stop)]" : ""}`}>{money(e.after)}</span>
    </div>)}</div>}
    {regrettedPence > 0 && <p className="mt-3 text-xs text-[var(--color-text-muted)]">{money(regrettedPence)} more at every point without the purchases you regretted · estimated</p>}
  </div>;
}
