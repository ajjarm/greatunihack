"use client";
import "./nudge.css";
import { useCallback, useEffect, useRef, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import type { Assessment, HostMessage } from "@/lib/types";
import { CATEGORY_LABELS } from "@/lib/types";
import { assessScenario } from "./api";
import { money } from "./format";

type ScenarioRow = { id: string; title: string; merchant: string; totalPence: number };

/**
 * Stand-in for the extension's content script on a desktop checkout page. It plays the host
 * role from INTERFACES section 6: listens for st-nudge messages, resizes or removes the iframe.
 */
export function CheckoutPreview() {
  const params = useSearchParams();
  const router = useRouter();
  const scenario = params.get("scenario") ?? "scn_1_impulse";

  const [scenarios, setScenarios] = useState<ScenarioRow[]>([]);
  const [assessment, setAssessment] = useState<Assessment | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [open, setOpen] = useState(false);
  const [height, setHeight] = useState(300);
  const [run, setRun] = useState(0); // bump to re-assess (a fresh assessment each time)
  const [log, setLog] = useState<string[]>([]);
  const frame = useRef<HTMLIFrameElement>(null);

  useEffect(() => {
    fetch("/api/scenarios", { cache: "no-store" })
      .then((r) => r.json())
      .then(setScenarios)
      .catch(() => {});
  }, []);

  // the extension's job: assess the basket, then inject the nudge
  useEffect(() => {
    let cancelled = false;
    assessScenario(scenario)
      .then((a) => {
        if (cancelled) return;
        setAssessment(a);
        setError(null);
        setHeight(300);
        setOpen(true);
      })
      .catch((e: Error) => !cancelled && setError(e.message));
    return () => {
      cancelled = true;
    };
  }, [scenario, run]);

  // host side of the bridge
  useEffect(() => {
    const onMsg = (e: MessageEvent) => {
      if (e.source !== frame.current?.contentWindow) return;
      const m = e.data as HostMessage;
      if (!m || m.source !== "st-nudge") return;
      if (m.type === "resize") setHeight(m.height);
      if (m.type === "close") setOpen(false);
      if (m.type === "open") window.open(m.path ?? "/home", "_blank");
      setLog((l) => [`${new Date().toLocaleTimeString("en-GB")}  ${m.type}${m.type === "resize" ? ` ${m.height}px` : m.type === "open" ? ` ${m.path ?? ""}` : ""}`, ...l].slice(0, 6));
    };
    window.addEventListener("message", onMsg);
    return () => window.removeEventListener("message", onMsg);
  }, []);

  const pick = (id: string) => router.replace(`/nudge/preview?scenario=${id}`);
  const replay = useCallback(() => {
    setOpen(false);
    setRun((r) => r + 1);
  }, []);

  // Alt+Shift+N cycles scenarios, like the extension's phase-1 shortcut
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (!(e.altKey && e.shiftKey && e.code === "KeyN") || scenarios.length === 0) return;
      const i = scenarios.findIndex((s) => s.id === scenario);
      router.replace(`/nudge/preview?scenario=${scenarios[(i + 1) % scenarios.length].id}`);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [scenarios, scenario, router]);

  const items = assessment?.items ?? [];
  const subtotal = items.reduce((s, it) => s + it.pricePence * it.qty, 0);
  const delivery = assessment ? Math.max(0, assessment.totalPence - subtotal) : 0;

  return (
    <div className="min-h-screen flex flex-col" style={{ background: "var(--color-bg)", color: "var(--color-text)", fontFamily: "var(--font-sans)" }}>
      {/* demo toolbar (not part of the shop) */}
      <div className="flex flex-wrap items-center gap-2 px-4 py-2 text-xs" style={{ background: "var(--color-text)", color: "var(--color-surface)" }}>
        <span className="font-semibold">Preview</span>
        <span style={{ opacity: 0.7 }}>The popup as the extension injects it · Alt+Shift+N cycles</span>
        <span className="flex-1" />
        {scenarios.map((s) => (
          <button
            key={s.id}
            type="button"
            onClick={() => pick(s.id)}
            title={s.title}
            className="px-2 py-1"
            style={{
              borderRadius: "var(--radius-sm)",
              background: s.id === scenario ? "var(--color-accent)" : "transparent",
              border: "1px solid var(--color-text-muted)",
              color: "var(--color-surface)",
            }}
          >
            {s.id.replace(/^scn_\d_/, "")}
          </button>
        ))}
        <button type="button" onClick={replay} className="px-2 py-1" style={{ borderRadius: "var(--radius-sm)", background: "var(--color-surface)", color: "var(--color-text)" }}>
          Replay popup
        </button>
      </div>

      {/* generic shop header */}
      <header className="flex items-center gap-6 px-8 py-4" style={{ background: "var(--color-surface)", borderBottom: "1px solid var(--color-border)" }}>
        <span className="text-xl font-bold tracking-tight">shop.example</span>
        <div className="flex-1 max-w-xl px-4 py-2 text-sm nudge-muted" style={{ background: "var(--color-surface-2)", borderRadius: "var(--radius-sm)" }}>
          Search
        </div>
        <span className="text-sm nudge-muted">Secure checkout</span>
      </header>

      {/* checkout */}
      <main className="flex-1 w-full max-w-6xl mx-auto px-8 py-8 grid grid-cols-[1fr_320px] gap-8">
        <div className="flex flex-col gap-6">
          <h1 className="text-2xl font-semibold">Review your order</h1>

          <section className="p-5 flex flex-col gap-2" style={{ background: "var(--color-surface)", border: "1px solid var(--color-border)", borderRadius: "var(--radius-md)" }}>
            <h2 className="font-semibold">Delivery address</h2>
            <p className="text-sm nudge-muted">Flat 4, 12 Oxford Road, Manchester M1 5QA</p>
          </section>

          <section className="p-5 flex flex-col gap-4" style={{ background: "var(--color-surface)", border: "1px solid var(--color-border)", borderRadius: "var(--radius-md)" }}>
            <h2 className="font-semibold">Items</h2>
            {error && <p className="nudge-error px-3 py-2 text-sm">{error}</p>}
            {!assessment && !error && <p className="text-sm nudge-muted">Loading basket…</p>}
            {items.map((it) => (
              <div key={it.index} className="flex gap-4 items-start">
                <div className="w-20 h-20 shrink-0" style={{ background: "var(--color-surface-2)", borderRadius: "var(--radius-sm)" }} />
                <div className="flex-1">
                  <p className="font-semibold">{it.name}</p>
                  <p className="text-sm nudge-muted">
                    {CATEGORY_LABELS[it.category]} · Qty {it.qty}
                  </p>
                  {assessment?.cues.map((c, i) => (
                    <p key={i} className="text-sm font-semibold mt-1" style={{ color: "var(--color-stop)" }}>
                      {c.text}
                    </p>
                  ))}
                </div>
                <p className="font-semibold">{money(it.pricePence * it.qty)}</p>
              </div>
            ))}
          </section>
        </div>

        <aside className="flex flex-col gap-4">
          <section className="p-5 flex flex-col gap-3" style={{ background: "var(--color-surface)", border: "1px solid var(--color-border)", borderRadius: "var(--radius-md)" }}>
            <button
              type="button"
              onClick={replay}
              className="w-full py-3 font-semibold"
              style={{ background: "var(--color-accent)", color: "var(--color-surface)", borderRadius: "var(--radius-sm)" }}
            >
              Place your order
            </button>
            <h2 className="font-semibold">Order summary</h2>
            <div className="flex justify-between text-sm">
              <span>Items</span>
              <span>{money(subtotal)}</span>
            </div>
            <div className="flex justify-between text-sm">
              <span>Delivery</span>
              <span>{delivery ? money(delivery) : "FREE"}</span>
            </div>
            <div className="flex justify-between font-semibold pt-2" style={{ borderTop: "1px solid var(--color-border)" }}>
              <span>Order total</span>
              <span>{assessment ? money(assessment.totalPence) : "…"}</span>
            </div>
          </section>

          <section className="p-3 text-xs nudge-mono flex flex-col gap-1" style={{ background: "var(--color-surface-2)", borderRadius: "var(--radius-sm)" }}>
            <span className="font-semibold">Host messages</span>
            {log.length === 0 ? <span className="nudge-muted">none yet</span> : log.map((l, i) => <span key={i}>{l}</span>)}
            {!open && assessment && <span className="nudge-muted">Popup closed. Press Replay popup or Place your order.</span>}
          </section>
        </aside>
      </main>

      {/* the injected nudge: fixed top-right, 400px wide, height from its resize message */}
      {open && assessment && (
        <iframe
          key={assessment.id}
          ref={frame}
          src={`/nudge?assessmentId=${assessment.id}`}
          title="Spending nudge"
          className="fixed z-50"
          style={{
            // the real extension pins it 16px from the top; here it sits below the preview toolbar
            top: 44,
            right: 16,
            width: 400,
            height,
            maxHeight: "calc(100vh - 60px)",
            border: 0,
            background: "transparent",
            colorScheme: "normal",
          }}
        />
      )}
    </div>
  );
}
