"use client";

import { useState, type FormEvent } from "react";
import { CATEGORY_LABELS, type IncomeSource, type Persona } from "@/lib/types";
import { api, Button, Card, PageState, date, money, useApi } from "@/components/dashboard/shared";
import { FlatBar, PageHeader, PgChip, SendIcon, TickIcon } from "@/components/dashboard/page-ui";

const ordinal = (n: number) => `${n}${n % 10 === 1 && n !== 11 ? "st" : n % 10 === 2 && n !== 12 ? "nd" : n % 10 === 3 && n !== 13 ? "rd" : "th"}`;

type Message = { from: "you" | "agent"; text: string; changes?: string[] };
function incomeSchedule(income: IncomeSource) {
  if (income.schedule.type === "once") return "One-off payment";
  if (income.schedule.type === "monthly") return `Monthly on day ${income.schedule.dayOfMonth}`;
  return `Fortnightly from ${date(income.schedule.nextDate)}`;
}
export default function ProfilePage() {
  const { data, setData, error, loading, reload } = useApi<Persona>("memory");
  const [message, setMessage] = useState("");
  const [messages, setMessages] = useState<Message[]>([]);
  const [busy, setBusy] = useState(false);
  const [actionError, setActionError] = useState("");
  const [quiet, setQuiet] = useState(false);
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState({ name: "", hourlyRate: "", balance: "", goalName: "", target: "", saved: "" });
  // fill the form from the saved details when editing starts
  function toggleEditing() {
    if (!editing && data) setDraft({ name: data.name, hourlyRate: String(data.hourlyRatePence / 100), balance: String(data.balancePence / 100), goalName: data.goal.name, target: String(data.goal.targetPence / 100), saved: String(data.goal.savedPence / 100) });
    setEditing(!editing);
  }
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
    const hourlyRatePence = Math.round(Number(draft.hourlyRate) * 100), balancePence = Math.round(Number(draft.balance) * 100);
    if (!draft.name.trim() || !draft.goalName.trim() || [targetPence, savedPence, hourlyRatePence, balancePence].some(value => !Number.isFinite(value)) || targetPence < 0 || savedPence < 0 || hourlyRatePence < 0) { setActionError("Enter a name and valid money amounts."); return; }
    setBusy(true); setActionError("");
    try {
      const updated = await api<Persona>("memory", { method: "PUT", body: JSON.stringify({ name: draft.name.trim(), hourlyRatePence, balancePence, goal: { ...data.goal, name: draft.goalName.trim(), targetPence, savedPence } }) });
      setData(updated); setEditing(false);
    } catch (e) { setActionError(e instanceof Error ? e.message : "Could not save your profile"); }
    finally { setBusy(false); }
  }
  if (!data) return <PageState loading={loading} error={error} retry={reload} />;
  const fields = [["name", "Name"], ["hourlyRate", "Hourly rate (£)"], ["balance", "Balance (£)"], ["goalName", "Goal name"], ["target", "Goal target (£)"], ["saved", "Saved so far (£)"]] as const;
  return <div className="pg-stack">
    <PageHeader title="Profile" sub="Tell me how your money works. I keep the rules." />
    {actionError && <p role="alert" className="text-sm pg-stop">{actionError}</p>}
    <div className="pg-grid profile">
      <Card className="pg-chat">
        <h2 className="pg-card-title">Chat</h2>
        <div aria-live="polite" className="pg-msgs mt-3">
          <p className="pg-msg bot">Tell me how your money works in plain words. I’ll turn it into rules. Try “limit clothes to £60 a week” or “no trainers until exams are over”.</p>
          {messages.map((m, i) => <div key={i} className="contents">
            <p className={`pg-msg ${m.from === "you" ? "me" : "bot"}`}>{m.text}</p>
            {m.changes?.map((c, j) => <p key={j} className="pg-confirm"><TickIcon />{c}</p>)}
          </div>)}
          {busy && <p className="pg-msg bot pg-muted">Thinking…</p>}
        </div>
        <form onSubmit={send} className="pg-inbar mt-3">
          <input aria-label="Message your agent" value={message} onChange={e => setMessage(e.target.value)} placeholder="e.g. gym is £24 on the 20th" />
          <button type="submit" className="pg-send" aria-label="Send" disabled={busy || !message.trim()}><SendIcon /></button>
        </form>
      </Card>

      <div className="pg-stack">
        <Card><h2 className="pg-card-title">Money in</h2><div className="mt-2">{data.incomes.map(i => <div key={i.id} className="pg-kv"><span className="min-w-0">{i.name}</span><span className="text-right pg-num"><span className="pg-muted">{incomeSchedule(i)} · next {date(i.nextDate)} · </span><strong className="font-medium">{money(i.amountPence)}</strong></span></div>)}{!data.incomes.length && <p className="pg-sub">No income added.</p>}</div></Card>
        <Card><h2 className="pg-card-title">Bills</h2><div className="mt-2">{data.outgoings.map(o => <div key={o.id} className="pg-kv"><span className="min-w-0">{o.name} <span className="pg-label">· {CATEGORY_LABELS[o.category]}</span></span><span className="pg-num"><span className="pg-muted">{ordinal(o.dayOfMonth)} · </span><strong className="font-medium">{money(o.amountPence)}</strong></span></div>)}{!data.outgoings.length && <p className="pg-sub">No bills added.</p>}</div></Card>
        <Card><h2 className="pg-card-title">Rules</h2><div className="mt-2">{data.rules.map(r => <div key={r.id} className="pg-kv"><span className="min-w-0">{r.text}</span><span className="flex shrink-0 flex-wrap justify-end gap-1"><PgChip tone={r.direction === "avoid" ? "think" : "go"}>{r.direction.replaceAll("_", " ")}</PgChip>{r.category && <PgChip>{CATEGORY_LABELS[r.category]}</PgChip>}{r.until && <PgChip>Until {r.until}</PgChip>}</span></div>)}{!data.rules.length && <p className="pg-sub">No rules yet.</p>}</div></Card>
        <Card><h2 className="pg-card-title">Weekly limits</h2><div className="mt-2">{data.limits.map(l => <div key={l.category} className="pg-kv"><span>{CATEGORY_LABELS[l.category]}</span><strong className="font-medium pg-num">{money(l.weeklyLimitPence)}</strong></div>)}{!data.limits.length && <p className="pg-sub">No limits set.</p>}</div></Card>
        <Card><div className="flex items-baseline justify-between gap-3"><h2 className="pg-card-title">{data.goal.name}</h2><span className="pg-num pg-muted text-sm">{money(data.goal.savedPence)} of {money(data.goal.targetPence)}</span></div><div className="mt-4"><FlatBar goal value={data.goal.savedPence} max={data.goal.targetPence} color="var(--color-accent)" /></div></Card>
        <Card><div className="flex items-center justify-between gap-3"><h2 className="pg-card-title">Your details</h2><Button variant="quiet" onClick={toggleEditing}>{editing ? "Cancel" : "Edit"}</Button></div>{editing ? <form onSubmit={save} className="mt-4 grid gap-3 sm:grid-cols-2">{fields.map(([key, label]) => <label key={key} className="pg-label">{label}<input required value={draft[key]} onChange={e => setDraft({ ...draft, [key]: e.target.value })} type={key === "name" || key === "goalName" ? "text" : "number"} min={key === "name" || key === "goalName" || key === "balance" ? undefined : "0"} step={key === "name" || key === "goalName" ? undefined : "0.01"} className="pg-input mt-1 w-full" /></label>)}<div><Button type="submit" disabled={busy}>Save</Button></div></form> : <div className="mt-2"><div className="pg-kv"><span className="pg-muted">Name</span><span>{data.name}</span></div><div className="pg-kv"><span className="pg-muted">Hourly rate</span><span className="pg-num">{money(data.hourlyRatePence)}</span></div><div className="pg-kv"><span className="pg-muted">Balance</span><span className="pg-num">{money(data.balancePence)}</span></div></div>}</Card>
        <Card><div className="flex items-center justify-between gap-4"><div><h2 className="pg-card-title">Quiet hours</h2><p className="pg-sub">Preview preference for this screen.</p></div><button type="button" role="switch" aria-checked={quiet} aria-label="Quiet hours preview" onClick={() => setQuiet(!quiet)} className="pg-switch"><span /></button></div></Card>
      </div>
    </div>
  </div>;
}
