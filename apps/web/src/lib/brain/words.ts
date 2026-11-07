/**
 * The reason judgement (POST /api/assessments/:id/reason): Claude decides whether the
 * user's "why are you buying it?" answer lowers the regret risk. Bounded by a deadline
 * with one hedged request; on timeout or error the caller uses the keyword fallback in
 * assess.ts. The card words for a fresh basket come from the judge call in judge.ts.
 */
import { askJson, int, obj, str } from "./claude";

/** Warm calls land in 1.5-2 s; a hedge at 1.1 s trims the slow tail under the 2.5 s target. */
export const REASON_TIMEOUT_MS = 2400;
export const REASON_HEDGE_AFTER_MS = 1100;

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
verdictText: one or two short, warm sentences, at most 100 characters, no numbers, e.g. "A birthday present is a good reason. That changes the risk, not the money." or "A sale makes it cheaper, not more needed."`;

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
    timeoutMs: REASON_TIMEOUT_MS,
    hedgeAfterMs: REASON_HEDGE_AFTER_MS,
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
