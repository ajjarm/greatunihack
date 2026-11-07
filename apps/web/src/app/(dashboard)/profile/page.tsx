"use client";

import { useEffect, useState, type FormEvent } from "react";
import { CATEGORY_LABELS, type Persona } from "@/lib/types";
import { api, Button, Card, Chip, Label, PageState, date, money, useApi } from "@/components/dashboard/shared";

type Message = { from: "you" | "agent"; text: string; changes?: string[] };
export default function ProfilePage() {
  const { data, setData, error, loading, reload } = useApi<Persona>("memory");
  const [message, setMessage] = useState("");
  const [messages, setMessages] = useState<Message[]>([]);
  const [busy, setBusy] = useState(false);
  const [actionError, setActionError] = useState("");
  const [quiet, setQuiet] = useState(false);
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState({ name: "", goalName: "", target: "", saved: "" });
  useEffect(() => { if (data && !editing) setDraft({ name: data.name, goalName: data.goal.name, target: String(data.goal.targetPence / 100), saved: String(data.goal.savedPence / 100) }); }, [data, editing]);
  async function send(e: FormEvent) {
    e.preventDefault(); const text = message.trim(); if (!text || busy) return;
    setMessage(""); setMessages(v => [...v, { from: "you", text }]); setBusy(true); setActionError("");
    try {
      const result = await api<{ reply: string; changes: string[] }>("memory/chat", { method: "POST", body: JSON.stringify({ message: text }) });
      setMessages(v => [...v, { from: "agent", text: result.reply, changes: result.changes }]);
      await reload();
    } catch (e) { setActionError(e instanceof Error ? e.message : "Could not send message"); }
    finally { setBusy(false); }
  }
  async function save(e: FormEvent) {
    e.preventDefault(); if (!data) return;
    const targetPence = Math.round(Number(draft.target) * 100), savedPence = Math.round(Number(draft.saved) * 100);
    if (!draft.name.trim() || !draft.goalName.trim() || !Number.isFinite(targetPence) || !Number.isFinite(savedPence) || targetPence < 0 || savedPence < 0) { setActionError("Enter a name and valid goal amounts."); return; }
    setBusy(true); setActionError("");
    try {
      const updated = await api<Persona>("memory", { method: "PUT", body: JSON.stringify({ name: draft.name.trim(), goal: { ...data.goal, name: draft.goalName.trim(), targetPence, savedPence } }) });
      setData(updated); setEditing(false);
    } catch (e) { setActionError(e instanceof Error ? e.message : "Could not save your profile"); }
    finally { setBusy(false); }
  }
  if (!data) return <PageState loading={loading} error={error} retry={reload} />;
  return <div className="space-y-5"><header><Label>Your settings</Label><h1 className="mt-1 text-3xl font-bold">Profile</h1><p className="mt-2 text-sm text-[var(--color-text-muted)]">Tell the agent what matters to you.</p></header>{actionError && <p role="alert" className="text-sm text-[var(--color-stop)]">{actionError}</p>}
    <Card><h2 className="text-xl font-bold">Talk to your agent</h2><p className="mt-1 text-sm text-[var(--color-text-muted)]">Try “limit clothes to £60 a week” or “no trainers until exams are over”.</p><div aria-live="polite" className="mt-4 max-h-80 space-y-3 overflow-y-auto">{messages.map((m, i) => <div key={i} className={`max-w-[90%] p-3 text-sm ${m.from === "you" ? "ml-auto bg-[var(--color-accent-bg)]" : "bg-[var(--color-surface-2)]"}`} style={{ borderRadius: "var(--radius-md)" }}><p>{m.text}</p>{m.changes && m.changes.length > 0 && <div className="mt-2 flex flex-wrap gap-1">{m.changes.map((c, j) => <Chip key={j} tone="go">{c}</Chip>)}</div>}</div>)}{!messages.length && <p className="text-sm text-[var(--color-text-muted)]">Your conversation will appear here.</p>}</div><form onSubmit={send} className="mt-4 flex gap-2"><input aria-label="Message your agent" value={message} onChange={e => setMessage(e.target.value)} placeholder="Tell me a rule or limit…" className="min-h-11 min-w-0 flex-1 border border-[var(--color-border)] bg-[var(--color-surface)] px-3 text-sm" style={{ borderRadius: "var(--radius-sm)" }} /><Button type="submit" disabled={busy || !message.trim()}>Send</Button></form></Card>
    <Card><div className="flex items-center justify-between gap-3"><h2 className="text-xl font-bold">Your details</h2><Button variant="quiet" onClick={() => setEditing(!editing)}>{editing ? "Cancel" : "Edit"}</Button></div>{editing ? <form onSubmit={save} className="mt-4 grid gap-3 sm:grid-cols-2">{([ ["name", "Name"], ["goalName", "Goal name"], ["target", "Goal target (£)"], ["saved", "Saved so far (£)"] ] as const).map(([key, label]) => <label key={key} className="text-sm font-semibold">{label}<input required value={draft[key]} onChange={e => setDraft({ ...draft, [key]: e.target.value })} type={key === "target" || key === "saved" ? "number" : "text"} min={key === "target" || key === "saved" ? "0" : undefined} step={key === "target" || key === "saved" ? "0.01" : undefined} className="mt-1 min-h-11 w-full border border-[var(--color-border)] bg-[var(--color-surface)] px-3 font-normal" style={{ borderRadius: "var(--radius-sm)" }} /></label>)}<div><Button type="submit" disabled={busy}>Save details</Button></div></form> : <div className="mt-4 grid gap-4 sm:grid-cols-2"><div><Label>Name</Label><p className="mt-1 font-semibold">{data.name}</p></div><div><Label>Hourly rate</Label><p className="mt-1 font-semibold">{money(data.hourlyRatePence)}</p></div><div><Label>Balance</Label><p className="mt-1 font-semibold">{money(data.balancePence)}</p></div><div><Label>Goal</Label><p className="mt-1 font-semibold">{data.goal.name}</p><p className="text-sm text-[var(--color-text-muted)]">{money(data.goal.savedPence)} of {money(data.goal.targetPence)}</p></div></div>}</Card>
    <div className="grid gap-5 lg:grid-cols-2"><Card><h2 className="text-xl font-bold">Income</h2><div className="mt-4 space-y-3">{data.incomes.map(i => <div key={i.id} className="border-b border-[var(--color-border)] pb-3 last:border-0"><div className="flex justify-between gap-3 font-semibold"><span>{i.name}</span><span>{money(i.amountPence)}</span></div><p className="mt-1 text-xs text-[var(--color-text-muted)]">Next {date(i.nextDate)} · {i.schedule.type}</p></div>)}{!data.incomes.length && <p className="text-sm text-[var(--color-text-muted)]">No income added.</p>}</div></Card>
      <Card><h2 className="text-xl font-bold">Regular outgoings</h2><div className="mt-4 space-y-3">{data.outgoings.map(o => <div key={o.id} className="border-b border-[var(--color-border)] pb-3 last:border-0"><div className="flex justify-between gap-3 font-semibold"><span>{o.name}</span><span>{money(o.amountPence)}</span></div><p className="mt-1 text-xs text-[var(--color-text-muted)]">{CATEGORY_LABELS[o.category]} · day {o.dayOfMonth} each month</p></div>)}{!data.outgoings.length && <p className="text-sm text-[var(--color-text-muted)]">No regular outgoings added.</p>}</div></Card>
      <Card><h2 className="text-xl font-bold">Weekly limits</h2><div className="mt-4 space-y-3">{data.limits.map(l => <div key={l.category} className="flex justify-between gap-3 border-b border-[var(--color-border)] pb-3 text-sm last:border-0"><span>{CATEGORY_LABELS[l.category]}</span><strong>{money(l.weeklyLimitPence)}</strong></div>)}{!data.limits.length && <p className="text-sm text-[var(--color-text-muted)]">No limits set.</p>}</div></Card>
      <Card><h2 className="text-xl font-bold">Your rules</h2><div className="mt-4 space-y-3">{data.rules.map(r => <div key={r.id} className="border-b border-[var(--color-border)] pb-3 last:border-0"><p className="text-sm font-semibold">{r.text}</p><div className="mt-1 flex flex-wrap gap-2"><Chip tone={r.direction === "avoid" ? "think" : "go"}>{r.direction.replaceAll("_", " ")}</Chip>{r.category && <Chip>{CATEGORY_LABELS[r.category]}</Chip>}{r.until && <Chip>Until {r.until}</Chip>}</div></div>)}{!data.rules.length && <p className="text-sm text-[var(--color-text-muted)]">No rules yet.</p>}</div></Card></div>
    <Card><div className="flex items-center justify-between gap-4"><div><h2 className="text-lg font-bold">Quiet hours</h2><p className="mt-1 text-sm text-[var(--color-text-muted)]">Pause nonessential prompts on this screen.</p></div><button type="button" role="switch" aria-checked={quiet} onClick={() => setQuiet(!quiet)} className={`h-8 w-14 shrink-0 p-1 ${quiet ? "bg-[var(--color-accent)]" : "bg-[var(--color-surface-2)]"}`} style={{ borderRadius: "var(--radius-lg)" }}><span className="block h-6 w-6 bg-[var(--color-surface)] shadow-[var(--shadow-card)] transition-transform duration-[var(--motion-base)]" style={{ borderRadius: "var(--radius-lg)", transform: quiet ? "translateX(24px)" : "none" }} /></button></div></Card>
  </div>;
}
