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

export function Card({ children, className = "" }: { children: React.ReactNode; className?: string }) {
  return <section className={`border border-[var(--color-border)] bg-[var(--color-surface)] p-5 shadow-[var(--shadow-card)] ${className}`} style={{ borderRadius: "var(--radius-lg)" }}>{children}</section>;
}
export function Label({ children }: { children: React.ReactNode }) { return <p className="text-xs font-semibold uppercase tracking-widest text-[var(--color-text-muted)]">{children}</p>; }
export function Button({ children, onClick, disabled, variant = "default", type = "button" }: { children: React.ReactNode; onClick?: () => void; disabled?: boolean; variant?: "default" | "quiet" | "danger"; type?: "button" | "submit" }) {
  const colors = variant === "danger" ? "bg-[var(--color-stop-bg)] text-[var(--color-stop)]" : variant === "quiet" ? "bg-[var(--color-surface-2)] text-[var(--color-text)]" : "bg-[var(--color-accent)] text-[var(--color-surface)]";
  return <button type={type} onClick={onClick} disabled={disabled} className={`min-h-11 px-4 py-2 text-sm font-semibold transition-opacity duration-[var(--motion-fast)] disabled:opacity-50 ${colors}`} style={{ borderRadius: "var(--radius-sm)" }}>{children}</button>;
}
export function Chip({ children, tone = "neutral" }: { children: React.ReactNode; tone?: "neutral" | "go" | "think" | "stop" }) {
  const colors = tone === "go" ? "bg-[var(--color-go-bg)] text-[var(--color-go)]" : tone === "think" ? "bg-[var(--color-think-bg)] text-[var(--color-think)]" : tone === "stop" ? "bg-[var(--color-stop-bg)] text-[var(--color-stop)]" : "bg-[var(--color-surface-2)] text-[var(--color-text-muted)]";
  return <span className={`inline-flex px-2 py-1 text-xs font-medium ${colors}`} style={{ borderRadius: "var(--radius-sm)" }}>{children}</span>;
}
export function Bar({ value, max = 100, tone = "accent" }: { value: number; max?: number; tone?: "accent" | "go" | "think" | "stop" }) {
  const color = { accent: "var(--color-accent)", go: "var(--color-go)", think: "var(--color-think)", stop: "var(--color-stop)" }[tone];
  return <div className="h-2 w-full overflow-hidden bg-[var(--color-surface-2)]" style={{ borderRadius: "var(--radius-sm)" }}><div className="h-full" style={{ width: `${Math.min(100, Math.max(0, max ? value / max * 100 : 0))}%`, backgroundColor: color, borderRadius: "var(--radius-sm)" }} /></div>;
}
export function ScoreDial({ value, tone }: { value: number; tone: "go" | "think" | "stop" }) {
  const score = Math.min(100, Math.max(0, value));
  return <div role="meter" aria-label="Spend Score" aria-valuemin={0} aria-valuemax={100} aria-valuenow={score} className="flex h-32 w-32 shrink-0 items-center justify-center p-2" style={{ borderRadius: "50%", background: `conic-gradient(var(--color-${tone}) ${score}%, var(--color-surface-2) ${score}%)` }}><div className="flex h-full w-full flex-col items-center justify-center bg-[var(--color-surface)]" style={{ borderRadius: "50%" }}><span className="text-4xl font-bold">{score}</span><span className="text-xs text-[var(--color-text-muted)]">of 100</span></div></div>;
}
export function PageState({ loading, error, retry }: { loading: boolean; error: string; retry: () => void }) {
  if (loading) return <Card><p role="status" className="text-[var(--color-text-muted)]">Loading your dashboard…</p></Card>;
  if (error) return <Card><p role="alert">{error}</p><div className="mt-4"><Button onClick={retry}>Try again</Button></div></Card>;
  return null;
}
