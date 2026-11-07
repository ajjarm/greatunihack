/**
 * The Claude calls that write words: the card narrative (headline, spokenLine, reasoning,
 * topFactors phrasing, reflectionDays, cue notes) and the reason judgement. Each has a
 * template fallback in engine.ts / logic.ts.
 */
import { CUE_KEYS, type CueKey, type FactorKey, type Persona } from "../types";
import { pounds } from "../logic";
import { askJson, int, obj, str } from "./claude";
import { factorCandidates, type Evaluation } from "./engine";
import { clockText, shortDate, weekdayName, type LocalMoment } from "./signals";

export interface Narrative {
  headline: string;
  spokenLine: string;
  reasoning: string;
  topFactors: { key: FactorKey; text: string }[];
  reflectionDays: number;
  cueNotes: Partial<Record<CueKey, string>>;
}

const NARRATIVE_SYSTEM = `You write the words on a checkout card for a money app that steps in before a UK student pays. The numbers are already computed; your job is the wording.

Voice: a friend who is good with money. Warm, plain British English, short sentences, second person. Never preachy, never shaming, never accuse the shop or the user. Describe sales cues as cues ("a timer is there to make you decide now"), not as lies.
Facts: use only the numbers and facts you are given, in pounds as given (e.g. "£282"). Do not invent purchases, dates or amounts. Keep facts (money, limits, overdraft) separate from predictions (regret risk).

Write:
- headline: one line, at most 70 characters, that captures why this verdict.
- spokenLine: one sentence for captions, at most 120 characters.
- reasoning: 3 to 6 sentences, at most 700 characters: the main reasons for the risk in the user's own history, the money facts, and what would turn it into a yes (use the negotiation option if one is given).
- topFactors: pick up to three of the candidate factors (use their keys exactly, most important first) and rephrase each as one plain sentence, at most 70 characters.
- reflectionDays: days before asking "glad you bought it?". Guide: food 1, clothes 3, electronics 7, subscriptions 30, courses 60; anything else by how long it takes to know if it was worth it. 1 to 60.
- cueNotes: for each cue key given, one plain-English line (at most 100 characters) on what the cue is for.`;

function narrativeSchema() {
  return {
    type: "object",
    additionalProperties: false,
    required: ["headline", "spokenLine", "reasoning", "topFactors", "reflectionDays", "cueNotes"],
    properties: {
      headline: { type: "string" },
      spokenLine: { type: "string" },
      reasoning: { type: "string" },
      topFactors: {
        type: "array",
        items: {
          type: "object",
          additionalProperties: false,
          required: ["key", "text"],
          properties: { key: { type: "string" }, text: { type: "string" } },
        },
      },
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
}

export function narrativeFacts(persona: Persona, e: Evaluation, now: LocalMoment, merchant: string, cues: { key: CueKey; text: string }[]) {
  const imp = e.impact;
  return {
    person: persona.name,
    moment: `${weekdayName(now.date)} ${shortDate(now.date)}, ${clockText(now)}`,
    merchant,
    verdict: e.verdict,
    verdictMeaning: {
      go_ahead: "fine, a small toast",
      essential_cover: "a need: buy it, and here's how to cover it",
      nudge: "worth a second look",
      strong_nudge: "hold on, likely an impulse buy",
    }[e.verdict],
    awaitingEssentialAnswer: e.pendingPrompt,
    basketRegretRiskPct: e.regretRisk,
    affordability: e.affordability,
    items: e.items.map((it) => ({
      name: it.name,
      price: pounds(it.pricePence * it.qty),
      category: it.category,
      tag: it.necessityTag,
      regretRiskPct: it.regretRisk,
      delayedToPayday: it.delayed,
      factors: it.factors.map((f) => ({ key: f.key, points: `${f.points}/${f.max}`, text: f.text, evidence: f.evidence ?? null })),
      duplicateOf: it.duplicateOf ? `${it.duplicateOf.item} (${shortDate(it.duplicateOf.purchasedAt)})` : null,
    })),
    money: {
      payingNow: pounds(e.paidPence),
      safeToSpendBefore: pounds(imp.safeToSpendBeforePence),
      safeToSpendAfter: pounds(imp.safeToSpendAfterPence),
      nextIncome: `${imp.nextIncome.name}, ${pounds(imp.nextIncome.amountPence)} on ${weekdayName(imp.nextIncome.date)} ${shortDate(imp.nextIncome.date)} (${imp.daysToNextIncome} days)`,
      nextBill: `${imp.nextBill.name} ${pounds(imp.nextBill.amountPence)} on ${shortDate(imp.nextBill.date)}, ${imp.nextBill.coveredAfter ? "still covered" : "NOT covered"} after this`,
      limit: imp.limit
        ? imp.limit.overByPence > 0
          ? `${imp.limit.category} weekly limit ${pounds(imp.limit.weeklyLimitPence)}: ${pounds(imp.limit.overByPence)} over after this`
          : `${imp.limit.category} weekly limit ${pounds(imp.limit.weeklyLimitPence)}: ${pounds(imp.limit.remainingAfterPence)} left after this`
        : null,
      overdraft: imp.overdraftUntil ? `after this, ${pounds(e.overdraftShortPence)} overdrawn until ${shortDate(imp.overdraftUntil)}` : null,
      workingHours: imp.workingHours,
      goal: `${imp.goalSharePct}% of the ${persona.goal.name.toLowerCase()} goal`,
    },
    rules: persona.rules.map((r) => r.text),
    cues,
    negotiation: e.negotiation.map((n) => `${n.text} -> risk ${n.resultRegretRisk}%, ${n.resultVerdict}`),
    candidateFactors: factorCandidates(e).filter((f) => f.points !== 0).map((f) => ({ key: f.key, text: f.text, points: f.points, item: f.item })),
  };
}

export async function writeNarrative(persona: Persona, e: Evaluation, now: LocalMoment, merchant: string, cues: { key: CueKey; text: string }[]): Promise<Narrative> {
  const facts = narrativeFacts(persona, e, now, merchant, cues);
  const allowed = new Set(facts.candidateFactors.map((f) => f.key));
  const cueKeys = new Set(cues.map((c) => c.key));
  return askJson<Narrative>({
    label: "narrative",
    system: NARRATIVE_SYSTEM,
    user: JSON.stringify(facts),
    schema: narrativeSchema(),
    maxTokens: 2000,
    validate: (raw) => {
      const o = obj(raw);
      if (!o) return null;
      const headline = str(o.headline, 90);
      const spokenLine = str(o.spokenLine, 160);
      const reasoning = str(o.reasoning, 1000);
      const reflectionDays = int(o.reflectionDays, 1, 60);
      if (!headline || !spokenLine || !reasoning || reflectionDays === null || !Array.isArray(o.topFactors)) return null;
      const topFactors: Narrative["topFactors"] = [];
      for (const t of o.topFactors) {
        const x = obj(t);
        const text = x ? str(x.text, 100) : null;
        if (!x || !text || !allowed.has(x.key as FactorKey) || topFactors.some((f) => f.key === x.key)) continue;
        topFactors.push({ key: x.key as FactorKey, text });
      }
      if (topFactors.length === 0 && allowed.size > 0) return null;
      const cueNotes: Narrative["cueNotes"] = {};
      for (const c of Array.isArray(o.cueNotes) ? o.cueNotes : []) {
        const x = obj(c);
        const note = x ? str(x.note, 140) : null;
        if (x && note && cueKeys.has(x.key as CueKey)) cueNotes[x.key as CueKey] = note;
      }
      return { headline, spokenLine, reasoning, topFactors: topFactors.slice(0, 3), reflectionDays, cueNotes };
    },
  });
}

// ---------- reason judgement ----------

export interface ReasonJudgement {
  accepted: boolean;
  adjustment: number; // -30..0
  appliesTo: number[]; // current item indexes; empty = whole basket
  verdictText: string; // no numbers; the engine appends the risk change
}

const REASON_SYSTEM = `A money app asked a UK student "why are you buying it?" at checkout. Judge whether their answer is a reason that lowers the chance they regret the purchase.

Lower the risk (accepted = true, adjustment -10 to -30, stronger and more specific reasons nearer -30):
- a gift for someone (birthday, wedding, thank-you)
- replacing something broken, lost or worn out
- needed for a course, exam, lecture or placement
- health or medical need
- needed for work, a shift or an interview
Do nothing (accepted = false, adjustment 0): "it's on sale", "it's a deal", "only a few left", "I deserve it", "I just want it", "treat", vague or joking answers.
The reason never changes the money: never suggest it is now affordable.

appliesTo: the item indexes the reason is about; an empty list means the whole basket.
verdictText: one or two short, warm sentences, no numbers, e.g. "A birthday present is a good reason. That changes the risk, not the money." or "A sale makes it cheaper, not more needed."`;

const REASON_SCHEMA = {
  type: "object",
  additionalProperties: false,
  required: ["accepted", "adjustment", "appliesTo", "verdictText"],
  properties: {
    accepted: { type: "boolean" },
    adjustment: { type: "integer" },
    appliesTo: { type: "array", items: { type: "integer" } },
    verdictText: { type: "string" },
  },
};

export async function judgeReason(text: string, items: { index: number; name: string; tag: string; regretRisk: number }[]): Promise<ReasonJudgement> {
  return askJson<ReasonJudgement>({
    label: "reason",
    system: REASON_SYSTEM,
    user: JSON.stringify({ answer: text, basket: items }),
    schema: REASON_SCHEMA,
    maxTokens: 600,
    validate: (raw) => {
      const o = obj(raw);
      if (!o || typeof o.accepted !== "boolean") return null;
      const adj = int(o.adjustment, -30, 0);
      const verdictText = str(o.verdictText, 240);
      if (adj === null || !verdictText) return null;
      const valid = new Set(items.map((i) => i.index));
      const appliesTo = Array.isArray(o.appliesTo) ? o.appliesTo.filter((i): i is number => typeof i === "number" && valid.has(i)) : [];
      return { accepted: o.accepted && adj < 0, adjustment: o.accepted ? adj : 0, appliesTo, verdictText };
    },
  });
}
