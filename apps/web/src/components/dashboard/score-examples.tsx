"use client";

import { useEffect, useState } from "react";
import { Bar, Button, Card, Label, money } from "@/components/dashboard/shared";
import { ScoreInfo } from "@/components/dashboard/score-info";

type Tone = "stop" | "think" | "go" | "accent";
type SampleWeek = { label: string; tone: Tone; value: number; heeded: number; limitsKept: number; avoidedPence: number };

const examples: { label: string; tone: Tone; score: [number, number]; heeded: [number, number]; limitsKept: [number, number]; avoidedPence: [number, number] }[] = [
  { label: "Tough week", tone: "stop", score: [18, 49], heeded: [1, 3], limitsKept: [0, 1], avoidedPence: [0, 2500] },
  { label: "Finding a rhythm", tone: "think", score: [50, 74], heeded: [3, 5], limitsKept: [2, 2], avoidedPence: [2500, 6500] },
  { label: "On track", tone: "go", score: [75, 89], heeded: [5, 7], limitsKept: [3, 3], avoidedPence: [6500, 12000] },
  { label: "Very good", tone: "accent", score: [90, 100], heeded: [7, 8], limitsKept: [4, 4], avoidedPence: [12000, 20000] },
];

const randomInt = ([min, max]: [number, number]) => min + Math.floor(Math.random() * (max - min + 1));
const makeExamples = (): SampleWeek[] => examples.map(example => ({
  label: example.label,
  tone: example.tone,
  value: randomInt(example.score),
  heeded: randomInt(example.heeded),
  limitsKept: randomInt(example.limitsKept),
  avoidedPence: randomInt(example.avoidedPence),
}));

const initialExamples: SampleWeek[] = [
  { label: "Tough week", tone: "stop", value: 31, heeded: 2, limitsKept: 1, avoidedPence: 1400 },
  { label: "Finding a rhythm", tone: "think", value: 62, heeded: 4, limitsKept: 2, avoidedPence: 4600 },
  { label: "On track", tone: "go", value: 82, heeded: 6, limitsKept: 3, avoidedPence: 8900 },
  { label: "Very good", tone: "accent", value: 95, heeded: 8, limitsKept: 4, avoidedPence: 15800 },
];

export function ScoreExamples() {
  const [samples, setSamples] = useState(initialExamples);
  // randomise only after hydration so server and client render the same first frame
  // eslint-disable-next-line react-hooks/set-state-in-effect
  useEffect(() => { setSamples(makeExamples()); }, []);

  return <Card>
    <div className="flex flex-wrap items-start justify-between gap-3"><div><Label>Demo preview</Label><h2 className="mt-1 text-xl font-bold">Explore Spend Score levels</h2><p className="mt-1 text-sm text-[var(--color-text-muted)]">Illustrative weeks showing how the four score levels look.</p></div><Button variant="quiet" onClick={() => setSamples(makeExamples())}>Shuffle examples</Button></div>
    <div className="mt-5 grid grid-cols-2 gap-3 lg:grid-cols-4" aria-live="polite">{samples.map(sample => <div key={sample.label} className="border border-[var(--color-border)] bg-[var(--color-surface-2)] p-4" style={{ borderRadius: "var(--radius-md)" }}>
      <p className="text-xs font-semibold text-[var(--color-text-muted)]">{sample.label}</p>
      <ScoreInfo label={`Illustrative Spend Score: ${sample.value} of 100`} details={<><p>This is a randomly generated example of the {sample.label.toLowerCase()} level, not a score from your account.</p><p>Example signals: {sample.heeded} of 8 nudges heeded and {sample.limitsKept} of 4 weekly limits kept. Later feedback and cash position also affect a real score.</p></>} className={`mt-1 text-4xl font-bold ${sample.tone === "stop" ? "text-[var(--color-stop)]" : sample.tone === "think" ? "text-[var(--color-think)]" : sample.tone === "go" ? "text-[var(--color-go)]" : "text-[var(--color-accent)]"}`}>{sample.value}<span className="text-sm font-medium text-[var(--color-text-muted)]">/100</span></ScoreInfo>
      <div className="mt-3"><Bar value={sample.value} tone={sample.tone} /></div>
      <p className="mt-3 text-xs leading-relaxed text-[var(--color-text-muted)]">{sample.heeded} of 8 nudges heeded · {sample.limitsKept} of 4 limits kept</p>
      <p className="mt-2 text-xs font-semibold">{money(sample.avoidedPence)} kept · estimated</p>
    </div>)}</div>
    <p className="mt-3 text-xs text-[var(--color-text-muted)]">Sample figures are for display only. The real score above uses nudges, later feedback, limits and cash position.</p>
  </Card>;
}
