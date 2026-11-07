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
  // Mobility and medical equipment: a need that costs real money. Essential prompt, honest strain.
  {
    test: /wheelchair|mobility (aid|scooter|equipment)|walking frame|rollator|crutch|hearing aid|blood pressure monitor|nebuliser|thermometer/i,
    apply(item, a) {
      item.necessity = 95;
      item.necessityTag = "need";
      item.necessityConfidence = "high";
      if (item.essential === null) item.essentialPrompt = true;
      item.regretRisk = Math.min(item.regretRisk, 28);
      setFactor(item, "want_level", 0, 25, "Mobility equipment: a need, not a want");
      const share = Math.round((item.pricePence / Math.max(1, a.impact.safeToSpendBeforePence)) * 100);
      setFactor(item, "money_strain", 12, 15, `${pounds(item.pricePence)} is ${share}% of what's safe to spend before your shift pays, with rent on the 1st`);
    },
    reflectionDays: 30,
  },
  // Watches: always high risk.
  {
    test: /\bwatch\b|smartwatch|casio|garmin|fitbit|apple watch|omega|swatch|speedmaster|moonswatch|rolex|seiko|timex/i,
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
  const anyRule = !!hit;
  if (anyRule && hitItem) a.regretRisk = weightedRisk(a.items);
  if (anyRule && hit && hitItem) {
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
  }

  // Negotiation beat: in a basket of several items, the one expensive piece (≥ £50 and more than
  // twice the next price) is the impulse; it carries the risk and is the first thing to drop.
  if (a.items.length >= 2) {
    const sorted = [...a.items].sort((x, y) => y.pricePence - x.pricePence);
    const big = sorted[0];
    const next = sorted[1];
    if (big.pricePence >= 5000 && big.pricePence >= next.pricePence * 2 && big.necessityTag !== "need" && big.essential !== true) {
      const short = big.name.replace(/^the\s+/i, "").split(" ").slice(0, 3).join(" ");
      big.necessity = Math.min(big.necessity, 25);
      big.necessityTag = "want";
      big.essentialPrompt = false;
      big.regretRisk = Math.max(big.regretRisk, 90);
      // A clothes/wants basket: nothing in it is a need unless the user says so.
      for (const it of a.items) {
        if (it.essential !== true) {
          it.necessity = Math.min(it.necessity, 55);
          if (it.necessityTag === "need") it.necessityTag = "useful";
          it.essentialPrompt = false;
        }
      }
      setFactor(big, "want_level", 25, 25, `${pounds(big.pricePence)} on one piece is the impulse in this basket`);
      setFactor(big, "money_strain", 13, 15, `${pounds(big.pricePence)} is most of this basket and ${Math.round((big.pricePence / Math.max(1, a.impact.safeToSpendBeforePence)) * 100)}% of what's safe to spend before payday`);
      for (const it of a.items) if (it !== big && it.essential !== true) it.regretRisk = Math.min(it.regretRisk, 30);
      a.regretRisk = weightedRisk(a.items);
      a.verdict = verdictFor(a.regretRisk, a.affordability, a.items);
      if (a.verdict === "strong_nudge" || a.verdict === "nudge") a.headline = `The ${short} is the impulse here.`;
      const rest = a.items.filter((i) => i !== big);
      const restTotal = rest.reduce((sum, i) => sum + i.pricePence * i.qty, 0);
      const resultRisk = rest.length ? weightedRisk(rest) : 0;
      const resultSafe = a.impact.safeToSpendBeforePence - restTotal;
      const resultVerdict: Verdict = verdictFor(resultRisk, a.affordability, rest);
      a.negotiation = [
        {
          id: "demo_drop_big",
          action: "drop" as const,
          itemIndex: big.index,
          text: `Drop the ${short} and keep the rest for ${pounds(restTotal)}`,
          resultRegretRisk: resultRisk,
          resultSafeToSpendAfterPence: resultSafe,
          resultVerdict,
        },
        ...a.negotiation.filter((n) => !(n.action === "drop" && n.itemIndex === big.index)),
      ].slice(0, 3);
      a.topFactors = [
        { key: "want_level" as FactorKey, text: `${pounds(big.pricePence)} on one piece is the impulse in this basket` },
        ...a.topFactors.filter((f) => f.key !== "want_level"),
      ].slice(0, 3);
      a.spokenLine = a.headline;
      hit = hit ?? RULES[0];
      hitItem = hitItem ?? big;
    }
  }

  // A high-risk single item with no negotiation gets a "wait until payday" option.
  if (!hit || !hitItem) return a;
  if (a.verdict === "strong_nudge" && a.negotiation.length === 0) {
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
