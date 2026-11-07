/**
 * SPEC 5.2 necessity: Claude rates every item in the basket (tier, confidence, which of
 * the user's rules apply) as part of the single judge call in judge.ts. Keyword
 * heuristics stand in when the model is unavailable. Rule shifts and the essential answer
 * are applied later, in code.
 */
import { CATEGORIES, type BasketItem, type Category, type Confidence } from "../types";
import type { StoreState } from "../store";
import { int, obj, str } from "./claude";
import { rulesMatching, shortNameOf, tally } from "./signals";

export interface ItemJudgement {
  category: Category;
  necessity: number; // before rules
  confidence: Confidence;
  shortName: string;
  ruleIds: string[];
  why: string;
}

const isCategory = (x: unknown): x is Category => typeof x === "string" && (CATEGORIES as readonly string[]).includes(x);

// ---------- fallback heuristics ----------

const KEYWORDS: { re: RegExp; necessity: number; category: Category; confidence: Confidence }[] = [
  { re: /paracetamol|ibuprofen|prescription|medicine|inhaler|antihistamine|plaster|tampon|sanitary|contact lens/, necessity: 92, category: "health", confidence: "high" },
  { re: /course reader|textbook|set text|module|lecture|course book/, necessity: 85, category: "books", confidence: "high" },
  { re: /bus pass|railcard|train ticket|bus ticket|oyster/, necessity: 80, category: "transport", confidence: "medium" },
  { re: /milk|bread|eggs|rice|pasta|vegetable|fruit|weekly shop|groceries|nappies/, necessity: 85, category: "groceries", confidence: "medium" },
  { re: /toothpaste|shampoo|soap|deodorant|toilet roll|washing up|detergent|bin bag/, necessity: 70, category: "household", confidence: "medium" },
  { re: /charger|cable/, necessity: 55, category: "tech", confidence: "low" },
  { re: /headphone|keyboard|mouse|backpack|lamp|notebook|stationery|kettle|umbrella|laptop|macbook|chromebook|ipad|tablet|monitor/, necessity: 50, category: "tech", confidence: "medium" },
  { re: /phone case|grip|earbud|airpod|watch strap|keyring/, necessity: 15, category: "accessories", confidence: "high" },
  { re: /ps5|xbox|nintendo|switch|steam|game|silksong|vinyl|lego/, necessity: 15, category: "fun", confidence: "high" },
  { re: /trainer|sneaker|air max|dunk|jordan|air force/, necessity: 20, category: "clothes", confidence: "high" },
  { re: /hoodie|hoody|jacket|jeans|trouser|shirt|tee|dress|coat|cargo/, necessity: 32, category: "clothes", confidence: "medium" },
  { re: /takeaway|pizza|burger|kebab|deliveroo|uber eats|just eat/, necessity: 20, category: "eating_out", confidence: "medium" },
  { re: /gift|present|birthday card/, necessity: 45, category: "gifts", confidence: "low" },
];

const CATEGORY_DEFAULT: Record<Category, number> = {
  groceries: 80, eating_out: 25, clothes: 30, tech: 45, accessories: 20, books: 70, transport: 70,
  health: 75, subscriptions: 35, fun: 15, gifts: 40, household: 60, other: 40,
};

export function heuristicJudgement(store: StoreState, item: BasketItem): ItemJudgement {
  const lower = item.name.toLowerCase();
  const hit = KEYWORDS.find((k) => k.re.test(lower));
  const category: Category = isCategory(item.category) ? item.category : hit?.category ?? "other";
  let necessity = hit && (!isCategory(item.category) || hit.category === category) ? hit.necessity : CATEGORY_DEFAULT[category];
  const confidence: Confidence = hit ? hit.confidence : "low";
  // a stored essential flag or past "needed it" in the category shifts it up
  const essentials = store.purchases.filter((p) => p.category === category && p.essential).length;
  if (essentials >= 2 && necessity >= 40) necessity = Math.min(100, necessity + 5);
  const ruleIds = rulesMatching(store.persona.rules, item.name, category).map((r) => r.id);
  return { category, necessity, confidence, shortName: shortNameOf(item.name), ruleIds, why: hit ? "keyword match" : "category default" };
}

// ---------- the Claude half (the call itself lives in judge.ts) ----------

export const NECESSITY_GUIDE = `Necessity scale (0-100), use these tiers:
- urgent essential 85-100: any medicine (including over-the-counter painkillers like paracetamol or ibuprofen) and prescription costs, course-required books or materials, transport to a shift or interview, staple groceries. Someone buying medicine at night usually needs it now.
- essential but can wait 60-80: toiletries, replacements for something broken, household basics
- useful want 40-60: things with a real use that are not needed now (e.g. a second pair of headphones for the library)
- pure want 10-30: treats, fashion, games, accessories, impulse items

Rate the item itself; do not lower necessity for price or time of day (other parts of the app handle money and timing). Do not apply the user's rules to the number: just list which rules clearly apply to the item by id (a rule applies when it names this kind of item, e.g. "no trainers" applies to any trainers/sneakers brand or model). Use the category history only as context about how this person uses the category.

Per item, in basket order (one entry per item):
- need: the necessity, 0-100.
- conf: "high" when the item is unambiguous, "medium" when the tier is likely, "low" when it could plausibly be essential or not depending on circumstances you cannot see.
- cat: keep the given category when one is given; otherwise choose the best fit.
- short: one or two lowercase words a friend would use, e.g. "trainers", "phone case".
- rules: ids of the user's rules that clearly apply to the item, usually none.
- why: at most 8 words.`;

/** Short keys on purpose: output tokens are most of the call's latency. */
export const ITEM_SCHEMA = {
  type: "object",
  additionalProperties: false,
  required: ["need", "conf", "cat", "short", "rules", "why"],
  properties: {
    need: { type: "integer" },
    conf: { type: "string", enum: ["low", "medium", "high"] },
    cat: { type: "string", enum: [...CATEGORIES] },
    short: { type: "string" },
    rules: { type: "array", items: { type: "string" } },
    why: { type: "string" },
  },
};

export function historyFor(store: StoreState, category: Category) {
  const list = store.purchases.filter((p) => p.category === category);
  const t = tally(list);
  return {
    category,
    purchases: list.length,
    markedEssential: list.filter((p) => p.essential).length,
    reviewed: t.reviewed,
    regretted: t.regretted,
    recent: list.slice(0, 5).map((p) => `${p.item} (${p.feedback ?? "no review"}${p.essential ? ", essential" : ""})`),
  };
}

/** Validate the model's per-item ratings (one per basket item, in order); null when the shape is wrong. */
export function parseItemJudgements(raw: unknown, store: StoreState, items: BasketItem[], fallback: ItemJudgement[]): ItemJudgement[] | null {
  if (!Array.isArray(raw) || raw.length !== items.length) return null;
  const ruleIds = new Set(store.persona.rules.map((r) => r.id));
  const result: ItemJudgement[] = [];
  for (let index = 0; index < items.length; index++) {
    const x = obj(raw[index]);
    const necessity = x ? int(x.need, 0, 100) : null;
    const confidence = x && (x.conf === "low" || x.conf === "medium" || x.conf === "high") ? x.conf : null;
    if (!x || necessity === null || !confidence) return null;
    const given = items[index].category;
    result.push({
      category: isCategory(given) ? given : isCategory(x.cat) ? x.cat : fallback[index].category,
      necessity,
      confidence,
      shortName: (str(x.short, 40) ?? fallback[index].shortName).replace(/^the\s+/i, "").toLowerCase(),
      ruleIds: Array.isArray(x.rules) ? x.rules.filter((id): id is string => typeof id === "string" && ruleIds.has(id)) : [],
      why: str(x.why, 200) ?? "",
    });
  }
  return result;
}
