"use client";
import Link from "next/link";
import { useId, useState, type ReactNode } from "react";
import { BRAND } from "@/lib/brand";
import { hostOpenDashboard, isHosted } from "@/lib/host";
import { CATEGORY_LABELS, type AssessedItem, type Assessment } from "@/lib/types";
import type { DecisionIn } from "./api";
import { AnimatedNumber } from "./AnimatedNumber";
import { BAND_LABEL, FACTOR_LABEL, band, day, money, monthOf, pounds } from "./format";
import type { DoneInfo } from "./NudgeClient";
import { TimelineChart } from "./TimelineChart";

type Props = {
  assessment: Assessment;
  busy: string | null;
  error: string | null;
  done: DoneInfo | null;
  onNegotiate: (optionId: string) => void;
  onReason: (text: string) => void;
  onEssential: (itemIndex: number, essential: boolean) => void;
  onDecision: (d: DecisionIn) => void;
};

const pct = (n: number) => `${n}%`;
const hours = (n: number) => (Number.isInteger(n) ? `${n}` : n.toFixed(1));

/**
 * Compact card (headline, risk, the cost in hours, money lines, best compromise, two buttons),
 * then the "Why are you buying it?" pill bar underneath with the reply as a chat bubble.
 * The detail (items, cues, reasoning, factors, timeline) lives behind Show details.
 */
export function NudgeCard(props: Props) {
  const { assessment: a, busy, error, done } = props;
  const locked = !!busy || !!done;
  const best = [...a.negotiation].sort((x, y) => x.resultRegretRisk - y.resultRegretRisk)[0];

  return (
    <div className="flex flex-col gap-3">
      <article className="nudge-card flex flex-col" data-busy={busy ? "true" : "false"} aria-busy={!!busy} aria-labelledby="nudge-headline">
        <div className="flex flex-col gap-4 p-5">
          {/* title row */}
          <div className="flex items-start gap-3">
            <div className="flex-1 min-w-0 flex flex-col gap-1">
              <span className="text-xs nudge-muted">
                {BRAND.name} · {a.merchant} · <span className="nudge-num">{money(a.totalPence)}</span>
              </span>
              <h1 id="nudge-headline" className="text-lg font-semibold leading-snug">
                {a.headline}
              </h1>
            </div>
            {!done && (
              <button
                type="button"
                className="nudge-btn nudge-btn-ghost w-8 h-8 shrink-0 flex items-center justify-center"
                aria-label="Dismiss (Esc)"
                title="Dismiss (Esc)"
                disabled={locked}
                onClick={() => props.onDecision("dismiss")}
              >
                ✕
              </button>
            )}
          </div>

          <RiskRow a={a} />
          <HoursStrip a={a} />
          <MoneyLines a={a} />

          {/* meet in the middle: the best option only */}
          {best && !done && (
            <div className="nudge-accent-panel px-3 py-2 flex items-center gap-3">
              <div className="flex-1 min-w-0 text-sm">
                <p className="font-semibold">{best.text}</p>
                <p className="text-xs nudge-muted mt-0.5">
                  Risk drops to{" "}
                  <span className={`nudge-band-text nudge-band-${band(best.resultRegretRisk)} font-semibold`}>{best.resultRegretRisk}%</span> ·{" "}
                  {pounds(best.resultSafeToSpendAfterPence)} safe after
                </p>
              </div>
              <button
                type="button"
                className="nudge-btn nudge-btn-accent nudge-btn-small px-3 py-1.5 shrink-0"
                disabled={locked}
                onClick={() => props.onNegotiate(best.id)}
              >
                {busy === `neg:${best.id}` ? "Applying…" : "Apply"}
              </button>
            </div>
          )}

          {error && (
            <p className="nudge-error px-3 py-2 text-sm" role="alert">
              {error}
            </p>
          )}

          {done ? <DoneState a={a} done={done} /> : <Decisions a={a} busy={busy} disabled={locked} onDecision={props.onDecision} />}
        </div>

        <ShowMore a={a} disabled={locked} busy={busy} onEssential={props.onEssential} />
      </article>

      {!done && <ReasonBar a={a} disabled={locked} busy={busy === "reason"} onSubmit={props.onReason} />}
    </div>
  );
}

function RiskRow({ a }: { a: Assessment }) {
  const b = band(a.regretRisk);
  return (
    <section className={`nudge-band-${b} flex flex-col gap-2`} aria-label="Regret risk">
      <div className="flex items-center gap-3">
        <span className="nudge-band-text nudge-risk-figure text-4xl font-bold leading-none" aria-live="polite">
          <AnimatedNumber value={a.regretRisk} format={pct} />
        </span>
        <span className="flex-1 text-sm leading-tight">
          regret risk
          <span className="block text-[10px] nudge-muted uppercase tracking-wider">experimental</span>
        </span>
        <span className="nudge-band-pill text-xs px-2 py-0.5">{BAND_LABEL[b]}</span>
      </div>
      <div className="nudge-meter h-1.5" aria-hidden>
        <span style={{ width: `${Math.max(0, Math.min(100, a.regretRisk))}%` }} />
      </div>
    </section>
  );
}

/** The cost in working time, made hard to skim past. */
function HoursStrip({ a }: { a: Assessment }) {
  const im = a.impact;
  return (
    <section className="nudge-hours px-4 py-3 flex items-center gap-3" aria-label="Cost in working hours">
      <span className="nudge-hours-figure nudge-num">
        <AnimatedNumber value={Math.round(im.workingHours * 10)} format={(n) => hours(n / 10)} />
        <span className="nudge-hours-unit">hrs</span>
      </span>
      <span className="text-sm leading-snug">
        <strong>of work at your job</strong> to pay for this.
        {im.goalSharePct > 0 && <span className="block text-xs nudge-muted mt-0.5">Or {im.goalSharePct}% of your savings goal.</span>}
      </span>
    </section>
  );
}

function MoneyLines({ a }: { a: Assessment }) {
  const im = a.impact;
  const over = !!im.limit && im.limit.overByPence > 0;
  return (
    <section className="nudge-impact flex flex-col" aria-label="What it does to your money">
      <MoneyRow
        label={<>Safe to spend until {day(im.nextIncome.date)}</>}
        sub={`was ${pounds(im.safeToSpendBeforePence)}`}
        value={<AnimatedNumber value={im.safeToSpendAfterPence} format={pounds} />}
        tone={im.safeToSpendAfterPence < 0 ? "stop" : undefined}
      />
      {im.limit && (
        <MoneyRow
          label={<>{CATEGORY_LABELS[im.limit.category]} limit this week</>}
          sub={`${pounds(im.limit.spentThisWeekPence)} of ${pounds(im.limit.weeklyLimitPence)} spent so far`}
          value={
            <>
              <AnimatedNumber value={over ? im.limit.overByPence : im.limit.remainingAfterPence} format={pounds} /> {over ? "over" : "left"}
            </>
          }
          tone={over ? "stop" : "go"}
        />
      )}
      <MoneyRow
        label={
          <>
            {im.nextBill.name} {pounds(im.nextBill.amountPence)}, {day(im.nextBill.date)}
          </>
        }
        value={im.nextBill.coveredAfter ? "Covered" : "Not covered"}
        tone={im.nextBill.coveredAfter ? "go" : "stop"}
      />
      {im.overdraftUntil && <p className="nudge-error px-3 py-2 text-sm mt-2">You’d be overdrawn until {day(im.overdraftUntil)}.</p>}
    </section>
  );
}

function MoneyRow({ label, sub, value, tone }: { label: ReactNode; sub?: string; value: ReactNode; tone?: "go" | "stop" }) {
  return (
    <div className="nudge-row flex items-baseline gap-3 py-2">
      <span className="flex-1 min-w-0 text-sm">
        {label}
        {sub && <span className="block text-xs nudge-muted">{sub}</span>}
      </span>
      <span className={`text-base font-bold nudge-num shrink-0 ${tone ? `nudge-band-text nudge-band-${tone}` : ""}`}>{value}</span>
    </div>
  );
}

function Decisions({ a, busy, disabled, onDecision }: { a: Assessment; busy: string | null; disabled: boolean; onDecision: (d: DecisionIn) => void }) {
  const lowRisk = a.verdict === "essential_cover" || band(a.regretRisk) === "go";
  const wait = (
    <button
      key="wait"
      type="button"
      className={`nudge-btn ${lowRisk ? "nudge-btn-ghost" : "nudge-btn-primary"} px-4 py-2`}
      disabled={disabled}
      onClick={() => onDecision("wait")}
    >
      {busy === "dec:wait" ? "Saving…" : "I’ll wait"}
    </button>
  );
  const buy = (
    <button
      key="buy"
      type="button"
      className={`nudge-btn ${lowRisk ? "nudge-btn-primary" : "nudge-btn-ghost"} px-4 py-2`}
      disabled={disabled}
      onClick={() => onDecision("buy_anyway")}
    >
      {busy === "dec:buy_anyway" ? "Saving…" : lowRisk ? "Buying it" : "Buying anyway"}
    </button>
  );
  // like "No, thanks · Clean up": the quiet option first, the recommended one last and filled
  return <div className="flex justify-end items-center gap-2">{lowRisk ? [wait, buy] : [buy, wait]}</div>;
}

/** The "Why are you buying it?" pill bar under the card, with the exchange as chat bubbles. */
function ReasonBar({ a, disabled, busy, onSubmit }: { a: Assessment; disabled: boolean; busy: boolean; onSubmit: (t: string) => void }) {
  const [text, setText] = useState("");
  const inputId = useId();
  return (
    <section className="flex flex-col gap-2" aria-label="Your reason">
      {a.reason && (
        <>
          <p className="nudge-bubble-user self-end px-4 py-2 text-sm max-w-[80%]">{a.reason.text}</p>
          <div className="nudge-bubble-reply px-4 py-3 text-sm flex flex-col gap-1" role="status">
            <p>{a.reason.verdictText}</p>
            <p className="text-xs nudge-muted">
              Risk now <strong className={`nudge-band-text nudge-band-${band(a.regretRisk)}`}>{a.regretRisk}%</strong>
              {a.reason.adjustment !== 0 && (
                <>
                  {" "}
                  ({a.reason.adjustment > 0 ? "+" : ""}
                  {a.reason.adjustment}). Your money picture doesn’t change.
                </>
              )}
            </p>
          </div>
        </>
      )}
      {busy && <p className="nudge-bubble-reply nudge-thinking px-4 py-2 text-sm nudge-muted self-start">Thinking…</p>}
      <form
        className="nudge-pill flex items-center gap-2 pl-5 pr-1.5 py-1.5"
        onSubmit={(e) => {
          e.preventDefault();
          const t = text.trim();
          if (t) {
            onSubmit(t);
            setText("");
          }
        }}
      >
        <label htmlFor={inputId} className="sr-only">
          Why are you buying it?
        </label>
        <input
          id={inputId}
          className="nudge-pill-input flex-1 min-w-0 py-2"
          placeholder={a.reason ? "Try another reason…" : "Why are you buying it?"}
          value={text}
          onChange={(e) => setText(e.target.value)}
          disabled={disabled}
          maxLength={200}
        />
        <button
          type="submit"
          className="nudge-btn nudge-btn-primary nudge-pill-send w-9 h-9 shrink-0 flex items-center justify-center"
          disabled={disabled || !text.trim()}
          aria-label="Send reason"
        >
          ↑
        </button>
      </form>
    </section>
  );
}

function DoneState({ a, done }: { a: Assessment; done: DoneInfo }) {
  let text: string;
  if (done.decision === "wait") {
    text = done.waitingItem
      ? `${done.waitingItem.itemName} is on your waiting list. I’ll ask again ${day(done.waitingItem.reconsiderAt)}.`
      : "Saved to your waiting list.";
  } else if (done.decision === "buy_anyway") {
    text = done.purchase?.reflectionDueAt
      ? `Fair enough. I’ll ask if you’re glad you bought it on ${day(done.purchase.reflectionDueAt)}.`
      : `Fair enough. I’ll check in about it in ${a.reflectionDays} days.`;
  } else {
    text = "Dismissed. I won’t mention it again.";
  }
  // Aarav's dashboard routes: the page that shows what this decision just created
  const path = done.decision === "wait" ? "/waiting" : done.decision === "buy_anyway" ? "/purchases" : "/home";
  const linkText = done.decision === "wait" ? "See your waiting list" : done.decision === "buy_anyway" ? "See your purchases" : "Open the dashboard";
  return (
    <div className="nudge-panel px-3 py-3 flex flex-col gap-2" role="status">
      <p className="text-sm">{text}</p>
      {!isHosted() ? (
        <Link href={path} className="text-xs nudge-muted underline">
          {linkText}
        </Link>
      ) : (
        <button type="button" className="nudge-btn nudge-btn-ghost text-xs self-start p-0" onClick={() => hostOpenDashboard(path)}>
          {linkText}
        </button>
      )}
    </div>
  );
}

function ItemRow({
  item,
  disabled,
  busy,
  onEssential,
}: {
  item: AssessedItem;
  disabled: boolean;
  busy: boolean;
  onEssential: (itemIndex: number, essential: boolean) => void;
}) {
  const isEssential = item.essential ?? item.necessityTag === "need";
  const tag = item.essential === true ? "need" : item.essential === false && item.necessityTag === "need" ? "want" : item.necessityTag;
  return (
    <li className="nudge-panel px-3 py-2 flex flex-col gap-1">
      <div className="flex items-start gap-2">
        <div className="flex-1 min-w-0">
          <p className="text-sm font-semibold leading-snug">
            {item.name}
            {item.qty > 1 && <span className="nudge-muted font-normal"> ×{item.qty}</span>}
          </p>
          <p className="text-xs nudge-muted">
            {money(item.pricePence * item.qty)} · {CATEGORY_LABELS[item.category]}
          </p>
        </div>
        <div className="flex flex-col items-end gap-1 shrink-0">
          <span className={`text-sm font-bold nudge-num nudge-band-text nudge-band-${band(item.regretRisk)}`}>
            <AnimatedNumber value={item.regretRisk} format={pct} />
          </span>
          <button
            type="button"
            className={`nudge-chip nudge-chip-${tag} px-2 py-0.5`}
            disabled={disabled}
            onClick={() => onEssential(item.index, !isEssential)}
            aria-label={`${item.name} is marked ${tag}. Tap to mark it ${isEssential ? "not essential" : "essential"}.`}
            title={isEssential ? "Tap: not essential" : "Tap: this is essential"}
          >
            {busy ? "…" : tag}
          </button>
        </div>
      </div>
      {item.duplicateOf && (
        <p className="text-xs">
          You bought {item.duplicateOf.item} in {monthOf(item.duplicateOf.purchasedAt)}.
        </p>
      )}
      {item.limitedHistory && <p className="text-xs nudge-muted">Not much history for this yet, so this is a rough guess.</p>}
    </li>
  );
}

function ShowMore({
  a,
  disabled,
  busy,
  onEssential,
}: {
  a: Assessment;
  disabled: boolean;
  busy: string | null;
  onEssential: (itemIndex: number, essential: boolean) => void;
}) {
  const [open, setOpen] = useState(false);
  const panelId = useId();
  return (
    <div className="nudge-divider">
      <button
        type="button"
        className="nudge-btn nudge-btn-ghost w-full px-5 py-3 text-sm flex items-center justify-between"
        aria-expanded={open}
        aria-controls={panelId}
        onClick={() => setOpen((o) => !o)}
      >
        <span>{open ? "Hide details" : "Show details"}</span>
        <span aria-hidden>{open ? "▴" : "▾"}</span>
      </button>
      <div id={panelId} className="nudge-expand" data-open={open} inert={!open}>
        <div>
          <div className="flex flex-col gap-4 px-5 pb-5">
            <section className="flex flex-col gap-2">
              <h2 className="nudge-section-title">In your basket</h2>
              <ul className="flex flex-col gap-2">
                {a.items.map((it) => (
                  <ItemRow key={it.index} item={it} disabled={disabled} busy={busy === `ess:${it.index}`} onEssential={onEssential} />
                ))}
              </ul>
            </section>

            {a.cues.length > 0 && (
              <section className="flex flex-col gap-2">
                <h2 className="nudge-section-title">Sales cues on this page</h2>
                {a.cues.map((c, i) => (
                  <div key={`${c.key}-${i}`} className="nudge-panel px-3 py-2 text-sm">
                    <p className="font-semibold">“{c.text}”</p>
                    <p className="nudge-muted text-xs mt-0.5">{c.note}</p>
                  </div>
                ))}
              </section>
            )}

            {a.negotiation.length > 1 && (
              <section className="flex flex-col gap-1">
                <h2 className="nudge-section-title">Other options</h2>
                {a.negotiation.map((n) => (
                  <p key={n.id} className="text-sm">
                    {n.text} <span className="nudge-muted">→ {n.resultRegretRisk}%</span>
                  </p>
                ))}
              </section>
            )}

            <section className="flex flex-col gap-1">
              <h2 className="nudge-section-title">How I got there</h2>
              <p className="text-sm leading-relaxed">{a.reasoning}</p>
            </section>

            {a.items.map((it) => (
              <section key={it.index} className="flex flex-col gap-2">
                <h2 className="nudge-section-title">
                  {it.name} · <span className={`nudge-band-text nudge-band-${band(it.regretRisk)}`}>{it.regretRisk}%</span>
                </h2>
                <ul className="flex flex-col gap-2">
                  {it.factors.map((f, i) => (
                    <li key={`${f.key}-${i}`} className="nudge-panel px-3 py-2 flex flex-col gap-1">
                      <div className="flex items-center justify-between text-xs">
                        <span className="font-semibold">{FACTOR_LABEL[f.key] ?? f.key}</span>
                        <span className="nudge-num nudge-mono">
                          {f.points}/{f.max}
                        </span>
                      </div>
                      {f.max > 0 && (
                        <div className="nudge-bar h-1" aria-hidden>
                          <span style={{ width: `${Math.max(0, Math.min(100, (f.points / f.max) * 100))}%` }} />
                        </div>
                      )}
                      <p className="text-xs">{f.text}</p>
                      {f.evidence && <p className="text-xs nudge-muted">{f.evidence}</p>}
                    </li>
                  ))}
                </ul>
              </section>
            ))}

            <section className="flex flex-col gap-2">
              <h2 className="nudge-section-title">Your money, next few weeks</h2>
              <TimelineChart points={a.timeline} />
            </section>

            <p className="text-sm">
              <strong className="nudge-num">{a.calibration.tunedPct}%</strong> tuned to you on {CATEGORY_LABELS[a.calibration.category].toLowerCase()}
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
