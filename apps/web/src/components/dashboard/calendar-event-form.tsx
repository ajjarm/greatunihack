"use client";

import { useEffect, useRef, useState, type FormEvent } from "react";
import { CATEGORIES, CATEGORY_LABELS, type Category, type IncomeSchedule, type Persona } from "@/lib/types";
import { api, date } from "@/components/dashboard/shared";

type EventKind = "income" | "bill";
type Frequency = "once" | "monthly" | "fortnightly";

export function CalendarEventForm({ initialDate, demoDate, endDate, onSaved, onCancel }: {
  initialDate: string;
  demoDate: string;
  endDate: string;
  onSaved: (persona: Persona, eventDate: string) => void;
  onCancel: () => void;
}) {
  const formRef = useRef<HTMLFormElement>(null);
  const [kind, setKind] = useState<EventKind>("income");
  const [name, setName] = useState("");
  const [amount, setAmount] = useState("");
  const [eventDate, setEventDate] = useState(initialDate);
  const [billDay, setBillDay] = useState(String(Number(initialDate.slice(-2))));
  const [frequency, setFrequency] = useState<Frequency>("once");
  const [category, setCategory] = useState<Category>("other");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const earliestDate = new Date(Date.parse(`${demoDate}T00:00:00Z`) + 86400000).toISOString().slice(0, 10);
  const latestDate = new Date(Date.parse(`${endDate}T00:00:00Z`) - 86400000).toISOString().slice(0, 10);
  const fieldClass = "mt-1 min-h-11 w-full bg-[var(--color-fill)] px-4 text-sm font-normal text-[var(--color-text)] outline-none";
  useEffect(() => { formRef.current?.scrollIntoView({ block: "center" }); }, []);

  async function save(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const amountPence = Math.round(Number(amount) * 100);
    const dueDay = Number(billDay);
    const validDate = /^\d{4}-\d{2}-\d{2}$/.test(eventDate) && eventDate > demoDate && eventDate < endDate;
    if (!name.trim() || !Number.isSafeInteger(amountPence) || amountPence <= 0 || (kind === "income" && !validDate) || (kind === "bill" && (!Number.isInteger(dueDay) || dueDay < 1 || dueDay > 31))) {
      setError("Enter a name, an amount above £0, and a valid payday or bill day.");
      return;
    }
    setBusy(true);
    setError("");
    try {
      const current = await api<Persona>("memory");
      const id = `${kind}_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
      let updated: Persona;
      let savedDate = eventDate;
      if (kind === "income") {
        const dayOfMonth = Number(eventDate.slice(-2));
        const schedule: IncomeSchedule = frequency === "monthly"
          ? { type: "monthly", dayOfMonth }
          : frequency === "fortnightly"
            ? { type: "fortnightly", weekday: new Date(`${eventDate}T12:00:00Z`).getUTCDay(), nextDate: eventDate }
            : { type: "once", date: eventDate };
        updated = await api<Persona>("memory", { method: "PUT", body: JSON.stringify({ incomes: [...current.incomes, { id, name: name.trim(), amountPence, schedule, nextDate: eventDate }] }) });
      } else {
        updated = await api<Persona>("memory", { method: "PUT", body: JSON.stringify({ outgoings: [...current.outgoings, { id, name: name.trim(), amountPence, dayOfMonth: dueDay, category }] }) });
        const currentMonth = new Date(Date.UTC(Number(demoDate.slice(0, 4)), Number(demoDate.slice(5, 7)) - 1, dueDay));
        savedDate = currentMonth.toISOString().slice(0, 10) > demoDate ? currentMonth.toISOString().slice(0, 10) : new Date(Date.UTC(Number(demoDate.slice(0, 4)), Number(demoDate.slice(5, 7)), dueDay)).toISOString().slice(0, 10);
      }
      onSaved(updated, savedDate);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Could not save this event. Try again.");
    } finally {
      setBusy(false);
    }
  }

  return <form ref={formRef} onSubmit={save} className="ds-tile mt-4">
    <div className="flex flex-wrap items-start justify-between gap-3"><div><h3 className="ds-h2">Add an event</h3><p className="mt-1 text-xs text-[var(--color-text-muted)]">Pick a date, then add money in or out.</p></div><button type="button" onClick={onCancel} aria-label="Close add event form" className="grid h-9 w-9 place-items-center rounded-full bg-[var(--color-fill-2)] text-lg text-[var(--color-text-muted)]">×</button></div>
    <div className="ds-seg mt-4" role="group" aria-label="Event type"><button type="button" aria-pressed={kind === "income"} onClick={() => setKind("income")}>+ Payday</button><button type="button" aria-pressed={kind === "bill"} onClick={() => setKind("bill")}>− Monthly bill</button></div>
    <div className="mt-4 grid gap-3 sm:grid-cols-2"><label className="ds-label">Name<input autoFocus required maxLength={80} value={name} onChange={event => setName(event.target.value)} placeholder={kind === "income" ? "e.g. Part-time job" : "e.g. Electricity"} className={fieldClass} style={{ borderRadius: "var(--radius-pill)" }} /></label><label className="ds-label">Amount (£)<input required type="number" min="0.01" step="0.01" inputMode="decimal" value={amount} onChange={event => setAmount(event.target.value)} placeholder="0.00" className={fieldClass} style={{ borderRadius: "var(--radius-pill)" }} /></label>{kind === "income" ? <><label className="ds-label">First payday<input required type="date" min={earliestDate} max={latestDate} value={eventDate} onChange={event => setEventDate(event.target.value)} className={fieldClass} style={{ borderRadius: "var(--radius-pill)" }} /></label><label className="ds-label">Repeats<select value={frequency} onChange={event => setFrequency(event.target.value as Frequency)} className={fieldClass} style={{ borderRadius: "var(--radius-pill)" }}><option value="once">Just once</option><option value="monthly">Every month</option><option value="fortnightly">Every 2 weeks</option></select></label></> : <><label className="ds-label">Day of each month<input required type="number" min="1" max="31" step="1" value={billDay} onChange={event => setBillDay(event.target.value)} className={fieldClass} style={{ borderRadius: "var(--radius-pill)" }} /></label><label className="ds-label">Category<select value={category} onChange={event => setCategory(event.target.value as Category)} className={fieldClass} style={{ borderRadius: "var(--radius-pill)" }}>{CATEGORIES.map(value => <option key={value} value={value}>{CATEGORY_LABELS[value]}</option>)}</select></label></>}</div>
    <p className="mt-3 text-xs text-[var(--color-text-muted)]">{kind === "bill" ? `This bill repeats monthly on day ${billDay || "…"}. Dates after the 28th may roll into the next month in shorter months.` : !eventDate ? "Choose the first payday." : frequency === "once" ? `This payday appears on ${date(eventDate)} only.` : frequency === "monthly" ? `This payday repeats on day ${eventDate.slice(-2)} each month from ${date(eventDate)}.` : `This payday repeats every 2 weeks from ${date(eventDate)}.`}</p>
    {error && <p role="alert" className="mt-3 text-sm font-semibold text-[var(--color-stop)]">{error}</p>}
    <div className="mt-4 flex flex-wrap gap-2"><button type="submit" disabled={busy} className="ds-btn ds-btn-acc">{busy ? "Saving…" : "Save"}</button><button type="button" onClick={onCancel} className="ds-btn ds-btn-sec">Cancel</button></div>
  </form>;
}
