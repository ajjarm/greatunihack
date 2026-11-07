"use client";

import { useEffect, useState } from "react";
import type { WaitingItem } from "@/lib/types";
import { api, Button, Card, Label, PageState, date, money, useApi } from "@/components/dashboard/shared";

export default function WaitingPage() {
  const { data, setData, error, loading, reload } = useApi<WaitingItem[]>("waiting");
  const { data: home } = useApi<{ demoNow: string }>("home");
  const [elapsed, setElapsed] = useState(0);
  const [busy, setBusy] = useState<string | null>(null);
  const [actionError, setActionError] = useState("");
  useEffect(() => { const timer = setInterval(() => setElapsed(v => v + 1), 1000); return () => clearInterval(timer); }, []);
  async function decide(item: WaitingItem, decision: "buy" | "wait" | "remove") {
    setBusy(item.id); setActionError("");
    try {
      const updated = await api<WaitingItem>(`waiting/${encodeURIComponent(item.id)}`, { method: "PATCH", body: JSON.stringify({ decision }) });
      setData(items => items?.map(i => i.id === item.id ? updated : i) ?? null);
    } catch (e) { setActionError(e instanceof Error ? e.message : "Could not update this item"); }
    finally { setBusy(null); }
  }
  if (!data) return <PageState loading={loading} error={error} retry={reload} />;
  const active = data.filter(i => i.status === "waiting" || i.status === "extended");
  const finished = data.filter(i => i.status === "bought" || i.status === "removed");
  function countdown(until: string) {
    const remaining = Math.max(0, new Date(until).getTime() - (home ? new Date(home.demoNow).getTime() + elapsed * 1000 : Date.now()));
    if (!remaining) return "Ready to reconsider";
    const hours = Math.floor(remaining / 3600000);
    const minutes = Math.floor((remaining % 3600000) / 60000);
    return `${hours}h ${minutes}m left`;
  }
  return <div className="space-y-5"><header><Label>Pause list</Label><h1 className="mt-1 text-3xl font-bold">Waiting</h1><p className="mt-2 text-sm text-[var(--color-text-muted)]">A little space before deciding.</p></header>{actionError && <p role="alert" className="text-sm text-[var(--color-stop)]">{actionError}</p>}
    {active.length ? <div className="grid gap-4 lg:grid-cols-2">{active.map(i => <Card key={i.id}><div className="flex justify-between gap-4"><div><p className="text-lg font-bold">{i.itemName}</p><p className="text-sm text-[var(--color-text-muted)]">{i.merchant}</p></div><p className="text-lg font-bold">{money(i.pricePence)}</p></div><p className="mt-5 text-sm font-semibold text-[var(--color-think)]" aria-live="off">{countdown(i.reconsiderAt)}</p><p className="mt-1 text-xs text-[var(--color-text-muted)]">Reconsider {date(i.reconsiderAt)}</p><div className="mt-5 flex flex-wrap gap-2"><Button disabled={busy === i.id} onClick={() => void decide(i, "buy")}>Buy</Button><Button disabled={busy === i.id} variant="quiet" onClick={() => void decide(i, "wait")}>Wait longer</Button><Button disabled={busy === i.id} variant="danger" onClick={() => void decide(i, "remove")}>Remove</Button></div></Card>)}</div> : <Card><p className="text-sm text-[var(--color-text-muted)]">Nothing on your waiting list right now.</p></Card>}
    {finished.length > 0 && <section><h2 className="mb-3 text-xl font-bold">Past decisions</h2><div className="space-y-3">{finished.map(i => <Card key={i.id}><div className="flex justify-between gap-4"><div><p className="font-semibold">{i.itemName}</p><p className="text-sm text-[var(--color-text-muted)]">{i.merchant} · {i.status}</p></div><p className="font-semibold">{money(i.pricePence)}</p></div></Card>)}</div></section>}</div>;
}
