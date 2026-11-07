/**
 * The one Claude call on the live assess path: it rates every item's necessity (SPEC 5.2)
 * and, in the same answer, writes the card words that do not depend on the final numbers
 * (a "reason to pause" headline, the reasoning, reflectionDays, cue notes). Code then
 * computes risk, affordability and the verdict from those ratings (engine.ts); the
 * verdict-specific lines (spoken line, top factors, cover-it headline, next step) are
 * templated from the arithmetic so they always agree with the verdict.
 *
 * The facts given to the model are the ones that do not move with necessity: money (from
 * a provisional evaluation on the keyword heuristics), category history, earlier similar
 * purchases, weekly limits, rules and cues.
 */
import { CUE_KEYS, type AssessRequest, type CueKey } from "../types";
import type { StoreState } from "../store";
import { pounds, spentThisWeek } from "../logic";
import { askJson, int, obj, str } from "./claude";
import type { Evaluation } from "./engine";
import { ITEM_SCHEMA, NECESSITY_GUIDE, historyFor, parseItemJudgements, type ItemJudgement } from "./necessity";
import { clockText, findDuplicates, shortDate, weekdayName, type LocalMoment } from "./signals";

/** Warm calls land in 2-3 s; this leaves room for one hedge inside the route's 8 s cap. */
export const JUDGE_TIMEOUT_MS = 6000;
export const JUDGE_HEDGE_AFTER_MS = 3500;

export interface Narrative {
  /** "" when the words came from templates */
  headline: string;
  reasoning: string;
  reflectionDays: number;
  cueNotes: Partial<Record<CueKey, string>>;
}

export interface BasketJudgement {
  items: ItemJudgement[];
  narrative: Narrative;
}

const SYSTEM = `You are the judgement step of a money app that steps in at checkout, before a UK student pays. In one answer you rate how necessary each item in the basket is for this person and write the words for the checkout card. Code works out every number afterwards (regret risk, affordability, the verdict) from your necessity ratings.

PART 1, items: one entry per basket item, in basket order.
${NECESSITY_GUIDE}

PART 2, the card.
Voice: a friend who is good with money. Warm, plain British English, short sentences, second person. Never preachy, never shaming, never accuse the shop or the user. Describe sales cues as cues ("a timer is there to make you decide now"), not as lies.
Facts: use only the numbers and facts you are given, in pounds as given (e.g. "£282"). Do not invent purchases, dates or amounts. Keep facts (money, limits, overdraft) separate from predictions.
- headline: one line, at most 60 characters, naming the main reason to pause before buying (it is shown only when the app suggests a second look).
- reasoning: 2 or 3 short sentences, at most 300 characters: how needed the items are, the one or two money facts that matter most, and any relevant history or earlier similar purchase. The verdict and the risk are worked out after you answer, so never state a verdict, a percentage or a risk score, and do not tell the user to buy or not to buy.
- reflectionDays: days before asking "glad you bought it?". Guide: food 1, clothes 3, electronics 7, subscriptions 30, courses 60; anything else by how long it takes to know if it was worth it. 1 to 60.
- cueNotes: for each cue key given, one plain-English line (at most 100 characters) on what the cue is for. Empty when there are no cues.`;

const SCHEMA = {
  type: "object",
  additionalProperties: false,
  required: ["items", "headline", "reasoning", "reflectionDays", "cueNotes"],
  properties: {
    items: { type: "array", items: ITEM_SCHEMA },
    headline: { type: "string" },
    reasoning: { type: "string" },
    reflectionDays: { type: "integer" },
    cueNotes: {
      type: "array",
      items: {
        type: "object",
        additionalProperties: false,
        required: ["key", "note"],
        properties: { key: { type: "string", enum: [...CUE_KEYS] }, note: { type: "string" } },
      },
    },
  },
};

function judgeFacts(store: StoreState, req: AssessRequest, now: LocalMoment, heuristic: ItemJudgement[], provisional: Evaluation) {
  const persona = store.persona;
  const imp = provisional.impact;
  const cats = [...new Set(heuristic.map((h) => h.category))];
  const similar = req.items
    .map((it, index) => {
      const d = findDuplicates(store, it.name, heuristic[index].category, now.ms);
      const list = [...d.strong, ...d.weak].slice(0, 3);
      return { index, purchases: list.map((p) => `${p.item}, ${shortDate(p.purchasedAt)}, ${pounds(p.amountPence)} (${p.feedback ?? "no review"})`) };
    })
    .filter((s) => s.purchases.length > 0);
  return {
    person: persona.name,
    moment: `${weekdayName(now.date)} ${shortDate(now.date)}, ${clockText(now)}`,
    merchant: req.merchant,
    items: req.items.map((it, index) => ({
      index,
      name: it.name,
      price: pounds(it.pricePence * it.qty),
      qty: it.qty,
      category: it.category ?? null,
    })),
    rules: persona.rules.map((r) => ({ id: r.id, text: r.text, category: r.category ?? null, direction: r.direction })),
    categoryHistory: cats.map((c) => historyFor(store, c)),
    earlierSimilarPurchases: similar,
    money: {
      payingNow: pounds(provisional.paidPence),
      safeToSpendBefore: pounds(imp.safeToSpendBeforePence),
      safeToSpendAfter: pounds(imp.safeToSpendAfterPence),
      nextIncome: `${imp.nextIncome.name}, ${pounds(imp.nextIncome.amountPence)} on ${weekdayName(imp.nextIncome.date)} ${shortDate(imp.nextIncome.date)} (${imp.daysToNextIncome} days)`,
      nextBill: `${imp.nextBill.name} ${pounds(imp.nextBill.amountPence)} on ${shortDate(imp.nextBill.date)}, ${imp.nextBill.coveredAfter ? "still covered" : "NOT covered"} after this`,
      overdraft: imp.overdraftUntil ? `after this, ${pounds(provisional.overdraftShortPence)} overdrawn until ${shortDate(imp.overdraftUntil)}` : null,
      workingHours: imp.workingHours,
      goal: `${imp.goalSharePct}% of the ${persona.goal.name.toLowerCase()} goal`,
    },
    weeklyLimits: persona.limits.map((l) => ({
      category: l.category,
      limit: pounds(l.weeklyLimitPence),
      leftThisWeekBeforeThis: pounds(Math.max(0, l.weeklyLimitPence - spentThisWeek(store, l.category))),
    })),
    cues: req.cues,
  };
}

/** Throws BrainUnavailable (no key, timeout, API error, bad answer); the caller falls back. */
export async function judgeBasket(
  store: StoreState,
  req: AssessRequest,
  now: LocalMoment,
  heuristic: ItemJudgement[],
  provisional: Evaluation,
): Promise<BasketJudgement> {
  const cueKeys = new Set(req.cues.map((c) => c.key));
  return askJson<BasketJudgement>({
    label: "judge",
    system: SYSTEM,
    user: JSON.stringify(judgeFacts(store, req, now, heuristic, provisional)),
    schema: SCHEMA,
    maxTokens: 1500,
    timeoutMs: JUDGE_TIMEOUT_MS,
    hedgeAfterMs: JUDGE_HEDGE_AFTER_MS,
    validate: (raw) => {
      const o = obj(raw);
      if (!o) return null;
      const items = parseItemJudgements(o.items, store, req.items, heuristic);
      const headline = str(o.headline, 90);
      const reasoning = str(o.reasoning, 700);
      const reflectionDays = int(o.reflectionDays, 1, 60);
      if (!items || !headline || !reasoning || reflectionDays === null) return null;
      const cueNotes: Narrative["cueNotes"] = {};
      for (const c of Array.isArray(o.cueNotes) ? o.cueNotes : []) {
        const x = obj(c);
        const note = x ? str(x.note, 140) : null;
        if (x && note && cueKeys.has(x.key as CueKey)) cueNotes[x.key as CueKey] = note;
      }
      return { items, narrative: { headline, reasoning, reflectionDays, cueNotes } };
    },
  });
}
