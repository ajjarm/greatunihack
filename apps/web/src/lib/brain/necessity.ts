/**
 * SPEC 5.2 necessity: one Claude call rates every item in the basket (tier, confidence,
 * which of the user's rules apply). Keyword heuristics stand in when the model is
 * unavailable. Rule shifts and the essential answer are applied later, in code.
 */
import { CATEGORIES, type BasketItem, type Category, type Confidence } from "../types";
import type { StoreState } from "../store";
import { askJson, int, obj, str, BrainUnavailable } from "./claude";
import { rulesMatching, shortNameOf, tally } from "./signals";

export interface ItemJudgement {
  category: Category;
  necessity: number; // before rules
  confidence: Confidence;
  shortName: string;
  ruleIds: string[];
  why: string;
}

export interface NecessityResult {
  items: ItemJudgement[];
  source: "claude" | "fallback";
  note?: string;
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
  { re: /headphone|keyboard|mouse|backpack|lamp|notebook|stationery|kettle|umbrella/, necessity: 50, category: "tech", confidence: "medium" },
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

// ---------- Claude ----------

const SYSTEM = `You rate how necessary each item in a shopping basket is for one specific person, a UK student. You are part of a money app that steps in at checkout.

Necessity scale (0-100), use these tiers:
- urgent essential 85-100: any medicine (including over-the-counter painkillers like paracetamol or ibuprofen) and prescription costs, course-required books or materials, transport to a shift or interview, staple groceries. Someone buying medicine at night usually needs it now.
- essential but can wait 60-80: toiletries, replacements for something broken, household basics
- useful want 40-60: things with a real use that are not needed now (e.g. a second pair of headphones for the library)
- pure want 10-30: treats, fashion, games, accessories, impulse items

Rate the item itself; do not lower necessity for price or time of day (other parts of the app handle money and timing). Do not apply the user's rules to the number: just list which rules clearly apply to the item by id (a rule applies when it names this kind of item, e.g. "no trainers" applies to any trainers/sneakers brand or model). Use the category history only as context about how this person uses the category.

confidence: "high" when the item is unambiguous, "medium" when the tier is likely, "low" when it could plausibly be essential or not depending on circumstances you cannot see.
category: keep the given category when one is given; otherwise choose the best fit.
shortName: two or three lowercase words a friend would use, e.g. "the trainers", "the phone case".
why: under 15 words.`;

const SCHEMA = {
  type: "object",
  additionalProperties: false,
  required: ["items"],
  properties: {
    items: {
      type: "array",
      items: {
        type: "object",
        additionalProperties: false,
        required: ["index", "necessity", "confidence", "category", "shortName", "ruleIds", "why"],
        properties: {
          index: { type: "integer" },
          necessity: { type: "integer" },
          confidence: { type: "string", enum: ["low", "medium", "high"] },
          category: { type: "string", enum: [...CATEGORIES] },
          shortName: { type: "string" },
          ruleIds: { type: "array", items: { type: "string" } },
          why: { type: "string" },
        },
      },
    },
  },
};

function historyFor(store: StoreState, category: Category) {
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

export async function judgeNecessity(store: StoreState, items: BasketItem[]): Promise<NecessityResult> {
  const fallback = items.map((it) => heuristicJudgement(store, it));
  if (items.length === 0) return { items: [], source: "fallback" };
  const cats = [...new Set(fallback.map((f) => f.category))];
  const ruleIds = new Set(store.persona.rules.map((r) => r.id));
  const user = JSON.stringify({
    items: items.map((it, index) => ({ index, name: it.name, pricePounds: it.pricePence / 100, qty: it.qty, category: it.category ?? null })),
    rules: store.persona.rules.map((r) => ({ id: r.id, text: r.text, category: r.category ?? null, direction: r.direction })),
    categoryHistory: cats.map((c) => historyFor(store, c)),
  });
  try {
    const out = await askJson<ItemJudgement[]>({
      label: "necessity",
      system: SYSTEM,
      user,
      schema: SCHEMA,
      maxTokens: 1500,
      validate: (raw) => {
        const o = obj(raw);
        if (!o || !Array.isArray(o.items)) return null;
        const result: ItemJudgement[] = fallback.map((f) => ({ ...f }));
        let seen = 0;
        for (const r of o.items) {
          const x = obj(r);
          const index = x ? int(x.index, 0, items.length - 1) : null;
          if (!x || index === null || x.index !== index) continue;
          const necessity = int(x.necessity, 0, 100);
          const confidence = x.confidence === "low" || x.confidence === "medium" || x.confidence === "high" ? x.confidence : null;
          if (necessity === null || !confidence) return null;
          const given = items[index].category;
          result[index] = {
            category: isCategory(given) ? given : isCategory(x.category) ? x.category : fallback[index].category,
            necessity,
            confidence,
            shortName: (str(x.shortName, 40) ?? fallback[index].shortName).replace(/^the\s+/i, "").toLowerCase(),
            ruleIds: Array.isArray(x.ruleIds) ? x.ruleIds.filter((id): id is string => typeof id === "string" && ruleIds.has(id)) : [],
            why: str(x.why, 200) ?? "",
          };
          seen++;
        }
        return seen === items.length ? result : null;
      },
    });
    return { items: out, source: "claude" };
  } catch (e) {
    if (!(e instanceof BrainUnavailable)) throw e;
    return { items: fallback, source: "fallback", note: e.message };
  }
}
