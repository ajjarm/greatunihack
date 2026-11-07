"use client";

import { useState } from "react";
import type { Report } from "@/lib/types";
import { ScoreDial, money } from "@/components/dashboard/shared";

type Tone = "accent" | "go" | "think" | "stop";

export function SpendScoreBreakdown({ value, tone, report, current, explanation, safeToSpendPence }: { value: number; tone: Tone; report: Report | null; current: boolean; explanation: string; safeToSpendPence: number }) {
  const [open, setOpen] = useState(false);

  return <div className="relative mx-auto shrink-0" onMouseEnter={() => setOpen(true)} onMouseLeave={() => setOpen(false)} onBlur={event => { if (!event.currentTarget.contains(event.relatedTarget)) setOpen(false); }} onKeyDown={event => { if (event.key === "Escape") setOpen(false); }}>
    <button type="button" aria-expanded={open} aria-controls="spend-score-breakdown" aria-label={`Spend Score ${value} of 100. Show breakdown.`} onFocus={() => setOpen(true)} onClick={() => setOpen(true)} className="block focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--color-accent)]" style={{ borderRadius: "50%" }}><ScoreDial value={value} tone={tone} /></button>
    {open && <div id="spend-score-breakdown" role="dialog" aria-label="Spend Score breakdown" className="dashboard-pop dashboard-score-popover absolute top-full z-30 w-80 max-w-[calc(100vw-3rem)] border border-[var(--color-border)] bg-[var(--color-surface)] p-4 text-left shadow-[var(--shadow-float)]" style={{ borderRadius: "var(--radius-md)" }}>
      <div className="flex items-start justify-between gap-3"><h3 className="text-base font-bold">How this score is judged</h3><button type="button" onClick={() => setOpen(false)} aria-label="Close Spend Score breakdown" className="text-sm font-bold text-[var(--color-text-muted)] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--color-accent)]">✕</button></div>
      <ul className="mt-3 space-y-3 text-xs leading-relaxed">
        <li><strong className="text-[var(--color-accent)]">Nudge choices</strong><p>{report ? `${report.heeded} of ${report.nudgesShown} nudges heeded that week.` : "Pausing on a risky checkout can help the score."}</p></li>
        <li><strong className="text-[var(--color-accent)]">Later outcomes</strong><p>{report ? `${report.overriddenHappy} overrides later felt good; ${report.overriddenRegretted} were regretted.` : "Happy and regretted feedback shapes how overrides are judged."}</p></li>
        <li><strong className="text-[var(--color-accent)]">Weekly limits</strong><p>{report ? `${report.limitsKept} kept, ${report.limitsExceeded} exceeded.` : "Keeping category limits helps; exceeding them can lower the score."}</p></li>
        <li><strong className="text-[var(--color-accent)]">Cash position</strong><p>{current ? `Safe to spend now: ${money(safeToSpendPence)}. Upcoming bills and income also matter.` : "The cash position for this past week is not available in the report."}</p></li>
      </ul>
      {current && <p className="mt-3 border-t border-[var(--color-border)] pt-3 text-xs text-[var(--color-text-muted)]">{explanation}</p>}
      <p className="mt-3 text-[11px] leading-relaxed text-[var(--color-text-muted)]">The agent judges these together. They do not add up as fixed points, and spending alone does not lower the score.</p>
    </div>}
  </div>;
}
