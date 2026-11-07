"use client";

import type { ReactNode } from "react";
import type { Feedback } from "@/lib/types";
import "./pages.css";

export type BandName = "go" | "think" | "stop";
/** Regret-risk bands (DESIGN.md §2.1): go 0–39, think 40–69, stop 70+. */
export const bandOf = (risk: number): BandName => (risk >= 70 ? "stop" : risk >= 40 ? "think" : "go");
export const BAND_VAR: Record<BandName, string> = { go: "var(--color-go)", think: "var(--color-think)", stop: "var(--color-stop)" };

export function PageHeader({ title, sub, children }: { title: string; sub: ReactNode; children?: ReactNode }) {
  return <header className="pg-head">
    <div className="min-w-0"><h1 className="pg-title">{title}</h1><p className="pg-sub">{sub}</p></div>
    {children}
  </header>;
}

export function Segmented<T extends string>({ value, options, onChange, label }: { value: T; options: { value: T; label: string }[]; onChange: (v: T) => void; label: string }) {
  return <div className="pg-seg" role="group" aria-label={label}>
    {options.map(o => <button key={o.value} type="button" aria-pressed={value === o.value} onClick={() => onChange(o.value)}>{o.label}</button>)}
  </div>;
}

export function Mark({ name }: { name: string }) {
  return <span className="pg-mark" aria-hidden="true">{name.trim().charAt(0).toUpperCase() || "?"}</span>;
}

export function PgChip({ children, tone }: { children: ReactNode; tone?: BandName }) {
  return <span className={`pg-chip ${tone ?? ""}`}>{children}</span>;
}

export function FlatBar({ value, max = 100, color = "var(--color-text)", goal }: { value: number; max?: number; color?: string; goal?: boolean }) {
  const pct = Math.min(100, Math.max(0, max ? (value / max) * 100 : 0));
  return <div className={`pg-bar${goal ? " goal" : ""}`} aria-hidden="true"><i style={{ width: `${Math.max(pct, value > 0 ? 2 : 0)}%`, background: color }} /></div>;
}

const FACE: Record<Feedback, ReactNode> = {
  happy: <path d="M8 13.5c1 1.2 2.3 1.8 4 1.8s3-.6 4-1.8" />,
  unsure: <path d="M8.5 14.5h7" />,
  regretted: <path d="M8 15.8c1-1.2 2.3-1.8 4-1.8s3 .6 4 1.8" />,
};
export function FaceIcon({ kind, size = 18 }: { kind: Feedback; size?: number }) {
  return <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" aria-hidden="true">
    <circle cx="12" cy="12" r="9" />
    <circle cx="9" cy="10" r=".6" fill="currentColor" /><circle cx="15" cy="10" r=".6" fill="currentColor" />
    {FACE[kind]}
  </svg>;
}

export const FEEDBACK_ORDER: Feedback[] = ["happy", "unsure", "regretted"];
export const FEEDBACK_LABEL: Record<Feedback, string> = { happy: "Happy", unsure: "Unsure", regretted: "Regretted" };

/** Three round face buttons in a fill pill. Selected fills with its band colour. */
export function FeedbackControl({ value, item, disabled, onPick }: { value: Feedback | null; item: string; disabled?: boolean; onPick: (f: Feedback) => void }) {
  return <div className="pg-fbset" role="group" aria-label={`How do you feel about ${item}?`}>
    {FEEDBACK_ORDER.map(f => <button key={f} type="button" className="pg-fb" data-v={f} aria-pressed={value === f} aria-label={FEEDBACK_LABEL[f]} title={FEEDBACK_LABEL[f]} disabled={disabled} onClick={() => onPick(f)}><FaceIcon kind={f} /></button>)}
  </div>;
}

export function TickIcon() {
  return <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M5 12.5l4.5 4.5L19 7.5" /></svg>;
}
export function SendIcon() {
  return <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M12 19V5M5.5 11.5L12 5l6.5 6.5" /></svg>;
}
