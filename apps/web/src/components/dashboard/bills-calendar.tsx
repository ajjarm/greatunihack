"use client";

import { useState } from "react";
import { CATEGORY_LABELS, type Category, type MoneyEvent, type Persona } from "@/lib/types";
import { api, Card, Label, date, money } from "@/components/dashboard/shared";

type BillOccurrence = { id: string; name: string; category: Category; amountPence: number; date: string };
const weekdays = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];

function buildUpcomingBills(persona: Persona, demoDate: string): BillOccurrence[] {
  const start = new Date(`${demoDate}T12:00:00Z`);
  const endDate = new Date(Date.UTC(start.getUTCFullYear(), start.getUTCMonth() + 12, 1)).toISOString().slice(0, 10);
  return Array.from({ length: 12 }, (_, monthOffset) => persona.outgoings.map(outgoing => ({
    id: `${outgoing.id}-${monthOffset}`,
    name: outgoing.name,
    category: outgoing.category,
    amountPence: outgoing.amountPence,
    date: new Date(Date.UTC(start.getUTCFullYear(), start.getUTCMonth() + monthOffset, outgoing.dayOfMonth)).toISOString().slice(0, 10),
  }))).flat().filter(bill => bill.date > demoDate && bill.date < endDate).sort((a, b) => a.date.localeCompare(b.date) || a.name.localeCompare(b.name));
}

export function BillsCalendar({ nextBill, demoNow }: { nextBill: MoneyEvent; demoNow: string }) {
  const demoDate = demoNow.slice(0, 10);
  const nextBillMonthOffset = (Number(nextBill.date.slice(0, 4)) - Number(demoDate.slice(0, 4))) * 12 + Number(nextBill.date.slice(5, 7)) - Number(demoDate.slice(5, 7));
  const [open, setOpen] = useState(false);
  const [persona, setPersona] = useState<Persona | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [monthOffset, setMonthOffset] = useState(Math.min(11, Math.max(0, nextBillMonthOffset)));
  const [selectedDate, setSelectedDate] = useState<string | null>(nextBill.date);

  async function loadBills() {
    setLoading(true);
    setError("");
    try { setPersona(await api<Persona>("memory")); }
    catch (cause) { setError(cause instanceof Error ? cause.message : "Could not load bills"); }
    finally { setLoading(false); }
  }

  function toggle() {
    setOpen(!open);
    if (!open && !persona && !loading) void loadBills();
  }

  const start = new Date(`${demoDate}T12:00:00Z`);
  const month = new Date(Date.UTC(start.getUTCFullYear(), start.getUTCMonth() + monthOffset, 1));
  const year = month.getUTCFullYear();
  const monthIndex = month.getUTCMonth();
  const monthTitle = new Intl.DateTimeFormat("en-GB", { timeZone: "UTC", month: "long", year: "numeric" }).format(month);
  const daysInMonth = new Date(Date.UTC(year, monthIndex + 1, 0)).getUTCDate();
  const leadingBlanks = (month.getUTCDay() + 6) % 7;
  const bills = persona ? buildUpcomingBills(persona, demoDate) : [];
  const billDays = new Map<string, BillOccurrence[]>();
  for (const bill of bills) billDays.set(bill.date, [...(billDays.get(bill.date) ?? []), bill]);
  const selectedBills = selectedDate ? billDays.get(selectedDate) ?? [] : [];

  return <Card>
    <button type="button" onClick={toggle} aria-expanded={open} aria-controls="future-bills-calendar" className="flex min-h-11 w-full items-center justify-between gap-4 text-left focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--color-accent)]">
      <div><Label>Next bill</Label><span className="mt-2 block font-semibold">{nextBill.name}</span><span className="block text-sm text-[var(--color-text-muted)]">{date(nextBill.date)}</span></div>
      <span className="flex shrink-0 items-center gap-3"><span className="text-xl font-bold">{money(nextBill.amountPence)}</span><span aria-hidden="true" className="text-lg text-[var(--color-accent)]">{open ? "−" : "+"}</span></span>
    </button>
    {open && <div id="future-bills-calendar" className="mt-5 border-t border-[var(--color-border)] pt-5">
      <div className="flex flex-wrap items-center justify-between gap-3"><div><h2 className="text-lg font-bold">Future bills</h2><p className="text-xs text-[var(--color-text-muted)]">Recurring bills for the next 12 months from the demo date.</p></div>{persona && <span className="text-xs text-[var(--color-text-muted)]">{bills.length} upcoming</span>}</div>
      {loading && <p role="status" className="mt-4 text-sm text-[var(--color-text-muted)]">Loading bill calendar…</p>}
      {error && <div role="alert" className="mt-4 text-sm"><p>{error}</p><button type="button" onClick={() => void loadBills()} className="mt-2 font-semibold text-[var(--color-accent)] underline">Try again</button></div>}
      {persona && <>
        <div className="mt-5 flex items-center justify-between gap-3"><button type="button" disabled={monthOffset === 0} onClick={() => { setMonthOffset(monthOffset - 1); setSelectedDate(null); }} aria-label="Previous month" className="min-h-11 min-w-11 border border-[var(--color-border)] text-lg disabled:opacity-40" style={{ borderRadius: "var(--radius-sm)" }}>←</button><h3 className="text-base font-semibold">{monthTitle}</h3><button type="button" disabled={monthOffset === 11} onClick={() => { setMonthOffset(monthOffset + 1); setSelectedDate(null); }} aria-label="Next month" className="min-h-11 min-w-11 border border-[var(--color-border)] text-lg disabled:opacity-40" style={{ borderRadius: "var(--radius-sm)" }}>→</button></div>
        <p className="mt-3 text-xs text-[var(--color-text-muted)] sm:hidden">Swipe sideways to read bills on the calendar.</p>
        <div role="region" aria-label={`${monthTitle} bill calendar`} tabIndex={0} className="dashboard-scrollbar mt-2 overflow-x-auto pb-2 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--color-accent)]"><div className="grid min-w-[42rem] grid-cols-7 gap-1 text-xs">{weekdays.map(day => <span key={day} className="py-1 text-center font-semibold text-[var(--color-text-muted)]">{day}</span>)}{Array.from({ length: leadingBlanks }, (_, index) => <span key={`blank-${index}`} />)}{Array.from({ length: daysInMonth }, (_, index) => {
          const day = index + 1;
          const iso = `${year}-${String(monthIndex + 1).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
          const onDay = billDays.get(iso) ?? [];
          return onDay.length ? <button key={iso} type="button" aria-pressed={selectedDate === iso} aria-label={`${date(iso)}: ${onDay.map(bill => `${bill.name} ${money(bill.amountPence)}`).join(", ")}`} onClick={() => setSelectedDate(iso)} className={`min-h-24 border p-2 text-left focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--color-accent)] ${selectedDate === iso ? "border-[var(--color-accent)] bg-[var(--color-accent-bg)]" : "border-[var(--color-border)] bg-[var(--color-surface-2)]"}`} style={{ borderRadius: "var(--radius-sm)" }}><span className="block text-sm font-bold">{day}</span>{onDay.map(bill => <span key={bill.id} className="mt-1 block border-l-2 border-[var(--color-accent)] pl-1.5 text-[10px] leading-tight"><span className="block truncate font-semibold" title={bill.name}>{bill.name}</span><span className="block">{money(bill.amountPence)}</span></span>)}</button> : <span key={iso} className={`min-h-24 border border-[var(--color-border)] p-2 text-sm ${iso <= demoDate ? "text-[var(--color-text-muted)]" : "text-[var(--color-text)]"}`} style={{ borderRadius: "var(--radius-sm)" }}>{day}</span>;
        })}</div></div>
        {selectedBills.length > 0 && <div className="mt-4 border border-[var(--color-accent)] bg-[var(--color-accent-bg)] p-3 text-sm" style={{ borderRadius: "var(--radius-sm)" }}><p className="font-semibold">{date(selectedDate!)}</p>{selectedBills.map(bill => <p key={bill.id} className="mt-1 flex justify-between gap-3"><span>{bill.name}</span><strong>{money(bill.amountPence)}</strong></p>)}</div>}
        <h3 className="mt-6 text-sm font-bold">All upcoming bills</h3><div role="region" aria-label="Upcoming bills list" tabIndex={0} className="dashboard-scrollbar mt-2 max-h-64 overflow-y-auto pr-2 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--color-accent)]">{bills.length ? <ul className="space-y-2">{bills.map(bill => <li key={bill.id} className={`flex items-center justify-between gap-3 border p-3 text-sm ${selectedDate === bill.date ? "border-[var(--color-accent)] bg-[var(--color-accent-bg)]" : "border-[var(--color-border)] bg-[var(--color-surface-2)]"}`} style={{ borderRadius: "var(--radius-sm)" }}><span><span className="font-semibold">{bill.name}</span><span className="block text-xs text-[var(--color-text-muted)]">{date(bill.date)} · {CATEGORY_LABELS[bill.category]}</span></span><strong className="shrink-0">{money(bill.amountPence)}</strong></li>)}</ul> : <p className="text-sm text-[var(--color-text-muted)]">No recurring bills are listed.</p>}</div>
      </>}
    </div>}
  </Card>;
}
