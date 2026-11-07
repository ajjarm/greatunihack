"use client";

import { useEffect, useState } from "react";
import type { Home, WaitingItem } from "@/lib/types";
import { api, Button, Card, PageState, money, useApi } from "@/components/dashboard/shared";
import { FlatBar, Mark, PageHeader } from "@/components/dashboard/page-ui";

const askAgain = (value: string) => new Intl.DateTimeFormat("en-GB", { timeZone: "Europe/London", weekday: "short", day: "numeric", month: "short", hour: "numeric", minute: "2-digit", hour12: true }).format(new Date(value)).replace(" at ", ", ").replace(":00", "").replace(/\s?(am|pm)$/i, (_, x: string) => x.toLowerCase());
const pad = (n: number) => String(n).padStart(2, "0");

export default function WaitingPage() {
  const { data, setData, error, loading, reload } = useApi<WaitingItem[]>("waiting");
  const home = useApi<Home>("home");
  const [elapsed, setElapsed] = useState(0);
  const [busy, setBusy] = useState<string | null>(null);
  const [leaving, setLeaving] = useState<string | null>(null);
  const [actionError, setActionError] = useState("");
  useEffect(() => { const timer = setInterval(() => setElapsed(v => v + 1), 1000); return () => clearInterval(timer); }, []);
  async function decide(item: WaitingItem, decision: "buy" | "wait" | "remove") {
    setBusy(item.id); setActionError("");
    try {
      const updated = await api<WaitingItem>(`waiting/${encodeURIComponent(item.id)}`, { method: "PATCH", body: JSON.stringify({ decision }) });
      const apply = () => setData(items => items?.map(i => i.id === item.id ? updated : i) ?? null);
      // cards that leave the grid fade and scale to .97 first (DESIGN.md §6 Waiting)
      if (updated.status === "bought" || updated.status === "removed") { setLeaving(item.id); setTimeout(() => { apply(); setLeaving(null); }, 240); }
      else apply();
    } catch (e) { setActionError(e instanceof Error ? e.message : "Could not update this item"); }
    finally { setBusy(null); }
  }
  if (!data) return <PageState loading={loading} error={error} retry={reload} />;
  const active = data.filter(i => i.status === "waiting" || i.status === "extended");
  const finished = data.filter(i => i.status === "bought" || i.status === "removed");
  const now = home.data ? new Date(home.data.demoNow).getTime() + elapsed * 1000 : null;
  function countdown(until: string) {
    if (now === null) return "–";
    const remaining = Math.max(0, new Date(until).getTime() - now);
    if (!remaining) return "Ready";
    if (remaining > 48 * 3600000) { const days = Math.round(remaining / 86400000); return `${days} days`; }
    const s = Math.floor(remaining / 1000);
    return `${pad(Math.floor(s / 3600))}:${pad(Math.floor((s % 3600) / 60))}:${pad(s % 60)}`;
  }
  function progress(item: WaitingItem) {
    if (now === null) return 0;
    const start = new Date(item.savedAt).getTime(), end = new Date(item.reconsiderAt).getTime();
    return end > start ? Math.min(100, Math.max(0, (now - start) / (end - start) * 100)) : 100;
  }
  return <div className="pg-stack">
    <PageHeader title="Waiting" sub="Things you parked. I’ll ask again when the timer runs out." />
    {actionError && <p role="alert" className="text-sm pg-stop">{actionError}</p>}
    {home.error && <Card><p role="alert" className="text-sm pg-stop">The countdown is unavailable: {home.error}</p><div className="mt-3"><Button variant="quiet" onClick={() => void home.reload()}>Retry countdown</Button></div></Card>}
    {active.length ? <div className="pg-grid two">{active.map(i => <div key={i.id} className="pg-wcard" data-leaving={leaving === i.id}><Card>
      <div className="flex items-start gap-3">
        <Mark name={i.merchant} />
        <div className="min-w-0 flex-1"><p className="font-medium leading-snug">{i.itemName}</p><p className="pg-label">{i.merchant}{i.status === "extended" ? " · waited once already" : ""}</p></div>
        <p className="font-semibold pg-num">{money(i.pricePence)}</p>
      </div>
      <p className="pg-count mt-5" aria-live="off">{countdown(i.reconsiderAt)}</p>
      <p className="pg-label mt-2">until I ask again · {askAgain(i.reconsiderAt)}</p>
      <div className="mt-4"><FlatBar value={progress(i)} /></div>
      <div className="mt-4 flex flex-wrap items-center gap-2">
        <button type="button" className="pg-btn acc" disabled={busy === i.id} onClick={() => void decide(i, "wait")}>Wait another day</button>
        <button type="button" className="pg-btn" disabled={busy === i.id} onClick={() => void decide(i, "buy")}>Buy it</button>
        <button type="button" className="pg-btn ml-auto" disabled={busy === i.id} onClick={() => void decide(i, "remove")}>Remove</button>
      </div>
    </Card></div>)}</div> : <Card><p className="pg-card-title">Nothing waiting.</p><p className="pg-sub">When you choose “Wait until payday” at a checkout, the item lands here and I ask again later.</p></Card>}
    {finished.length > 0 && <Card><h2 className="pg-card-title">Past decisions</h2><div className="mt-2">{finished.map(i => <div key={i.id} className="pg-kv"><span className="flex min-w-0 items-center gap-3"><Mark name={i.merchant} /><span className="min-w-0"><span className="block truncate font-medium">{i.itemName}</span><span className="pg-label">{i.merchant} · {i.status === "bought" ? "Bought" : "Removed"}</span></span></span><span className="font-medium pg-num">{money(i.pricePence)}</span></div>)}</div></Card>}
  </div>;
}
