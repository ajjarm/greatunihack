/**
 * Fixture-mode logic: the deterministic edits the API applies when a scenario has no
 * variant, plus the money maths every route shares. Phase 2 replaces the scoring parts
 * with src/lib/brain/** and keeps the money maths. Shared contract; change via a handoff so all lanes stay consistent.
 */
import { randomBytes } from "node:crypto";
import {
  CATEGORIES,
  type AssessRequest,
  type AssessedItem,
  type Assessment,
  type CalibrationRef,
  type Category,
  type Cue,
  type CueKey,
  type Feedback,
  type Impact,
  type LimitImpact,
  type MoneyEvent,
  type NegotiationOption,
  type Persona,
  type Purchase,
  type TimelinePoint,
  type Verdict,
} from "./types";
import { MS_DAY, calibrationFor, demoNowMs, getStore, isoDateOf, toIso, type StoreState } from "./store";

export function newId(prefix: string): string {
  return `${prefix}_${randomBytes(4).toString("hex")}`;
}

export function clamp(n: number, lo: number, hi: number): number {
  return Math.min(hi, Math.max(lo, n));
}

export function isCategory(x: unknown): x is Category {
  return typeof x === "string" && (CATEGORIES as readonly string[]).includes(x);
}

export function pounds(pence: number): string {
  const abs = Math.abs(pence);
  const whole = abs < 1000 && abs % 100 !== 0 ? (abs / 100).toFixed(2) : String(Math.round(abs / 100));
  return `${pence < 0 ? "-" : ""}£${whole}`;
}

// ---------- money maths ----------

/** Earliest income by nextDate. */
export function nextIncome(persona: Persona): MoneyEvent {
  const sorted = [...persona.incomes].sort((a, b) => (a.nextDate < b.nextDate ? -1 : 1));
  const inc = sorted[0];
  if (!inc) return { name: "No income set", date: persona.demoDate, amountPence: 0 };
  return { name: inc.name, date: inc.nextDate, amountPence: inc.amountPence };
}

/** Next outgoing after demoDate by dayOfMonth (wraps into next month). */
export function nextBill(persona: Persona): MoneyEvent {
  const today = new Date(persona.demoDate + "T00:00:00Z");
  let best: { date: string; name: string; amountPence: number } | null = null;
  for (const o of persona.outgoings) {
    let d = new Date(Date.UTC(today.getUTCFullYear(), today.getUTCMonth(), o.dayOfMonth));
    if (d <= today) d = new Date(Date.UTC(today.getUTCFullYear(), today.getUTCMonth() + 1, o.dayOfMonth));
    const iso = d.toISOString().slice(0, 10);
    if (!best || iso < best.date) best = { date: iso, name: o.name, amountPence: o.amountPence };
  }
  return best ?? { name: "No bills set", date: persona.demoDate, amountPence: 0 };
}

export function daysBetween(fromIsoDate: string, toIsoDate: string): number {
  return Math.round((Date.parse(toIsoDate + "T00:00:00Z") - Date.parse(fromIsoDate + "T00:00:00Z")) / MS_DAY);
}

/** Lowest projected balance strictly before the next income lands; falls back to the balance. */
export function safeToSpend(store: StoreState): number {
  const income = nextIncome(store.persona);
  const before = store.timeline.filter((p) => p.date < income.date).map((p) => p.projectedPence);
  if (before.length === 0) return store.persona.balancePence;
  return Math.min(store.persona.balancePence, ...before);
}

/** Sum of purchases in a category in the 7 days ending demoNow (exclusive start, inclusive end). */
export function spentThisWeek(store: StoreState, category: Category): number {
  const end = demoNowMs(store);
  const start = end - 7 * MS_DAY;
  return store.purchases
    .filter((p) => p.category === category)
    .filter((p) => {
      const t = Date.parse(p.purchasedAt);
      return t > start && t <= end;
    })
    .reduce((sum, p) => sum + p.amountPence, 0);
}

export function limitImpact(store: StoreState, category: Category, basketPence: number): LimitImpact | undefined {
  const limit = store.persona.limits.find((l) => l.category === category);
  if (!limit) return undefined;
  const spent = spentThisWeek(store, category);
  return {
    category,
    weeklyLimitPence: limit.weeklyLimitPence,
    spentThisWeekPence: spent,
    remainingAfterPence: limit.weeklyLimitPence - spent - basketPence,
    overByPence: Math.max(0, spent + basketPence - limit.weeklyLimitPence),
  };
}

export function timelineWithBasket(points: TimelinePoint[], totalPence: number): TimelinePoint[] {
  return points.map((p) => ({ ...p, projectedAfterPence: p.projectedPence - totalPence }));
}

/** Date the projection climbs back above zero after a dip the basket causes; null if none. */
export function overdraftUntil(points: TimelinePoint[], totalPence: number): string | null {
  for (let i = 0; i < points.length; i++) {
    const p = points[i];
    if (p.projectedPence - totalPence < 0 && p.projectedPence >= 0) {
      for (let j = i + 1; j < points.length; j++) {
        if (points[j].projectedPence - totalPence >= 0) return points[j].date;
      }
      return points[points.length - 1]?.date ?? null;
    }
  }
  return null;
}

export function buildImpact(store: StoreState, totalPence: number, limitCategory?: Category): Impact {
  const persona = store.persona;
  const income = nextIncome(persona);
  const bill = nextBill(persona);
  const before = safeToSpend(store);
  const after = before - totalPence;
  return {
    safeToSpendBeforePence: before,
    safeToSpendAfterPence: after,
    daysToNextIncome: Math.max(0, daysBetween(persona.demoDate, income.date)),
    nextIncome: income,
    nextBill: { ...bill, coveredAfter: after >= bill.amountPence },
    ...(limitCategory ? { limit: limitImpact(store, limitCategory, totalPence) } : {}),
    workingHours: persona.hourlyRatePence > 0 ? Math.round((totalPence / persona.hourlyRatePence) * 10) / 10 : 0,
    goalSharePct: persona.goal.targetPence > 0 ? Math.round((totalPence / persona.goal.targetPence) * 100) : 0,
    overdraftUntil: overdraftUntil(store.timeline, totalPence),
  };
}

// ---------- verdict bands ----------

export function verdictFor(regretRisk: number, affordability: number, items: AssessedItem[]): Verdict {
  if (items.some((i) => i.essential === true || i.necessity >= 60)) return "essential_cover";
  if (regretRisk >= 70) return "strong_nudge";
  if (regretRisk >= 40) return "nudge";
  return affordability < 40 ? "nudge" : "go_ahead";
}

export function headlineFor(verdict: Verdict, a: Pick<Assessment, "impact" | "regretRisk">): string {
  switch (verdict) {
    case "go_ahead":
      return `Looks fine. ${pounds(a.impact.safeToSpendAfterPence)} safe after this.`;
    case "essential_cover":
      return "Buy it. Here's how to cover it.";
    case "nudge":
      return "Worth a second look before you buy.";
    case "strong_nudge":
      return "Hold on, this looks like an impulse buy.";
  }
}

// ---------- scenario cloning and the generic assessment ----------

export function cloneAssessment(template: Assessment, id: string, createdAt: string): Assessment {
  const copy = JSON.parse(JSON.stringify(template)) as Assessment;
  copy.id = id;
  copy.createdAt = createdAt;
  copy.decision = "none";
  delete copy.reason;
  return copy;
}

const CUE_NOTES: Record<CueKey, string> = {
  scarcity: "Scarcity banners are there to make you hurry. Shops restock.",
  countdown: "A timer is there to make you decide now. Sales come round again.",
  social_proof: "How many people are looking says nothing about whether you need it.",
  sale: "A discount only saves money on something you were going to buy anyway.",
  free_delivery_threshold: "Spending more to get free delivery is still spending more.",
  bnpl: "Four small payments are still the full price.",
  preticked_addon: "A pre-ticked extra is a sale you did not ask for.",
};

export function cueFromInput(key: CueKey, text: string): Cue {
  return { key, text, note: CUE_NOTES[key] ?? "This is a sales cue." };
}

export function buildGenericAssessment(store: StoreState, req: AssessRequest, id: string): Assessment {
  const items: AssessedItem[] = req.items.map((it, index) => ({
    index,
    name: it.name,
    pricePence: it.pricePence,
    qty: it.qty,
    category: isCategory(it.category) ? it.category : "other",
    necessity: 50,
    necessityTag: "useful",
    necessityConfidence: "low",
    essentialPrompt: false,
    essential: null,
    regretRisk: 20,
    factors: [],
    limitedHistory: true,
  }));
  const firstCategory: Category = items[0]?.category ?? "other";
  const impact = buildImpact(store, req.totalPence, firstCategory);
  const persona = store.persona;
  const affordability = clamp(
    Math.round(((persona.balancePence - req.totalPence - impact.nextBill.amountPence) / Math.max(1, persona.balancePence)) * 100),
    0,
    100,
  );
  const base = { impact, regretRisk: 20 };
  return {
    id,
    createdAt: persona.demoNow,
    source: req.source,
    merchant: req.merchant,
    ...(req.url ? { url: req.url } : {}),
    totalPence: req.totalPence,
    verdict: "go_ahead",
    headline: headlineFor("go_ahead", base),
    spokenLine: "Looks fine.",
    regretRisk: 20,
    affordability,
    items,
    impact,
    topFactors: [],
    cues: req.cues.map((c) => cueFromInput(c.key, c.text)),
    negotiation: [],
    reflectionDays: 7,
    reasoning: "No history for this basket yet.",
    timeline: timelineWithBasket(store.timeline, req.totalPence),
    calibration: { ...calibrationFor(firstCategory) },
    decision: "none",
  };
}

// ---------- deterministic fallbacks ----------

const REASON_WORDS = [
  "gift", "birthday", "wedding", "broke", "broken", "replacement", "course", "lecture",
  "prescription", "medicine", "interview", "work",
];

export function reasonAccepted(text: string): boolean {
  const lower = text.toLowerCase();
  return REASON_WORDS.some((w) => new RegExp(`\\b${w}\\b`, "i").test(lower));
}

/** Justification fallback: accepted reasons lower every risk by 30; money never changes. */
export function applyReasonFallback(a: Assessment, text: string): Assessment {
  const accepted = reasonAccepted(text);
  const adjustment = accepted ? -30 : 0;
  const before = a.regretRisk;
  a.items = a.items.map((it) => ({
    ...it,
    regretRisk: clamp(it.regretRisk + adjustment, 0, 100),
    factors: adjustment
      ? [...it.factors.filter((f) => f.key !== "reason"), { key: "reason", points: adjustment, max: 0, text: `Your reason: ${text}` }]
      : it.factors,
  }));
  a.regretRisk = clamp(a.regretRisk + adjustment, 0, 100);
  a.verdict = verdictFor(a.regretRisk, a.affordability, a.items);
  a.headline = headlineFor(a.verdict, a);
  const verdictText = accepted
    ? `That changes the risk, not the money. Risk drops from ${before} to ${a.regretRisk}.`
    : `Noted, but it does not change the picture. Risk stays at ${a.regretRisk}.`;
  a.reason = { text, accepted, adjustment, verdictText };
  if (accepted) {
    const reasonFactor: Assessment["topFactors"][number] = { key: "reason", text: "You gave a reason, so the want score drops" };
    a.topFactors = [reasonFactor, ...a.topFactors].slice(0, 3);
  }
  return a;
}

export function applyEssentialFallback(a: Assessment, itemIndex: number, essential: boolean): Assessment {
  const item = a.items[itemIndex];
  if (!item) return a;
  item.essential = essential;
  if (essential) {
    item.regretRisk = 8;
    item.necessityTag = "need";
    a.regretRisk = Math.min(a.regretRisk, Math.max(8, ...a.items.map((i) => i.regretRisk)));
    a.verdict = "essential_cover";
    a.headline = "Buy it. Here's how to cover it.";
  } else {
    a.verdict = verdictFor(a.regretRisk, a.affordability, a.items);
    a.headline = headlineFor(a.verdict, a);
  }
  return a;
}

export function applyNegotiationFallback(store: StoreState, a: Assessment, option: NegotiationOption): Assessment {
  if (option.action === "drop") {
    a.items = a.items.filter((it) => it.index !== option.itemIndex).map((it, index) => ({ ...it, index }));
    a.totalPence = a.items.reduce((sum, it) => sum + it.pricePence * it.qty, 0);
    const limitCategory = a.impact.limit?.category;
    const fresh = buildImpact(store, a.totalPence, limitCategory);
    a.impact = { ...fresh, safeToSpendBeforePence: a.impact.safeToSpendBeforePence, safeToSpendAfterPence: option.resultSafeToSpendAfterPence };
    a.timeline = timelineWithBasket(store.timeline, a.totalPence);
    a.negotiation = a.negotiation
      .filter((n) => n.id !== option.id && n.itemIndex !== option.itemIndex)
      .map((n) => ({ ...n, itemIndex: n.itemIndex > option.itemIndex ? n.itemIndex - 1 : n.itemIndex }));
  } else {
    const item = a.items[option.itemIndex];
    if (item) item.regretRisk = option.resultRegretRisk;
    a.impact.safeToSpendAfterPence = option.resultSafeToSpendAfterPence;
    a.negotiation = a.negotiation.filter((n) => n.id !== option.id);
  }
  a.regretRisk = option.resultRegretRisk;
  a.verdict = option.resultVerdict;
  a.headline = option.action === "drop" ? `Better. ${pounds(a.impact.safeToSpendAfterPence)} safe after this.` : "Better. That one can wait.";
  a.decision = "negotiated";
  return a;
}

// ---------- feedback and calibration ----------

export function round2(n: number): number {
  return Math.round(n * 100) / 100;
}

export function applyFeedback(purchase: Purchase, feedback: Feedback, reason: string | undefined): CalibrationRef {
  const store = getStore();
  purchase.feedback = feedback;
  if (reason !== undefined) purchase.feedbackReason = reason;
  purchase.feedbackAt = toIso(demoNowMs(store));

  const cal = calibrationFor(purchase.category);
  if (feedback === "happy") cal.multiplier = round2(clamp(cal.multiplier - 0.1, 0.5, 1.5));
  if (feedback === "regretted") cal.multiplier = round2(clamp(cal.multiplier + 0.1, 0.5, 1.5));
  if (feedback !== "unsure") {
    const predicted = purchase.predictedRegret;
    if (typeof predicted === "number") {
      const matches = (predicted >= 50 && feedback === "regretted") || (predicted < 50 && feedback === "happy");
      cal.tunedPct = clamp(cal.tunedPct + (matches ? 2 : -2), 0, 100);
    }
  }
  if (purchase.assessmentId) {
    const h = store.history.find((s) => s.id === purchase.assessmentId);
    if (h) h.outcome = feedback;
  }
  return cal;
}

export function pendingReflections(store: StoreState): Purchase[] {
  const now = demoNowMs(store);
  return store.purchases.filter((p) => p.feedback === null && p.reflectionDueAt && Date.parse(p.reflectionDueAt) <= now);
}

export { isoDateOf };
