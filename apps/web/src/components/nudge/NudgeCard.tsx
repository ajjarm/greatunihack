"use client";
import { useId, useState, type ReactNode } from "react";
import Link from "next/link";
import { BRAND } from "@/lib/brand";
import { hostOpenDashboard, isHosted } from "@/lib/host";
import { CATEGORY_LABELS, type AssessedItem, type Assessment } from "@/lib/types";
import type { DecisionIn } from "./api";
import { AnimatedNumber } from "./AnimatedNumber";
import { BAND_LABEL, FACTOR_LABEL, VERDICT_LABEL, band, day, money, monthOf } from "./format";
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

export function NudgeCard(props: Props) {
  const { assessment: a, busy, error, done } = props;
  const b = band(a.regretRisk);
  const locked = !!busy || !!done;
  const prompts = a.items.filter((it) => it.essentialPrompt && it.essential === null);

  return (
    <article
      className="nudge-card flex flex-col"
      data-busy={busy ? "true" : "false"}
      aria-busy={!!busy}
      aria-labelledby="nudge-headline"
    >
      <div className="flex flex-col gap-4 p-5">
        {/* header */}
        <div className="flex items-center justify-between text-xs nudge-muted">
          <span className="font-semibold">{BRAND.name}</span>
          <span>
            {a.merchant} · <span className="nudge-num">{money(a.totalPence)}</span>
          </span>
        </div>

        {/* 1. headline */}
        <h1 id="nudge-headline" className="text-lg font-semibold leading-snug">
          {a.headline}
        </h1>

        {/* 2. regret risk */}
        <RiskPanel a={a} />

        {/* 3. impact */}
        <Impact a={a} />

        {/* 6. essential prompt (above the factors) */}
        {prompts.map((it) => (
          <EssentialPrompt key={it.index} item={it} disabled={locked} busy={busy === `ess:${it.index}`} onAnswer={props.onEssential} />
        ))}

        {/* 4. factors */}
        {a.topFactors.length > 0 && (
          <section aria-label="Why" className="flex flex-col gap-2">
            <h2 className="nudge-section-title">Why</h2>
            <ul className="flex flex-col gap-1.5 text-sm">
              {a.topFactors.slice(0, 3).map((f) => (
                <li key={f.key} className="flex gap-2">
                  <span className={`nudge-band-text nudge-band-${b}`} aria-hidden>
                    •
                  </span>
                  <span>{f.text}</span>
                </li>
              ))}
            </ul>
          </section>
        )}

        {/* 5. items */}
        <section aria-label="Items" className="flex flex-col gap-2">
          <h2 className="nudge-section-title">In your basket</h2>
          <ul className="flex flex-col gap-2">
            {a.items.map((it) => (
              <ItemRow key={it.index} item={it} disabled={locked} busy={busy === `ess:${it.index}`} onEssential={props.onEssential} />
            ))}
          </ul>
        </section>

        {/* 7. cues */}
        {a.cues.length > 0 && (
          <section aria-label="Sales cues" className="flex flex-col gap-2">
            <h2 className="nudge-section-title">Sales cues on this page</h2>
            <ul className="flex flex-col gap-2">
              {a.cues.map((c, i) => (
                <li key={`${c.key}-${i}`} className="nudge-panel px-3 py-2 text-sm">
                  <p className="font-semibold">“{c.text}”</p>
                  <p className="nudge-muted text-xs mt-0.5">{c.note}</p>
                </li>
              ))}
            </ul>
          </section>
        )}

        {/* 8. negotiation */}
        {a.negotiation.length > 0 && !done && (
          <section aria-label="Meet in the middle" className="flex flex-col gap-2">
            <h2 className="nudge-section-title">Meet in the middle</h2>
            <ul className="flex flex-col gap-2">
              {a.negotiation.map((n) => {
                const nb = band(n.resultRegretRisk);
                return (
                  <li key={n.id} className="nudge-accent-panel px-3 py-2 flex items-center gap-3">
                    <div className="flex-1 min-w-0 text-sm">
                      <p className="font-semibold">{n.text}</p>
                      <p className="text-xs nudge-muted mt-0.5">
                        Risk <span className={`nudge-band-text nudge-band-${nb} font-semibold`}>{n.resultRegretRisk}%</span> · {money(n.resultSafeToSpendAfterPence)} safe after
                        {n.delayUntil ? ` · until ${day(n.delayUntil)}` : ""}
                      </p>
                    </div>
                    <button
                      type="button"
                      className="nudge-btn nudge-btn-accent nudge-btn-small px-3 py-1.5 shrink-0"
                      disabled={locked}
                      onClick={() => props.onNegotiate(n.id)}
                    >
                      {busy === `neg:${n.id}` ? "Applying…" : "Apply"}
                    </button>
                  </li>
                );
              })}
            </ul>
          </section>
        )}

        {/* 9. reason */}
        {!done && <ReasonBox a={a} disabled={locked} busy={busy === "reason"} onSubmit={props.onReason} />}

        {error && (
          <p className="nudge-error px-3 py-2 text-sm" role="alert">
            {error}
          </p>
        )}

        {/* 10. decision buttons, or the quiet done state */}
        {done ? <DoneState a={a} done={done} /> : <Decisions a={a} busy={busy} disabled={locked} onDecision={props.onDecision} />}
      </div>

      {/* 11. show more */}
      <ShowMore a={a} />
    </article>
  );
}

function RiskPanel({ a }: { a: Assessment }) {
  const b = band(a.regretRisk);
  return (
    <section className={`nudge-risk-panel nudge-band-${b} px-4 py-3 flex flex-col gap-2`} aria-label="Regret risk">
      <div className="flex items-end justify-between gap-3">
        <div className="flex items-baseline gap-2">
          <span className="nudge-band-text nudge-risk-figure text-5xl font-bold leading-none" aria-live="polite">
            <AnimatedNumber value={a.regretRisk} format={pct} />
          </span>
          <span className="text-sm">regret risk</span>
        </div>
        <div className="flex flex-col items-end gap-1">
          <span className="nudge-band-pill text-xs px-2 py-0.5">{BAND_LABEL[b]}</span>
          <span className="text-[10px] nudge-muted uppercase tracking-wider">experimental</span>
        </div>
      </div>
      <div className="nudge-meter h-1.5" aria-hidden>
        <span style={{ width: `${Math.max(0, Math.min(100, a.regretRisk))}%` }} />
      </div>
      <p className="text-xs nudge-muted">{VERDICT_LABEL[a.verdict]}</p>
    </section>
  );
}

function Impact({ a }: { a: Assessment }) {
  const im = a.impact;
  return (
    <section className="nudge-impact flex flex-col gap-3" aria-label="What it does to your money">
      <ImpactLine
        figure={<AnimatedNumber value={im.safeToSpendAfterPence} format={money} />}
        tone={im.safeToSpendAfterPence < 0 ? "stop" : undefined}
        text={
          <>
            safe to spend after this until {day(im.nextIncome.date)}{" "}
            <span className="nudge-muted">
              ({im.nextIncome.name}, {im.daysToNextIncome} {im.daysToNextIncome === 1 ? "day" : "days"})
            </span>
          </>
        }
        sub={`was ${money(im.safeToSpendBeforePence)}`}
      />
      <ImpactLine
        figure={money(im.nextBill.amountPence)}
        tone={im.nextBill.coveredAfter ? undefined : "stop"}
        text={
          <>
            {im.nextBill.name} on {day(im.nextBill.date)}:{" "}
            <span className={`nudge-band-text nudge-band-${im.nextBill.coveredAfter ? "go" : "stop"} font-semibold`}>
              {im.nextBill.coveredAfter ? "still covered" : "not covered after this"}
            </span>
          </>
        }
      />
      {im.limit && (
        <ImpactLine
          figure={<AnimatedNumber value={im.limit.overByPence > 0 ? im.limit.overByPence : im.limit.remainingAfterPence} format={money} />}
          tone={im.limit.overByPence > 0 ? "stop" : "go"}
          text={
            im.limit.overByPence > 0 ? (
              <>over your {CATEGORY_LABELS[im.limit.category].toLowerCase()} limit this week</>
            ) : (
              <>left of your {CATEGORY_LABELS[im.limit.category].toLowerCase()} limit this week</>
            )
          }
          sub={`${money(im.limit.spentThisWeekPence)} of ${money(im.limit.weeklyLimitPence)} spent so far`}
        />
      )}
      <p className="text-sm nudge-muted">
        That’s <strong className="nudge-num" style={{ color: "var(--color-text)" }}>{im.workingHours} hours</strong> at your job
        {im.goalSharePct > 0 && (
          <>
            {" "}and <strong className="nudge-num" style={{ color: "var(--color-text)" }}>{im.goalSharePct}%</strong> of your savings goal
          </>
        )}
        .
      </p>
      {im.overdraftUntil && (
        <p className="nudge-error px-3 py-2 text-sm">You’d be overdrawn until {day(im.overdraftUntil)}.</p>
      )}
    </section>
  );
}

function ImpactLine({ figure, text, sub, tone }: { figure: ReactNode; text: ReactNode; sub?: string; tone?: "go" | "stop" }) {
  return (
    <div className="flex items-baseline gap-3">
      <span
        className={`text-2xl font-bold nudge-num shrink-0 min-w-[84px] ${tone ? `nudge-band-text nudge-band-${tone}` : ""}`}
      >
        {figure}
      </span>
      <span className="text-sm leading-snug">
        {text}
        {sub && <span className="block text-xs nudge-muted mt-0.5">{sub}</span>}
      </span>
    </div>
  );
}

function EssentialPrompt({
  item,
  disabled,
  busy,
  onAnswer,
}: {
  item: AssessedItem;
  disabled: boolean;
  busy: boolean;
  onAnswer: (itemIndex: number, essential: boolean) => void;
}) {
  return (
    <section className="nudge-accent-panel px-3 py-3 flex flex-col gap-2" aria-label={`Is ${item.name} essential?`}>
      <p className="text-sm">
        <span className="font-semibold">{item.name}</span> looks like it might be essential. Is it?
      </p>
      <div className="flex gap-2">
        <button type="button" className="nudge-btn nudge-btn-primary px-4 py-1.5" disabled={disabled} onClick={() => onAnswer(item.index, true)}>
          {busy ? "Saving…" : "Yes"}
        </button>
        <button type="button" className="nudge-btn nudge-btn-secondary px-4 py-1.5" disabled={disabled} onClick={() => onAnswer(item.index, false)}>
          No
        </button>
      </div>
    </section>
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
  const ib = band(item.regretRisk);
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
          <span className={`text-sm font-bold nudge-num nudge-band-text nudge-band-${ib}`}>
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

function ReasonBox({ a, disabled, busy, onSubmit }: { a: Assessment; disabled: boolean; busy: boolean; onSubmit: (t: string) => void }) {
  const [text, setText] = useState("");
  const inputId = useId();
  return (
    <section className="flex flex-col gap-2" aria-label="Your reason">
      <form
        className="flex gap-2"
        onSubmit={(e) => {
          e.preventDefault();
          if (text.trim()) onSubmit(text.trim());
        }}
      >
        <label htmlFor={inputId} className="sr-only">
          Why are you buying it?
        </label>
        <input
          id={inputId}
          className="nudge-input flex-1 min-w-0 px-3 py-2"
          placeholder="Why are you buying it?"
          value={text}
          onChange={(e) => setText(e.target.value)}
          disabled={disabled}
          maxLength={200}
        />
        <button type="submit" className="nudge-btn nudge-btn-secondary px-3 py-2" disabled={disabled || !text.trim()}>
          {busy ? "Thinking…" : "Tell me"}
        </button>
      </form>
      {a.reason && (
        <div className={`nudge-risk-panel nudge-band-${a.reason.accepted ? "go" : "think"} px-3 py-2 text-sm`} role="status">
          <p className="text-xs nudge-muted">You said: “{a.reason.text}”</p>
          <p className="mt-1">{a.reason.verdictText}</p>
          <p className="text-xs mt-1">
            Risk now <strong className={`nudge-band-text nudge-band-${band(a.regretRisk)}`}>{a.regretRisk}%</strong>
            {a.reason.adjustment !== 0 && (
              <span className="nudge-muted">
                {" "}
                ({a.reason.adjustment > 0 ? "+" : ""}
                {a.reason.adjustment} points). Your money picture doesn’t change.
              </span>
            )}
          </p>
        </div>
      )}
    </section>
  );
}

function Decisions({ a, busy, disabled, onDecision }: { a: Assessment; busy: string | null; disabled: boolean; onDecision: (d: DecisionIn) => void }) {
  const lowRisk = a.verdict === "essential_cover" || band(a.regretRisk) === "go";
  return (
    <div className="flex flex-col gap-2 pt-1">
      <div className="flex gap-2">
        <button
          type="button"
          className={`nudge-btn ${lowRisk ? "nudge-btn-secondary" : "nudge-btn-primary"} flex-1 px-3 py-2.5`}
          disabled={disabled}
          onClick={() => onDecision("wait")}
        >
          {busy === "dec:wait" ? "Saving…" : "I’ll wait"}
        </button>
        <button
          type="button"
          className={`nudge-btn ${lowRisk ? "nudge-btn-primary" : "nudge-btn-secondary"} flex-1 px-3 py-2.5`}
          disabled={disabled}
          onClick={() => onDecision("buy_anyway")}
        >
          {busy === "dec:buy_anyway" ? "Saving…" : lowRisk ? "Buying it" : "Buying anyway"}
        </button>
      </div>
      <button type="button" className="nudge-btn nudge-btn-ghost px-3 py-1.5 text-sm" disabled={disabled} onClick={() => onDecision("dismiss")}>
        {busy === "dec:dismiss" ? "Dismissing…" : "Dismiss"} <span className="nudge-muted text-xs font-normal">(Esc)</span>
      </button>
    </div>
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
  return (
    <div className="nudge-panel px-3 py-3 flex flex-col gap-2" role="status">
      <p className="text-sm">{text}</p>
      {!isHosted() ? (
        <Link href="/" className="text-xs nudge-muted underline">
          Open the dashboard
        </Link>
      ) : (
        <button type="button" className="nudge-btn nudge-btn-ghost text-xs self-start p-0" onClick={() => hostOpenDashboard()}>
          Open the dashboard
        </button>
      )}
    </div>
  );
}

function ShowMore({ a }: { a: Assessment }) {
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
        <span>{open ? "Show less" : "Show more"}</span>
        <span aria-hidden>{open ? "▴" : "▾"}</span>
      </button>
      <div id={panelId} className="nudge-expand" data-open={open} inert={!open}>
        <div>
          {(
            <div className="flex flex-col gap-4 px-5 pb-5">
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
                            {f.points > 0 && f.key === "reason" ? "+" : ""}
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
                  <p className="text-xs nudge-muted">
                    Necessity {it.necessity}/100 ({it.necessityTag}, {it.necessityConfidence} confidence)
                  </p>
                </section>
              ))}

              <section className="flex flex-col gap-2">
                <h2 className="nudge-section-title">Your money, next few weeks</h2>
                <TimelineChart points={a.timeline} />
              </section>

              <section className="flex flex-col gap-1">
                <h2 className="nudge-section-title">Tuned to you</h2>
                <p className="text-sm">
                  <strong className="nudge-num">{a.calibration.tunedPct}%</strong> tuned to you on {CATEGORY_LABELS[a.calibration.category].toLowerCase()}
                  <span className="nudge-muted"> · weighting ×{a.calibration.multiplier.toFixed(2)}</span>
                </p>
                <p className="text-xs nudge-muted">Reflection check-in after {a.reflectionDays} days.</p>
              </section>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
