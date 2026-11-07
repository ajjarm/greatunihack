/**
 * Demo rules: deterministic pins for the items the demo uses, applied AFTER the live
 * judgement (or its fallback). They never touch the money maths (impact, timeline);
 * they pin necessity, per-item risk, factor wording, headline and verdict so the
 * screen recording is predictable. Keyword-matched on the item name.
 */
import type { Assessment, AssessedItem, Factor, FactorKey, Verdict } from "@/lib/types";
import type { StoreState } from "@/lib/store";
import { clamp, headlineFor, nextIncome, pounds, verdictFor } from "@/lib/logic";

type Rule = {
  test: RegExp;
  apply: (item: AssessedItem, a: Assessment, store: StoreState) => void;
  headline?: (a: Assessment) => string;
  reflectionDays?: number;
};

function setFactor(item: AssessedItem, key: FactorKey, points: number, max: number, text: string, evidence?: string) {
  const f: Factor = { key, points, max, text, ...(evidence ? { evidence } : {}) };
  const i = item.factors.findIndex((x) => x.key === key);
  if (i >= 0) item.factors[i] = f;
  else item.factors.push(f);
}

function pastPurchase(store: StoreState, re: RegExp) {
  return store.purchases
    .filter((p) => re.test(p.item))
    .sort((x, y) => Date.parse(y.purchasedAt) - Date.parse(x.purchasedAt))[0];
}

function prettyDate(iso: string): string {
  const d = new Date(iso);
  return d.toLocaleDateString("en-GB", { day: "numeric", month: "short", timeZone: "Europe/London" });
}

const RULES: Rule[] = [
  // Headphones / earbuds: always the duplicate story.
  {
    test: /headphone|earphone|earbud|airpod|ear bud/i,
    apply(item, a, store) {
      const isBuds = /earbud|airpod|ear bud/i.test(item.name);
      const owned = pastPurchase(store, isBuds ? /earbud/i : /headphone/i) ?? pastPurchase(store, /headphone|earbud/i);
      item.necessity = Math.min(item.necessity, 30);
      item.necessityTag = "want";
      item.essentialPrompt = false;
      if (owned) {
        item.duplicateOf = { purchaseId: owned.id, item: owned.item, purchasedAt: owned.purchasedAt };
        setFactor(item, "duplicate", 15, 15, `You already own ${owned.item} (bought ${prettyDate(owned.purchasedAt)})`, owned.id);
      } else {
        setFactor(item, "duplicate", 15, 15, "You already own a pair like this");
      }
      setFactor(item, "want_level", 22, 25, `${item.name.split(" ").slice(0, 3).join(" ")}: a want, not a need`);
      item.regretRisk = Math.max(item.regretRisk, 80);
    },
    headline: () => "You already own a pair. Is this an upgrade or a repeat?",
    reflectionDays: 7,
  },
  // Medicine: always the essential prompt.
  {
    test: /paracetamol|ibuprofen|medicine|prescription|plaster|first aid|antihistamine|lemsip|inhaler/i,
    apply(item) {
      item.necessity = 92;
      item.necessityTag = "need";
      item.necessityConfidence = "high";
      if (item.essential === null) item.essentialPrompt = true;
      item.regretRisk = Math.min(item.regretRisk, 6);
      setFactor(item, "want_level", 0, 25, `${item.name.split(" ")[0]}: looks like a need`);
    },
    reflectionDays: 1,
  },
  // Watches: always high risk.
  {
    test: /\bwatch\b|smartwatch|casio|garmin|fitbit|apple watch/i,
    apply(item, a) {
      item.necessity = 18;
      item.necessityTag = "want";
      item.essentialPrompt = false;
      item.essential = item.essential === true ? true : null;
      setFactor(item, "want_level", 25, 25, "A watch is a want, not a need");
      setFactor(item, "timing", 10, 10, "It's 11:40pm. Six of your seven late-night buys were regrets");
      const usual = 1800;
      if (item.pricePence > usual * 2) {
        setFactor(item, "money_strain", 13, 15, `${pounds(item.pricePence)} is ${(item.pricePence / usual).toFixed(1)}× what you usually spend in one go`);
      }
      item.regretRisk = Math.max(item.regretRisk, 86);
      void a;
    },
    headline: () => "Hold on. A watch at this hour is a classic impulse buy.",
    reflectionDays: 14,
  },
  // Course books: always fine.
  {
    test: /textbook|course book|coursebook|study guide|revision guide|university press|\bedition\b|lecture notes|\bisbn\b/i,
    apply(item) {
      item.necessity = 55;
      item.necessityTag = "useful";
      item.essentialPrompt = false;
      item.regretRisk = Math.min(item.regretRisk, 4);
      setFactor(item, "want_level", 2, 25, "Course books are always fine, you said");
      setFactor(item, "history", 0, 20, "You've never regretted a book");
    },
    reflectionDays: 30,
  },
  // Trainers: always the rule story.
  {
    test: /trainer|sneaker|air max|air force|dunk|jordan|yeezy|new balance|running shoe/i,
    apply(item, a, store) {
      const dunks = pastPurchase(store, /dunk|trainer|air max/i);
      item.necessity = Math.min(item.necessity, 25);
      item.necessityTag = "want";
      item.essentialPrompt = false;
      setFactor(item, "want_level", 25, 25, "You set a rule: no trainers until exams are over");
      if (dunks) setFactor(item, "history", 18, 20, `You bought ${dunks.item} on ${prettyDate(dunks.purchasedAt)} and regretted it`, dunks.id);
      item.regretRisk = Math.max(item.regretRisk, 82);
    },
    headline: () => "Trainers sit against your own exam rule.",
    reflectionDays: 3,
  },
];

function weightedRisk(items: AssessedItem[]): number {
  const total = items.reduce((s, i) => s + i.pricePence * i.qty, 0) || 1;
  return clamp(Math.round(items.reduce((s, i) => s + i.regretRisk * i.pricePence * i.qty, 0) / total), 0, 100);
}

/** Apply the demo pins. Returns the same object, mutated. */
export function applyDemoRules(store: StoreState, a: Assessment): Assessment {
  let hit: Rule | undefined;
  let hitItem: AssessedItem | undefined;
  for (const item of a.items) {
    const rule = RULES.find((r) => r.test.test(item.name));
    if (!rule) continue;
    rule.apply(item, a, store);
    if (!hit || item.pricePence > (hitItem?.pricePence ?? 0)) {
      hit = rule;
      hitItem = item;
    }
  }
  if (!hit || !hitItem) return a;

  a.regretRisk = weightedRisk(a.items);
  const pendingEssential = a.items.some((i) => i.essentialPrompt && i.essential === null);
  let verdict: Verdict = verdictFor(a.regretRisk, a.affordability, a.items);
  if (pendingEssential && !a.items.some((i) => i.essential === true)) verdict = "nudge";
  a.verdict = verdict;

  if (pendingEssential && verdict === "nudge") a.headline = "Looks essential. Is it?";
  else if (verdict === "go_ahead") a.headline = headlineFor("go_ahead", a);
  else if (hit.headline && verdict !== "essential_cover") a.headline = hit.headline(a);

  // Top factors: the pinned item's strongest factors first.
  const strongest = [...hitItem.factors].sort((x, y) => y.points / Math.max(1, y.max) - x.points / Math.max(1, x.max)).slice(0, 3);
  a.topFactors = strongest.map((f) => ({ key: f.key, text: f.text }));
  if (hit.reflectionDays) a.reflectionDays = hit.reflectionDays;
  a.spokenLine = a.headline;

  // A high-risk single item with no negotiation gets a "wait until payday" option.
  if (verdict === "strong_nudge" && a.negotiation.length === 0) {
    const inc = nextIncome(store.persona);
    a.negotiation.push({
      id: "demo_delay_payday",
      action: "delay",
      itemIndex: hitItem.index,
      text: `Wait until your shift pays on ${prettyDate(inc.date)} and decide then`,
      resultRegretRisk: clamp(a.regretRisk - 45, 15, 100),
      resultSafeToSpendAfterPence: a.impact.safeToSpendBeforePence,
      resultVerdict: "nudge",
      delayUntil: inc.date,
    });
  }
  a.reasoning = `${a.reasoning}`.includes("(demo rule)") ? a.reasoning : `(demo rule: ${hitItem.name.slice(0, 30)}) ${a.reasoning}`;
  return a;
}

/** Instant, deterministic reason judgement for the words the demo uses; null = ask Claude. */
export function quickReasonVerdict(text: string): { accepted: boolean; verdictText: string } | null {
  const t = text.toLowerCase();
  if (/\b(gift|present|birthday|wedding|anniversary|christmas|for my (mum|dad|sister|brother|partner|girlfriend|boyfriend|friend))\b/.test(t)) {
    return { accepted: true, verdictText: "A present for someone else is a good reason. That lowers the regret call. The money picture is unchanged." };
  }
  if (/\b(broke|broken|died|stopped working|lost|stolen|replacement|replace)\b/.test(t)) {
    return { accepted: true, verdictText: "Replacing something that broke is a real need. That lowers the regret call. The money picture is unchanged." };
  }
  if (/\b(course|dissertation|exam|lecture|coursework|placement|interview|shift|work)\b/.test(t)) {
    return { accepted: true, verdictText: "Needed for your course or work. That lowers the regret call. The money picture is unchanged." };
  }
  if (/\b(just want|i want|because i want|want it|looks (cool|nice|good)|treat myself|on sale|it's cheap|its cheap|fomo|why not)\b/.test(t)) {
    return { accepted: false, verdictText: "Wanting it right now is completely human, but it doesn't make you less likely to regret it. Nothing changes." };
  }
  return null;
}
