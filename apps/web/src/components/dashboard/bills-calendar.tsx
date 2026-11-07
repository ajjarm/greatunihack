"use client";

import { useEffect, useState } from "react";
import { CATEGORY_LABELS, type Category, type MoneyEvent, type Persona } from "@/lib/types";
import { api, Card, Label, date, money } from "@/components/dashboard/shared";
import { CalendarEventForm } from "@/components/dashboard/calendar-event-form";

type BillOccurrence = { id: string; name: string; category: Category; amountPence: number; date: string };
type IncomeOccurrence = { id: string; name: string; amountPence: number; date: string };
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

function buildUpcomingIncomes(persona: Persona, demoDate: string): IncomeOccurrence[] {
  const start = new Date(`${demoDate}T12:00:00Z`);
  const end = new Date(Date.UTC(start.getUTCFullYear(), start.getUTCMonth() + 12, 1));
  const incomes: IncomeOccurrence[] = [];
  for (const income of persona.incomes) {
    const add = (day: string) => {
      if (day > demoDate && day >= income.nextDate && day < end.toISOString().slice(0, 10)) {
        incomes.push({ id: `${income.id}-${day}`, name: income.name, amountPence: income.amountPence, date: day });
      }
    };
    if (income.schedule.type === "once") {
      add(income.schedule.date);
    } else if (income.schedule.type === "monthly") {
      for (let offset = 0; offset < 12; offset++) {
        add(new Date(Date.UTC(start.getUTCFullYear(), start.getUTCMonth() + offset, income.schedule.dayOfMonth)).toISOString().slice(0, 10));
      }
    } else {
      let next = new Date(`${income.schedule.nextDate}T12:00:00Z`);
      while (next < end) {
        add(next.toISOString().slice(0, 10));
        next = new Date(next.getTime() + 14 * 24 * 60 * 60 * 1000);
      }
    }
  }
  return incomes.sort((a, b) => a.date.localeCompare(b.date) || a.name.localeCompare(b.name));
}

export function BillsCalendar({ nextBill, demoNow, onSaved }: { nextBill: MoneyEvent; demoNow: string; onSaved?: () => void }) {
  const demoDate = demoNow.slice(0, 10);
  const nextBillMonthOffset = (Number(nextBill.date.slice(0, 4)) - Number(demoDate.slice(0, 4))) * 12 + Number(nextBill.date.slice(5, 7)) - Number(demoDate.slice(5, 7));
  const [open, setOpen] = useState(true);
  const [persona, setPersona] = useState<Persona | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [monthOffset, setMonthOffset] = useState(Math.min(11, Math.max(0, nextBillMonthOffset)));
  const [selectedDate, setSelectedDate] = useState<string | null>(nextBill.date);
  const [formDate, setFormDate] = useState<string | null>(null);

  async function loadBills() {
    setLoading(true);
    setError("");
    try { setPersona(await api<Persona>("memory")); }
    catch (cause) { setError(cause instanceof Error ? cause.message : "Could not load bills"); }
    finally { setLoading(false); }
  }

  useEffect(() => { void loadBills(); }, []);

  function toggle() {
    setOpen(!open);
    if (!open && !persona && !loading) void loadBills();
  }

  const start = new Date(`${demoDate}T12:00:00Z`);
  const endDate = new Date(Date.UTC(start.getUTCFullYear(), start.getUTCMonth() + 12, 1)).toISOString().slice(0, 10);
  const tomorrow = new Date(Date.parse(`${demoDate}T00:00:00Z`) + 86400000).toISOString().slice(0, 10);
  function openForm(day = selectedDate) { setFormDate(day && day > demoDate && day < endDate ? day : tomorrow); }
  const month = new Date(Date.UTC(start.getUTCFullYear(), start.getUTCMonth() + monthOffset, 1));
  const year = month.getUTCFullYear();
  const monthIndex = month.getUTCMonth();
  const monthTitle = new Intl.DateTimeFormat("en-GB", { timeZone: "UTC", month: "long", year: "numeric" }).format(month);
  const daysInMonth = new Date(Date.UTC(year, monthIndex + 1, 0)).getUTCDate();
  const leadingBlanks = (month.getUTCDay() + 6) % 7;
  const bills = persona ? buildUpcomingBills(persona, demoDate) : [];
  const incomes = persona ? buildUpcomingIncomes(persona, demoDate) : [];
  const billDays = new Map<string, BillOccurrence[]>();
  for (const bill of bills) billDays.set(bill.date, [...(billDays.get(bill.date) ?? []), bill]);
  const incomeDays = new Map<string, IncomeOccurrence[]>();
  for (const income of incomes) incomeDays.set(income.date, [...(incomeDays.get(income.date) ?? []), income]);
  const selectedBills = selectedDate ? billDays.get(selectedDate) ?? [] : [];
  const selectedIncomes = selectedDate ? incomeDays.get(selectedDate) ?? [] : [];

  return <Card>
    <button type="button" onClick={toggle} aria-expanded={open} aria-controls="future-bills-calendar" className="flex min-h-11 w-full items-center justify-between gap-4 text-left focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--color-accent)]">
      <div><Label>Next bill</Label><span className="mt-2 block font-semibold">{nextBill.name}</span><span className="block text-sm text-[var(--color-text-muted)]">{date(nextBill.date)}</span></div>
      <span className="flex shrink-0 items-center gap-3"><span className="text-xl font-bold">{money(nextBill.amountPence)}</span><span aria-hidden="true" className="text-lg text-[var(--color-accent)]">{open ? "−" : "+"}</span></span>
    </button>
    {open && <div id="future-bills-calendar" className="mt-5 border-t border-[var(--color-border)] pt-5">
      <div className="flex flex-wrap items-center justify-between gap-3"><div><h2 className="text-lg font-bold">Bills and paydays</h2><p className="text-xs text-[var(--color-text-muted)]">Upcoming money in and out over the next 12 months.</p></div><div className="flex flex-wrap items-center gap-3">{persona && <span className="text-xs text-[var(--color-text-muted)]">{bills.length} bills · {incomes.length} paydays</span>}<button type="button" onClick={() => openForm()} className="min-h-11 bg-[var(--color-accent)] px-4 text-sm font-semibold text-[var(--color-surface)] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--color-accent)]" style={{ borderRadius: "var(--radius-sm)" }}>+ Add event</button></div></div>
      {formDate && <CalendarEventForm key={formDate} initialDate={formDate} demoDate={demoDate} endDate={endDate} onCancel={() => setFormDate(null)} onSaved={(updated, day) => { setPersona(updated); setSelectedDate(day); setMonthOffset((Number(day.slice(0, 4)) - start.getUTCFullYear()) * 12 + Number(day.slice(5, 7)) - 1 - start.getUTCMonth()); setFormDate(null); onSaved?.(); }} />}
      {loading && <p role="status" className="mt-4 text-sm text-[var(--color-text-muted)]">Loading bill calendar…</p>}
      {error && <div role="alert" className="mt-4 text-sm"><p>{error}</p><button type="button" onClick={() => void loadBills()} className="mt-2 font-semibold text-[var(--color-accent)] underline">Try again</button></div>}
      {persona && <>
        <div className="mt-5 flex items-center justify-between gap-3"><button type="button" disabled={monthOffset === 0} onClick={() => { setMonthOffset(monthOffset - 1); setSelectedDate(null); }} aria-label="Previous month" className="min-h-11 min-w-11 border border-[var(--color-border)] text-lg disabled:opacity-40" style={{ borderRadius: "var(--radius-sm)" }}>←</button><h3 className="text-base font-semibold">{monthTitle}</h3><button type="button" disabled={monthOffset === 11} onClick={() => { setMonthOffset(monthOffset + 1); setSelectedDate(null); }} aria-label="Next month" className="min-h-11 min-w-11 border border-[var(--color-border)] text-lg disabled:opacity-40" style={{ borderRadius: "var(--radius-sm)" }}>→</button></div>
        <div className="mt-3 flex flex-wrap gap-4 text-xs font-semibold"><span className="flex items-center gap-2 text-[var(--color-go)]"><span aria-hidden="true" className="h-2.5 w-2.5 rounded-full bg-[var(--color-go)]" />Payday</span><span className="flex items-center gap-2 text-[var(--color-stop)]"><span aria-hidden="true" className="h-2.5 w-2.5 rounded-full bg-[var(--color-stop)]" />Bill</span></div>
        <p className="mt-3 text-xs text-[var(--color-text-muted)] sm:hidden">Swipe sideways to read paydays and bills on the calendar.</p>
        <div role="region" aria-label={`${monthTitle} bills and paydays calendar`} tabIndex={0} className="dashboard-scrollbar mt-2 overflow-x-auto pb-2 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--color-accent)]"><div className="grid min-w-[42rem] grid-cols-7 gap-1 text-xs">{weekdays.map(day => <span key={day} className="py-1 text-center font-semibold text-[var(--color-text-muted)]">{day}</span>)}{Array.from({ length: leadingBlanks }, (_, index) => <span key={`blank-${index}`} />)}{Array.from({ length: daysInMonth }, (_, index) => {
          const day = index + 1;
          const iso = `${year}-${String(monthIndex + 1).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
          const onBills = billDays.get(iso) ?? [];
          const onIncomes = incomeDays.get(iso) ?? [];
          const mixed = onBills.length > 0 && onIncomes.length > 0;
          const dayTone = mixed ? "border-[var(--color-border)] bg-[var(--color-surface-2)]" : onIncomes.length ? "border-[var(--color-go)] bg-[var(--color-go-bg)]" : "border-[var(--color-stop)] bg-[var(--color-stop-bg)]";
          return onBills.length || onIncomes.length ? <button key={iso} type="button" aria-pressed={selectedDate === iso} aria-label={`${date(iso)}: ${[...onIncomes.map(income => `Payday ${income.name} ${money(income.amountPence)}`), ...onBills.map(bill => `Bill ${bill.name} ${money(bill.amountPence)}`)].join(", ")}`} onClick={() => setSelectedDate(iso)} className={`min-h-24 border p-2 text-left focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--color-accent)] ${dayTone} ${selectedDate === iso ? "ring-2 ring-[var(--color-accent)]" : ""}`} style={{ borderRadius: "var(--radius-sm)" }}><span className="block text-sm font-bold">{day}</span>{onIncomes.map(income => <span key={income.id} className="mt-1 block border-l-2 border-[var(--color-go)] pl-1.5 text-[10px] leading-tight text-[var(--color-go)]"><span className="block truncate font-semibold" title={income.name}>{income.name}</span><span className="block">+{money(income.amountPence)}</span></span>)}{onBills.map(bill => <span key={bill.id} className="mt-1 block border-l-2 border-[var(--color-stop)] pl-1.5 text-[10px] leading-tight text-[var(--color-stop)]"><span className="block truncate font-semibold" title={bill.name}>{bill.name}</span><span className="block">−{money(bill.amountPence)}</span></span>)}</button> : iso > demoDate ? <button key={iso} type="button" aria-label={`Add event on ${date(iso)}`} onClick={() => { setSelectedDate(iso); openForm(iso); }} className="min-h-24 border border-[var(--color-border)] p-2 text-left text-sm hover:border-[var(--color-accent)] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--color-accent)]" style={{ borderRadius: "var(--radius-sm)" }}><span className="block font-semibold">{day}</span><span className="mt-2 block text-[10px] text-[var(--color-text-muted)]">+ Add</span></button> : <span key={iso} className="min-h-24 border border-[var(--color-border)] p-2 text-sm text-[var(--color-text-muted)]" style={{ borderRadius: "var(--radius-sm)" }}>{day}</span>;
        })}</div></div>
        {(selectedBills.length > 0 || selectedIncomes.length > 0) && <div className="mt-4 border border-[var(--color-border)] bg-[var(--color-surface-2)] p-3 text-sm" style={{ borderRadius: "var(--radius-sm)" }}><div className="flex items-center justify-between gap-3"><p className="font-semibold">{date(selectedDate!)}</p><button type="button" onClick={() => openForm(selectedDate)} className="min-h-9 text-xs font-semibold text-[var(--color-accent)] focus-visible:outline-2 focus-visible:outline-[var(--color-accent)]">+ Add here</button></div>{selectedIncomes.map(income => <p key={income.id} className="mt-1 flex justify-between gap-3 text-[var(--color-go)]"><span>Payday · {income.name}</span><strong>+{money(income.amountPence)}</strong></p>)}{selectedBills.map(bill => <p key={bill.id} className="mt-1 flex justify-between gap-3 text-[var(--color-stop)]"><span>Bill · {bill.name}</span><strong>−{money(bill.amountPence)}</strong></p>)}</div>}
        <h3 className="mt-6 text-sm font-bold">All upcoming bills</h3><div role="region" aria-label="Upcoming bills list" tabIndex={0} className="dashboard-scrollbar mt-2 max-h-64 overflow-y-auto pr-2 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--color-accent)]">{bills.length ? <ul className="space-y-2">{bills.map(bill => <li key={bill.id} className={`flex items-center justify-between gap-3 border p-3 text-sm ${selectedDate === bill.date ? "border-[var(--color-accent)] bg-[var(--color-accent-bg)]" : "border-[var(--color-border)] bg-[var(--color-surface-2)]"}`} style={{ borderRadius: "var(--radius-sm)" }}><span><span className="font-semibold">{bill.name}</span><span className="block text-xs text-[var(--color-text-muted)]">{date(bill.date)} · {CATEGORY_LABELS[bill.category]}</span></span><strong className="shrink-0">{money(bill.amountPence)}</strong></li>)}</ul> : <p className="text-sm text-[var(--color-text-muted)]">No recurring bills are listed.</p>}</div>
      </>}
    </div>}
  </Card>;
}
