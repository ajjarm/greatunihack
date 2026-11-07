"use client";

import { useCallback, useEffect, useState } from "react";
import { CATEGORY_LABELS, type Category, type Pence } from "@/lib/types";

export const money = (pence: Pence) => new Intl.NumberFormat("en-GB", { style: "currency", currency: "GBP" }).format(pence / 100);
export const date = (value: string) => new Intl.DateTimeFormat("en-GB", { timeZone: "Europe/London", day: "numeric", month: "short", year: "numeric" }).format(new Date(value));
export const dayKey = (value: string) => {
  const parts = new Intl.DateTimeFormat("en-GB", { timeZone: "Europe/London", year: "numeric", month: "2-digit", day: "2-digit" }).formatToParts(new Date(value));
  const get = (type: string) => parts.find(part => part.type === type)?.value ?? "";
  return `${get("year")}-${get("month")}-${get("day")}`;
};
export const category = (value: Category) => CATEGORY_LABELS[value];

export async function api<T>(path: string, init?: RequestInit): Promise<T> {
  const response = await fetch(`/api/${path}`, { cache: "no-store", ...init, headers: { "Content-Type": "application/json", ...init?.headers } });
  const body = await response.json();
  if (!response.ok) throw new Error(body.error || `Request failed (${response.status})`);
  return body as T;
}

export function useApi<T>(path: string) {
  const [data, setData] = useState<T | null>(null);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);
  const reload = useCallback(async () => {
    try { setError(""); setData(await api<T>(path)); }
    catch (e) { setError(e instanceof Error ? e.message : "Could not load data"); }
    finally { setLoading(false); }
  }, [path]);
  useEffect(() => { void reload(); }, [reload]);
  return { data, setData, error, loading, reload };
}

export function Card({ children, className = "", id }: { children: React.ReactNode; className?: string; id?: string }) {
  return <section id={id} className={`dashboard-card scroll-mt-6 border border-[var(--color-border)] bg-[var(--color-surface)] p-5 shadow-[var(--shadow-card)] ${className}`} style={{ borderRadius: "var(--radius-lg)" }}>{children}</section>;
}
export function Label({ children }: { children: React.ReactNode }) { return <p className="text-xs font-semibold uppercase tracking-widest text-[var(--color-text-muted)]">{children}</p>; }
export function Button({ children, onClick, disabled, variant = "default", type = "button" }: { children: React.ReactNode; onClick?: () => void; disabled?: boolean; variant?: "default" | "quiet" | "danger"; type?: "button" | "submit" }) {
  const colors = variant === "danger" ? "bg-[var(--color-stop-bg)] text-[var(--color-stop)]" : variant === "quiet" ? "bg-[var(--color-surface-2)] text-[var(--color-text)]" : "bg-[var(--color-accent)] text-[var(--color-surface)]";
  return <button type={type} onClick={onClick} disabled={disabled} className={`min-h-11 px-4 py-2 text-sm font-semibold transition-opacity duration-[var(--motion-fast)] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--color-accent)] disabled:opacity-50 ${colors}`} style={{ borderRadius: "var(--radius-sm)" }}>{children}</button>;
}
export function Chip({ children, tone = "neutral" }: { children: React.ReactNode; tone?: "neutral" | "accent" | "go" | "think" | "stop" }) {
  const colors = tone === "accent" ? "bg-[var(--color-accent-bg)] text-[var(--color-accent)]" : tone === "go" ? "bg-[var(--color-go-bg)] text-[var(--color-go)]" : tone === "think" ? "bg-[var(--color-think-bg)] text-[var(--color-think)]" : tone === "stop" ? "bg-[var(--color-stop-bg)] text-[var(--color-stop)]" : "bg-[var(--color-surface-2)] text-[var(--color-text-muted)]";
  return <span className={`dashboard-chip inline-flex px-2 py-1 text-xs font-medium ${colors}`} style={{ borderRadius: "var(--radius-sm)" }}>{children}</span>;
}
export function Bar({ value, max = 100, tone = "accent" }: { value: number; max?: number; tone?: "accent" | "go" | "think" | "stop" }) {
  const color = { accent: "var(--color-accent)", go: "var(--color-go)", think: "var(--color-think)", stop: "var(--color-stop)" }[tone];
  return <div className="h-2 w-full overflow-hidden bg-[var(--color-surface-2)]" style={{ borderRadius: "var(--radius-sm)" }}><div className="dashboard-bar-fill h-full" style={{ width: `${Math.min(100, Math.max(0, max ? value / max * 100 : 0))}%`, backgroundColor: color, borderRadius: "var(--radius-sm)" }} /></div>;
}
export function ScoreDial({ value, tone }: { value: number; tone: "accent" | "go" | "think" | "stop" }) {
  const score = Math.min(100, Math.max(0, value));
  const outerLength = 2 * Math.PI * 108;
  const bandLength = 2 * Math.PI * 87;
  const angle = score / 100 * 2 * Math.PI - Math.PI / 2;
  const bands = [
    { from: 0, to: 50, color: "var(--color-stop)" },
    { from: 50, to: 75, color: "var(--color-think)" },
    { from: 75, to: 90, color: "var(--color-go)" },
    { from: 90, to: 100, color: "var(--color-accent)" },
  ];
  return <div role="meter" aria-label="Spend Score" aria-valuemin={0} aria-valuemax={100} aria-valuenow={score} className="dashboard-score-dial relative grid h-56 w-56 shrink-0 place-items-center sm:h-64 sm:w-64">
    <span aria-hidden="true" className="absolute inset-[9%] rounded-full bg-[var(--color-surface-2)] opacity-50 blur-2xl" />
    <svg aria-hidden="true" viewBox="0 0 240 240" className="absolute inset-0 h-full w-full overflow-visible">
      <circle cx="120" cy="120" r="108" fill="none" stroke="var(--color-surface-2)" strokeWidth="8" />
      <circle cx="120" cy="120" r="98" fill="none" stroke="var(--color-border)" strokeWidth="1" strokeDasharray="1 8" className="dashboard-score-orbit" />
      {bands.map(band => <circle key={band.from} cx="120" cy="120" r="87" fill="none" stroke={band.color} strokeWidth="4" strokeDasharray={`${(band.to - band.from - 1) / 100 * bandLength} ${bandLength}`} strokeDashoffset={-(band.from + 0.5) / 100 * bandLength} transform="rotate(-90 120 120)" />)}
      <circle cx="120" cy="120" r="108" fill="none" stroke={`var(--color-${tone})`} strokeWidth="8" strokeLinecap="round" strokeDasharray={`${outerLength} ${outerLength}`} strokeDashoffset={outerLength * (1 - score / 100)} transform="rotate(-90 120 120)" className="dashboard-score-progress" />
      {score > 0 && <circle cx={120 + 108 * Math.cos(angle)} cy={120 + 108 * Math.sin(angle)} r="5" fill="var(--color-surface)" stroke={`var(--color-${tone})`} strokeWidth="3" />}
    </svg>
    <div className="relative flex h-[58%] w-[58%] flex-col items-center justify-center rounded-full border border-[var(--color-border)] bg-[var(--color-surface)] shadow-[var(--shadow-card)]">
      <span className="text-[9px] font-bold uppercase tracking-[0.22em] text-[var(--color-text-muted)] sm:text-[10px]">Spend Score</span>
      <span className="mt-1 text-6xl font-black leading-none tracking-tight sm:text-7xl" style={{ color: `var(--color-${tone})` }}>{score}</span>
      <span className="mt-1 text-xs font-semibold text-[var(--color-text-muted)]">of 100</span>
    </div>
  </div>;
}
export function PageState({ loading, error, retry }: { loading: boolean; error: string; retry: () => void }) {
  if (loading) return <Card><p role="status" className="text-[var(--color-text-muted)]">Loading your dashboard…</p></Card>;
  if (error) return <Card><p role="alert">{error}</p><div className="mt-4"><Button onClick={retry}>Try again</Button></div></Card>;
  return null;
}
