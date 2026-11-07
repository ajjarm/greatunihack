/**
 * SPEC 5.6 Spend Score (weekly, 0-100): Claude judges it from the week's facts under fixed
 * guidelines, with a deterministic fallback. Bands: green 75+, amber 50-74, red below.
 * Results are cached by their facts so dashboard polling does not re-ask the model.
 */
import type { Band, Category, ISODate } from "../types";
import { demoNowMs, MS_DAY, type StoreState } from "../store";
import { clamp, daysBetween, nextIncome, safeToSpend, spentThisWeek } from "../logic";
import { askJson, int, obj, str, BrainUnavailable } from "./claude";

export interface SpendFacts {
  weekStart: ISODate;
  nudgesShown: number;
  heeded: number;
  overridden: number;
  overriddenHappy: number;
  overriddenRegretted: number;
  limitsKept: number;
  limitsExceeded: number;
  avoidedPence: number;
  safeToSpendPence: number;
  daysToNextIncome: number;
  previousScore: number | null;
}

export interface SpendScoreResult {
  value: number;
  band: Band;
  explanation: string;
  source: "claude" | "fallback";
}

export function bandFor(value: number): Band {
  return value >= 75 ? "green" : value >= 50 ? "amber" : "red";
}

/** Fixed guidelines in code: never down for spending alone. */
export function spendScoreFallback(f: SpendFacts): SpendScoreResult {
  const perDay = f.safeToSpendPence / Math.max(1, f.daysToNextIncome);
  const cash = f.safeToSpendPence < 0 ? -6 : perDay >= 1500 ? 3 : perDay < 500 ? -3 : 0;
  const value = clamp(
    Math.round(56 + 3 * f.heeded + 2 * f.overriddenHappy - 4 * f.overriddenRegretted + 3 * f.limitsKept - 5 * f.limitsExceeded + cash),
    0,
    100,
  );
  const bits: string[] = [];
  if (f.heeded) bits.push(`you heeded ${f.heeded} of ${f.nudgesShown} nudges`);
  if (f.limitsKept) bits.push(`kept ${f.limitsKept} of ${f.limitsKept + f.limitsExceeded} limits`);
  if (f.overriddenRegretted) bits.push(`regretted ${f.overriddenRegretted} override${f.overriddenRegretted > 1 ? "s" : ""}`);
  const explanation = bits.length ? `This week ${bits.join(", ")}.` : "A quiet week so far.";
  return { value, band: bandFor(value), explanation: explanation.charAt(0).toUpperCase() + explanation.slice(1), source: "fallback" };
}

const SYSTEM = `You score a UK student's week with money from 0 to 100 for a money app. Fixed guidelines:
- Never lower the score for spending alone.
- Raise it for heeded high-risk nudges, limits kept, and overrides the user was later happy with (they had a reason).
- Lower it for overrides later regretted and limits exceeded.
- Cash position matters a little: a negative safe-to-spend is worse than a comfortable one.
- Typical weeks land between 50 and 80; move gradually from the previous score.
explanation: two or three friendly sentences, second person, specific to the facts, no shaming.`;

const SCHEMA = {
  type: "object",
  additionalProperties: false,
  required: ["value", "explanation"],
  properties: { value: { type: "integer" }, explanation: { type: "string" } },
};

const CACHE_KEY = "__brainSpendScoreCache__";
type G = typeof globalThis & { [CACHE_KEY]?: Map<string, SpendScoreResult> };

export async function spendScoreLive(facts: SpendFacts): Promise<SpendScoreResult> {
  const g = globalThis as G;
  if (!g[CACHE_KEY]) g[CACHE_KEY] = new Map();
  const key = JSON.stringify(facts);
  const hit = g[CACHE_KEY].get(key);
  if (hit) return hit;
  const fallback = spendScoreFallback(facts);
  let result: SpendScoreResult;
  try {
    const out = await askJson<{ value: number; explanation: string }>({
      label: "spend-score",
      system: SYSTEM,
      user: JSON.stringify(facts),
      schema: SCHEMA,
      maxTokens: 500,
      validate: (raw) => {
        const o = obj(raw);
        const value = o ? int(o.value, 0, 100) : null;
        const explanation = o ? str(o.explanation, 500) : null;
        return value === null || !explanation ? null : { value, explanation };
      },
    });
    // keep the model within reach of the guideline arithmetic
    const value = clamp(out.value, fallback.value - 15, fallback.value + 15);
    result = { value, band: bandFor(value), explanation: out.explanation, source: "claude" };
  } catch (e) {
    if (!(e instanceof BrainUnavailable)) throw e;
    console.warn("[brain] fallback:", e.message);
    result = fallback;
  }
  g[CACHE_KEY].set(key, result);
  return result;
}

function mondayOf(isoDate: string): ISODate {
  const d = new Date(isoDate + "T00:00:00Z");
  const back = (d.getUTCDay() + 6) % 7;
  return new Date(d.getTime() - back * MS_DAY).toISOString().slice(0, 10);
}

/** The current week's facts from the store (history plus this session's assessments). */
export function currentWeekFacts(store: StoreState, previousScore: number | null): SpendFacts {
  const weekStart = mondayOf(store.persona.demoDate);
  const startMs = Date.parse(weekStart + "T00:00:00Z");
  const nowMs = demoNowMs(store);
  const byId = new Map(store.history.map((h) => [h.id, { ...h }]));
  for (const a of store.assessments.values()) {
    byId.set(a.id, {
      id: a.id, createdAt: a.createdAt, merchant: a.merchant, totalPence: a.totalPence, verdict: a.verdict,
      regretRisk: a.regretRisk, headline: a.headline, decision: a.decision, outcome: byId.get(a.id)?.outcome ?? null,
    });
  }
  const week = [...byId.values()].filter((h) => {
    const t = Date.parse(h.createdAt);
    return t >= startMs && t <= nowMs && (h.verdict === "nudge" || h.verdict === "strong_nudge");
  });
  const heededList = week.filter((h) => h.decision === "wait" || h.decision === "dismiss" || h.decision === "negotiated");
  const overridden = week.filter((h) => h.decision === "buy_anyway");
  let kept = 0;
  let exceeded = 0;
  for (const l of store.persona.limits) {
    if (spentThisWeek(store, l.category as Category) > l.weeklyLimitPence) exceeded++;
    else kept++;
  }
  const income = nextIncome(store.persona);
  return {
    weekStart,
    nudgesShown: week.length,
    heeded: heededList.length,
    overridden: overridden.length,
    overriddenHappy: overridden.filter((h) => h.outcome === "happy").length,
    overriddenRegretted: overridden.filter((h) => h.outcome === "regretted").length,
    limitsKept: kept,
    limitsExceeded: exceeded,
    avoidedPence: heededList.reduce((s, h) => s + h.totalPence, 0),
    safeToSpendPence: safeToSpend(store),
    daysToNextIncome: Math.max(0, daysBetween(store.persona.demoDate, income.date)),
    previousScore,
  };
}
