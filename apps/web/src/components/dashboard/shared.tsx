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
  // first load: state is only set from the promise callbacks, never synchronously in the effect
  useEffect(() => {
    let live = true;
    api<T>(path)
      .then(next => { if (live) { setData(next); setError(""); } })
      .catch(e => { if (live) setError(e instanceof Error ? e.message : "Could not load data"); })
      .finally(() => { if (live) setLoading(false); });
    return () => { live = false; };
  }, [path]);
  return { data, setData, error, loading, reload };
}

type Tone = "accent" | "go" | "think" | "stop";

/** Glass card (DESIGN 3.1). The material sits on ::before/::after in motion.css. */
export function Card({ children, className = "", id, style }: { children: React.ReactNode; className?: string; id?: string; style?: React.CSSProperties }) {
  return <section id={id} className={`dashboard-card scroll-mt-6 ${className}`} style={style}>{children}</section>;
}
/** 12px muted label, sentence case. */
export function Label({ children }: { children: React.ReactNode }) { return <p className="ds-label">{children}</p>; }
/** Pill button: default is the one primary (accent), quiet is secondary, danger is secondary in coral. */
export function Button({ children, onClick, disabled, variant = "default", type = "button" }: { children: React.ReactNode; onClick?: () => void; disabled?: boolean; variant?: "default" | "quiet" | "danger"; type?: "button" | "submit" }) {
  const kind = variant === "danger" ? "ds-btn-danger" : variant === "quiet" ? "ds-btn-sec" : "ds-btn-acc";
  return <button type={type} onClick={onClick} disabled={disabled} className={`ds-btn ${kind}`}>{children}</button>;
}
/** Status chip: band colour on the band colour at 12%. Always words, never colour alone. */
export function Chip({ children, tone = "neutral" }: { children: React.ReactNode; tone?: "neutral" | Tone }) {
  return <span className={`dashboard-chip ds-chip ds-chip-${tone}`}>{children}</span>;
}
/** Flat 6px bar: solid fill on a --color-fill-2 track, grows from the left. */
export function Bar({ value, max = 100, tone = "accent" }: { value: number; max?: number; tone?: Tone | "white" }) {
  const color = { accent: "var(--color-accent)", go: "var(--color-go)", think: "var(--color-think)", stop: "var(--color-stop)", white: "var(--color-text)" }[tone];
  return <div className="ds-bar"><i style={{ width: `${Math.min(100, Math.max(0, max ? value / max * 100 : 0))}%`, backgroundColor: color }} /></div>;
}
/** Spend Score: the display number with /100 (DESIGN 4, Home). */
export function ScoreDial({ value, tone }: { value: number; tone: Tone }) {
  const score = Math.min(100, Math.max(0, value));
  return <span role="meter" aria-label="Spend Score" aria-valuemin={0} aria-valuemax={100} aria-valuenow={score} className="inline-flex items-baseline gap-2">
    <span className="ds-display" data-tone={tone}>{score}</span>
    <span className="text-xl font-medium text-[var(--color-text-dim)]">/100</span>
  </span>;
}
/** Inset tile inside a card: flat --color-fill. */
export function Tile({ children, className = "" }: { children: React.ReactNode; className?: string }) {
  return <div className={`ds-tile ${className}`}>{children}</div>;
}
/** Money with dimmed decimals: £412<span>.00</span>. */
export function MoneyFigure({ pence }: { pence: Pence }) {
  const text = money(pence);
  const dot = text.lastIndexOf(".");
  return dot < 0 ? <>{text}</> : <>{text.slice(0, dot)}<span className="ds-dec">{text.slice(dot)}</span></>;
}
/** Page header: title 28/500, one muted sentence, optional action on the right. */
export function PageHeader({ title, sub, action }: { title: string; sub?: React.ReactNode; action?: React.ReactNode }) {
  return <header className="mb-1 flex flex-col items-start gap-3 md:flex-row md:items-end md:justify-between md:gap-5">
    <div className="min-w-0"><h1 className="ds-h1">{title}</h1>{sub && <p className="ds-sub">{sub}</p>}</div>
    {action}
  </header>;
}
/** Segmented control: --color-fill track, selected segment on --color-fill-2. */
export function Segmented<T extends string>({ value, options, onChange, label }: { value: T; options: { value: T; label: string }[]; onChange: (value: T) => void; label: string }) {
  return <div role="group" aria-label={label} className="ds-seg">{options.map(option => <button key={option.value} type="button" aria-pressed={value === option.value} onClick={() => onChange(option.value)}>{option.label}</button>)}</div>;
}
/** 34px merchant mark with the initial. */
export function MerchantMark({ name }: { name: string }) {
  return <span aria-hidden="true" className="ds-mark">{name.trim().charAt(0).toUpperCase() || "?"}</span>;
}
export function PageState({ loading, error, retry }: { loading: boolean; error: string; retry: () => void }) {
  if (loading) return <Card><p role="status" className="text-[var(--color-text-muted)]">Having a look…</p></Card>;
  if (error) return <Card><p role="alert">{error}</p><div className="mt-4"><Button onClick={retry}>Try again</Button></div></Card>;
  return null;
}
