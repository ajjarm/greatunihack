/**
 * The deterministic half of the Brain (SPEC 5.1, 5.3-5.6): given the basket, the
 * necessity judgements and the user's overrides (essential answers, dropped or delayed
 * items, a reason), compute every number in the Assessment. No model calls here; the
 * words that need Claude are layered on in assess.ts.
 */
import {
  CATEGORY_LABELS,
  type AssessRequest,
  type AssessedItem,
  type Category,
  type Factor,
  type FactorKey,
  type Impact,
  type LimitImpact,
  type NecessityTag,
  type NegotiationOption,
  type Purchase,
  type ReasonVerdict,
  type Rule,
  type TimelinePoint,
  type Verdict,
} from "../types";
import { calibrationFor, type StoreState } from "../store";
import { clamp, daysBetween, limitImpact, nextBill, nextIncome, pounds, spentThisWeek } from "../logic";
import type { ItemJudgement } from "./necessity";
import {
  baseTimeline,
  catLabel,
  clockText,
  cueTally,
  findDuplicates,
  riskyWindowsNow,
  shortDate,
  tally,
  typicalSpend,
  weekdayName,
  type LocalMoment,
} from "./signals";

// ---------- tuning (maxima are fixed by SPEC 5.4; only the shapes inside them are tuned) ----------

export const MAX: Record<Exclude<FactorKey, "reason">, number> = {
  want_level: 25,
  history: 20,
  duplicate: 15,
  pressure: 10,
  timing: 10,
  money_strain: 15,
};

/** want_level as a piecewise inverse of necessity: pure wants (<=30) score the full 25. */
const WANT_KNOTS: [number, number][] = [[0, 25], [30, 25], [40, 14], [60, 6], [85, 1], [100, 0]];

function wantFromNecessity(n: number): number {
  for (let i = 1; i < WANT_KNOTS.length; i++) {
    const [x1, y1] = WANT_KNOTS[i];
    const [x0, y0] = WANT_KNOTS[i - 1];
    if (n <= x1) return y0 + ((n - x0) / (x1 - x0)) * (y1 - y0);
  }
  return 0;
}

export interface Overrides {
  essential: (boolean | null)[]; // by original item index
  dropped: number[]; // original indices
  delayed: number[]; // original indices
  reason?: ReasonVerdict & { appliesTo?: number[] };
}

export interface EvalItem extends AssessedItem {
  orig: number;
  shortName: string;
  delayed: boolean;
  ruleHits: Rule[];
  why: string;
}

export interface Evaluation {
  items: EvalItem[];
  paidPence: number;
  regretRisk: number;
  affordability: number;
  impact: Impact;
  timeline: TimelinePoint[];
  verdict: Verdict;
  pendingPrompt: boolean;
  overdraftShortPence: number; // most negative after-basket balance, as a positive number
  calibrationCategory: Category;
  negotiation: NegotiationOption[];
}

const priceOf = (req: AssessRequest, i: number) => req.items[i].pricePence * req.items[i].qty;

function round1(n: number): number {
  return Math.round(n * 10) / 10;
}

function listNames(list: Purchase[], max = 3): string {
  return list
    .slice(0, max)
    .map((p) => `${p.item} on ${shortDate(p.purchasedAt)}`)
    .join(", ");
}

// ---------- money ----------

interface Money {
  impact: Impact;
  timeline: TimelinePoint[];
  affordability: number;
  overdraftShortPence: number;
  catTotals: Map<Category, number>;
}

function moneyFor(store: StoreState, req: AssessRequest, cats: Category[], paid: number[], delayed: number[], paidPence: number): Money {
  const persona = store.persona;
  const income = nextIncome(persona);
  const bill = nextBill(persona);
  const base = baseTimeline(store);
  const delayedPence = delayed.reduce((s, i) => s + priceOf(req, i), 0);
  const timeline = base.map((p) => ({
    ...p,
    projectedAfterPence: p.projectedPence - paidPence - (p.date >= income.date ? delayedPence : 0),
  }));
  const beforeIncome = timeline.filter((p) => p.date < income.date);
  const safeBefore = Math.min(persona.balancePence, ...beforeIncome.map((p) => p.projectedPence));
  const safeAfter = safeBefore - paidPence;

  let overdraftUntil: string | null = null;
  let short = 0;
  for (let i = 0; i < timeline.length && overdraftUntil === null; i++) {
    const p = timeline[i];
    if ((p.projectedAfterPence ?? 0) < 0 && p.projectedPence >= 0) {
      overdraftUntil = timeline[timeline.length - 1].date;
      for (let j = i; j < timeline.length; j++) {
        const after = timeline[j].projectedAfterPence ?? 0;
        if (after >= 0) {
          overdraftUntil = timeline[j].date;
          break;
        }
        short = Math.max(short, -after);
      }
    }
  }

  const catTotals = new Map<Category, number>();
  for (const i of paid) catTotals.set(cats[i], (catTotals.get(cats[i]) ?? 0) + priceOf(req, i));
  let limit: LimitImpact | undefined;
  for (const [cat, total] of catTotals) {
    const li = limitImpact(store, cat, total);
    if (!li) continue;
    if (!limit || li.overByPence > limit.overByPence || (li.overByPence === limit.overByPence && total > (catTotals.get(limit.category) ?? 0))) limit = li;
  }

  const daysToNextIncome = Math.max(0, daysBetween(persona.demoDate, income.date));
  const impact: Impact = {
    safeToSpendBeforePence: safeBefore,
    safeToSpendAfterPence: safeAfter,
    daysToNextIncome,
    nextIncome: income,
    nextBill: { ...bill, coveredAfter: safeAfter >= bill.amountPence },
    ...(limit ? { limit } : {}),
    workingHours: persona.hourlyRatePence > 0 ? round1(paidPence / persona.hourlyRatePence) : 0,
    goalSharePct: persona.goal.targetPence > 0 ? Math.round((paidPence / persona.goal.targetPence) * 100) : 0,
    overdraftUntil,
  };

  // SPEC 5.3 affordability bands on the buffer before next income
  const days = Math.max(1, daysToNextIncome);
  const b = safeAfter;
  let aff: number;
  if (b < 0) aff = 0;
  else if (b < 500 * days) aff = 10 + (29 * b) / (500 * days);
  else if (b < 1500 * days) aff = 40 + (39 * (b - 500 * days)) / (1000 * days);
  else aff = 100 - 20 * Math.min(1, (paidPence / Math.max(1, safeBefore)) * 2.5);
  if (b >= 0 && limit) {
    const used = (limit.spentThisWeekPence + (catTotals.get(limit.category) ?? 0)) / Math.max(1, limit.weeklyLimitPence);
    aff -= 15 * clamp((used - 0.5) / 0.5, 0, 1);
  }
  // overdraft never counts as money: a dip the basket causes later in the horizon costs too
  if (b >= 0 && overdraftUntil) aff -= 20;
  const affordability = b < 0 ? 0 : clamp(Math.round(aff), 0, 100);

  return { impact, timeline, affordability, overdraftShortPence: short, catTotals };
}

function causesOverdraft(store: StoreState, pence: number): boolean {
  return baseTimeline(store).some((p) => p.projectedPence >= 0 && p.projectedPence - pence < 0);
}

// ---------- verdict (SPEC 5.5, reconciled with the fixture flow in MOCK-DATA-GUIDE) ----------

export function liveVerdict(regretRisk: number, affordability: number, items: EvalItem[]): { verdict: Verdict; pendingPrompt: boolean } {
  const band: Verdict = regretRisk >= 70 ? "strong_nudge" : regretRisk >= 40 ? "nudge" : affordability < 40 ? "nudge" : "go_ahead";
  const pendingPrompt = items.some((i) => i.essentialPrompt && i.essential === null);
  const others = items.filter((i) => i.essential !== true && i.necessity < 60);
  const othersCalm = others.every((i) => i.regretRisk < 40);
  // the user said it is essential, and nothing else in the basket is risky: buy it, here's how
  if (items.some((i) => i.essential === true) && othersCalm) return { verdict: "essential_cover", pendingPrompt };
  // looks essential but unanswered: keep the card open and ask first
  if (pendingPrompt) return { verdict: band === "go_ahead" ? "nudge" : band, pendingPrompt };
  // a need settled by a rule only needs a cover plan when the money is strained
  const settledNeed = items.some((i) => i.necessity >= 60 && i.essential !== false);
  if (settledNeed && othersCalm && band !== "go_ahead") return { verdict: "essential_cover", pendingPrompt };
  return { verdict: band, pendingPrompt };
}

// ---------- the evaluation ----------

export interface EvalInput {
  store: StoreState;
  req: AssessRequest;
  now: LocalMoment;
  judgements: ItemJudgement[];
  overrides: Overrides;
}

export function evaluate(input: EvalInput, withNegotiation = true): Evaluation {
  const { store, req, now, judgements, overrides } = input;
  const persona = store.persona;
  const cats = judgements.map((j) => j.category);
  const active = req.items.map((_, i) => i).filter((i) => !overrides.dropped.includes(i));
  const delayed = active.filter((i) => overrides.delayed.includes(i));
  const paid = active.filter((i) => !overrides.delayed.includes(i));
  const paidItems = paid.reduce((s, i) => s + priceOf(req, i), 0);
  const untouched = overrides.dropped.length === 0 && overrides.delayed.length === 0;
  const paidPence = untouched ? req.totalPence : paid.length ? paidItems + req.deliveryPence : 0;

  const money = moneyFor(store, req, cats, paid, delayed, paidPence);
  const { impact, affordability } = money;

  // pressure for the whole basket: each cue adds, more if this user has regretted under it before
  const cueKeys = [...new Set(req.cues.map((c) => c.key))];
  let basketPressure = 0;
  const cueEvidence: string[] = [];
  for (const key of cueKeys) {
    const t = cueTally(store, key);
    const sens = t.reviewed >= 3 ? t.regretted / t.reviewed : 0.5;
    basketPressure += 6 + Math.round(4 * sens);
    if (t.reviewed >= 3) cueEvidence.push(`${t.regretted} of ${t.reviewed} purchases you made under a ${key.replace(/_/g, " ")} cue were regrets`);
  }
  basketPressure = Math.min(MAX.pressure, basketPressure);

  const purchasesToday = store.purchases.filter((p) => p.purchasedAt.slice(0, 10) === now.date && Date.parse(p.purchasedAt) < now.ms).length;
  const lateHour = now.hour >= 23 || now.hour < 4;

  const items: EvalItem[] = active.map((orig, index) => {
    const it = req.items[orig];
    const j = judgements[orig];
    const category = cats[orig];
    const price = priceOf(req, orig);
    const isDelayed = overrides.delayed.includes(orig);
    const share = isDelayed ? 1 : paidItems > 0 ? price / paidItems : 1;
    const answer = overrides.essential[orig] ?? null;
    const ruleHits = persona.rules.filter((r) => j.ruleIds.includes(r.id));
    const avoid = ruleHits.find((r) => r.direction === "avoid");
    const fine = ruleHits.find((r) => r.direction === "always_fine");

    // necessity after rules and the user's answer (SPEC 5.2)
    let necessity = j.necessity;
    if (avoid) necessity = Math.max(0, necessity - 15);
    if (fine) necessity = Math.max(necessity, 85);
    if (answer === true) necessity = 95;
    necessity = clamp(Math.round(necessity), 0, 100);
    const isNeed = necessity >= 60;
    const tag: NecessityTag = isNeed ? "need" : necessity >= 40 ? "useful" : "want";
    const essentialPrompt = answer === null && !fine && (necessity >= 60 || (j.confidence === "low" && necessity >= 40));

    const factors: Factor[] = [];
    const label = catLabel(category);

    // 1. want_level
    let want = wantFromNecessity(necessity);
    if (avoid) want = Math.max(want, 23);
    if (fine) want = Math.min(want, 2);
    if (answer === true) want = 0;
    want = Math.round(Math.min(MAX.want_level, want));
    const Short = j.shortName.charAt(0).toUpperCase() + j.shortName.slice(1);
    const wantText = answer === true
      ? `You said this one is essential`
      : avoid
        ? `You set a rule: ${avoid.text.charAt(0).toLowerCase()}${avoid.text.slice(1)}`
        : fine
          ? `${fine.text}, you said`
          : necessity >= 85
            ? `${Short}: looks like a need`
            : isNeed
              ? `${Short}: needed, but it could probably wait`
              : necessity >= 40
                ? `${Short}: useful, but more want than need`
                : `${Short}: a want, not a need`;
    factors.push({
      key: "want_level",
      points: want,
      max: MAX.want_level,
      text: wantText,
      ...(avoid || fine ? { evidence: `Rule: ${(avoid ?? fine)!.text}` } : j.why ? { evidence: j.why } : {}),
    });

    // 2. history: smoothed regret rate in the category; omitted under 3 reviews
    const before = store.purchases.filter((p) => p.category === category && Date.parse(p.purchasedAt) < now.ms);
    const hist = tally(before);
    const limitedHistory = hist.reviewed < 3;
    if (!limitedHistory) {
      const pts = Math.round((MAX.history * hist.regretted) / (hist.reviewed + 1));
      factors.push({
        key: "history",
        points: Math.min(MAX.history, pts),
        max: MAX.history,
        text: hist.regretted === 0
          ? `All ${hist.reviewed} ${label} purchases you reviewed were happy ones`
          : `You regretted ${hist.regretted} of the ${hist.reviewed} ${label} purchases you reviewed`,
        evidence: hist.regretted === 0 ? hist.happy.map((p) => p.id).join(", ") : listNames(hist.regrets),
      });
    }

    // 3. duplicate
    let duplicateOf: AssessedItem["duplicateOf"];
    if (!isNeed && answer !== true) {
      const dup = findDuplicates(store, it.name, category, now.ms);
      if (dup.strong.length) {
        const first = dup.strong[0];
        const regretted = dup.strong.some((p) => p.feedback === "regretted");
        const pts = 10 + (regretted || dup.strong.length >= 2 ? 5 : 0);
        duplicateOf = { purchaseId: first.id, item: first.item, purchasedAt: first.purchasedAt };
        factors.push({
          key: "duplicate",
          points: Math.min(MAX.duplicate, pts),
          max: MAX.duplicate,
          text: dup.strong.length >= 2
            ? `You already own ${dup.strong.length} like this; the ${first.item.toLowerCase()} from ${shortDate(first.purchasedAt)}${first.feedback === "regretted" ? " was a regret" : ""}`
            : `You bought ${first.item} on ${shortDate(first.purchasedAt)}${first.feedback === "regretted" ? " and regretted it" : ""}`,
          evidence: dup.strong.map((p) => `${p.id}, ${shortDate(p.purchasedAt)}, ${pounds(p.amountPence)}`).join("; "),
        });
      } else if (dup.weak.length) {
        const first = dup.weak[0];
        factors.push({
          key: "duplicate",
          points: 5,
          max: MAX.duplicate,
          text: `You already have ${first.item}${first.feedback === "happy" ? ", and you're happy with them" : ""}`,
          evidence: `${first.id}, ${shortDate(first.purchasedAt)}, ${pounds(first.amountPence)}`,
        });
      }
    }

    // 4. pressure: the basket's cues, shared by price
    if (basketPressure > 0 && !isDelayed) {
      let pts = Math.round(basketPressure * share);
      if (isNeed) pts = Math.round(pts / 2);
      if (pts > 0) {
        const first = req.cues[0];
        factors.push({
          key: "pressure",
          points: pts,
          max: MAX.pressure,
          text: req.cues.length > 1
            ? `${req.cues.length} sales cues on the page, built to make you hurry`
            : `"${first.text}" is a sales cue, not a fact about your life`,
          ...(cueEvidence.length ? { evidence: cueEvidence.join("; ") } : {}),
        });
      }
    }

    // 5. timing: risky windows from the user's own reviews, then plain late-night hours
    if (!isDelayed) {
      let best = 0;
      let bestText = "";
      let bestEvidence = "";
      for (const hit of riskyWindowsNow(store, now, category)) {
        const own = hit.inCategory.reviewed >= 3 ? hit.inCategory : hit.inCategory.regretted > 0 ? hit.all : null;
        if (!own) continue;
        const pts = Math.round(MAX.timing * (own.regretted / own.reviewed));
        if (pts > best) {
          best = pts;
          bestText = own === hit.inCategory
            ? `${hit.def.label}: you regretted ${own.regretted} of your ${own.reviewed} ${label} purchases then`
            : `${hit.def.label}: you regretted ${own.regretted} of the ${own.reviewed} purchases you made then`;
          bestEvidence = own.regrets.map((p) => p.id).join(", ");
        }
      }
      let pts = best;
      let text = bestText;
      if (lateHour && pts < 5) {
        pts = 5;
        text = `It's ${clockText(now)}, late, but ${label} purchases aren't part of your late-night pattern`;
        bestEvidence = "";
      }
      if (purchasesToday >= 3) {
        pts += 3;
        text = text ? `${text}, and it's your ${purchasesToday + 1}th purchase today` : `This would be purchase number ${purchasesToday + 1} today`;
      }
      pts = Math.min(MAX.timing, pts);
      if (isNeed) pts = Math.round(pts / 2);
      if (pts > 0) factors.push({ key: "timing", points: pts, max: MAX.timing, text, ...(bestEvidence ? { evidence: bestEvidence } : {}) });
    }

    // 6. money_strain: limit, overdraft, affordability, size versus typical, hours of work
    {
      const reasons: { pts: number; text: string }[] = [];
      if (!isDelayed) {
        const lim = persona.limits.find((l) => l.category === category);
        if (lim) {
          const spent = spentThisWeek(store, category);
          const catTotal = money.catTotals.get(category) ?? price;
          let pts = 0;
          if (spent + price > lim.weeklyLimitPence) pts = 10;
          else if (spent + price >= 0.9 * lim.weeklyLimitPence) pts = 3;
          if (pts < 10 && spent + catTotal > lim.weeklyLimitPence) pts = Math.max(pts, (10 * price) / catTotal);
          const over = spent + catTotal - lim.weeklyLimitPence;
          if (pts > 0) {
            reasons.push({
              pts,
              text: over > 0
                ? `This puts ${label} ${pounds(over)} over the weekly limit`
                : `You'd have ${pounds(lim.weeklyLimitPence - spent - catTotal)} left of the ${pounds(lim.weeklyLimitPence)} ${label} limit`,
            });
          }
        }
        if (impact.overdraftUntil) {
          const alone = causesOverdraft(store, price);
          reasons.push({
            pts: alone ? 5 : 5 * share,
            text: `leaves you ${pounds(money.overdraftShortPence)} short until ${shortDate(impact.overdraftUntil)}`,
          });
        }
        const affPts = (affordability < 40 ? 5 : affordability < 60 ? 2 : 0) * share;
        if (affPts > 0) reasons.push({ pts: affPts, text: `only ${pounds(impact.safeToSpendAfterPence)} safe until ${weekdayName(impact.nextIncome.date)}` });
      }
      const typical = typicalSpend(store, category);
      if (typical && typical > 0) {
        const ratio = price / typical;
        const pts = ratio >= 2 ? 7 : ratio >= 1.5 ? 5 : ratio >= 1.25 ? 2 : 0;
        if (pts) reasons.push({ pts, text: `${pounds(price)} is ${round1(ratio)} times what you usually spend on ${label}` });
      }
      const hours = persona.hourlyRatePence > 0 ? price / persona.hourlyRatePence : 0;
      const hourPts = hours >= 8 ? 3 : hours >= 5 ? 2 : 0;
      if (hourPts) reasons.push({ pts: hourPts, text: `${pounds(price)} is ${Math.round(hours)} hours of shifts` });
      const total = Math.min(MAX.money_strain, Math.round(reasons.reduce((s, r) => s + r.pts, 0)));
      if (total > 0) {
        const top = [...reasons].sort((a, b) => b.pts - a.pts).slice(0, 2).map((r) => r.text);
        const text = top.length > 1 ? `${top[0]} and ${top[1].charAt(0).toLowerCase()}${top[1].slice(1)}` : top[0];
        factors.push({ key: "money_strain", points: total, max: MAX.money_strain, text: text.charAt(0).toUpperCase() + text.slice(1) });
      }
    }

    // 7. reason
    const reason = overrides.reason;
    if (reason && reason.adjustment < 0 && (!reason.appliesTo || reason.appliesTo.length === 0 || reason.appliesTo.includes(orig))) {
      factors.push({ key: "reason", points: reason.adjustment, max: 0, text: `Your reason: ${reason.text}` });
    }

    const sum = factors.reduce((s, f) => s + f.points, 0);
    const multiplier = calibrationFor(category).multiplier;
    const regretRisk = clamp(Math.round(sum * multiplier), 0, 100);

    return {
      index,
      name: it.name,
      pricePence: it.pricePence,
      qty: it.qty,
      category,
      necessity,
      necessityTag: tag,
      necessityConfidence: j.confidence,
      essentialPrompt,
      essential: answer,
      regretRisk,
      factors,
      ...(duplicateOf ? { duplicateOf } : {}),
      limitedHistory,
      orig,
      shortName: j.shortName,
      delayed: isDelayed,
      ruleHits,
      why: j.why,
    };
  });

  const weight = items.reduce((s, it) => s + it.pricePence * it.qty, 0);
  const regretRisk = weight > 0 ? clamp(Math.round(items.reduce((s, it) => s + it.regretRisk * it.pricePence * it.qty, 0) / weight), 0, 100) : 0;
  const { verdict, pendingPrompt } = liveVerdict(regretRisk, affordability, items);

  let calibrationCategory: Category = items[0]?.category ?? "other";
  let bestContribution = -1;
  for (const it of items) {
    const c = it.regretRisk * it.pricePence * it.qty;
    if (c > bestContribution) {
      bestContribution = c;
      calibrationCategory = it.category;
    }
  }

  const evaluation: Evaluation = {
    items,
    paidPence,
    regretRisk,
    affordability,
    impact,
    timeline: money.timeline,
    verdict,
    pendingPrompt,
    overdraftShortPence: money.overdraftShortPence,
    calibrationCategory,
    negotiation: [],
  };
  if (withNegotiation) evaluation.negotiation = negotiate(input, evaluation);
  return evaluation;
}

// ---------- negotiation (SPEC 5.6) ----------

function negotiate(input: EvalInput, current: Evaluation): NegotiationOption[] {
  if (current.verdict !== "nudge" && current.verdict !== "strong_nudge") return [];
  const income = current.impact.nextIncome;
  const paidNow = current.items.filter((i) => !i.delayed);
  const candidates = paidNow.filter((i) => i.essential !== true && i.regretRisk >= 40).sort((a, b) => b.regretRisk - a.regretRisk);
  const options: NegotiationOption[] = [];
  for (const item of candidates.slice(0, 2)) {
    let green = false;
    if (paidNow.length >= 2 && options.length < 3) {
      const r = evaluate({ ...input, overrides: { ...input.overrides, dropped: [...input.overrides.dropped, item.orig] } }, false);
      const others = paidNow.filter((i) => i.orig !== item.orig);
      options.push({
        id: `neg_drop_${item.orig}`,
        action: "drop",
        itemIndex: item.index,
        text: others.length === 1 ? `Drop the ${item.shortName}, keep the ${others[0].shortName}` : `Drop the ${item.shortName}`,
        resultRegretRisk: r.regretRisk,
        resultSafeToSpendAfterPence: r.impact.safeToSpendAfterPence,
        resultVerdict: r.verdict,
      });
      green = r.verdict === "go_ahead" || !r.impact.limit || r.impact.limit.overByPence === 0;
    }
    if (options.length < 3 && income.date > input.store.persona.demoDate) {
      const r = evaluate({ ...input, overrides: { ...input.overrides, delayed: [...input.overrides.delayed, item.orig] } }, false);
      options.push({
        id: `neg_delay_${item.orig}`,
        action: "delay",
        itemIndex: item.index,
        text: `Put the ${item.shortName} on hold until payday, ${weekdayName(income.date)} ${shortDate(income.date)}`,
        resultRegretRisk: r.regretRisk,
        resultSafeToSpendAfterPence: r.impact.safeToSpendAfterPence,
        resultVerdict: r.verdict,
        delayUntil: income.date,
      });
      if (r.verdict === "go_ahead") green = true;
    }
    if (green || options.length >= 3) break;
  }
  return options;
}

// ---------- template words (also the fallback for every Claude text call) ----------

function bestLimitWithRoom(store: StoreState, exclude: Category[], need: number): { category: Category; room: number } | null {
  let best: { category: Category; room: number } | null = null;
  for (const l of store.persona.limits) {
    if (exclude.includes(l.category)) continue;
    const room = l.weeklyLimitPence - spentThisWeek(store, l.category);
    if (room >= need && (!best || room > best.room)) best = { category: l.category, room };
  }
  return best;
}

/** The essential_cover headline, from the arithmetic: a limit with room, or an honest overdraft line. */
export function coverHeadline(store: StoreState, e: Evaluation): string {
  const cats = e.items.map((i) => i.category);
  const income = e.impact.nextIncome;
  if (e.impact.safeToSpendAfterPence < 0 || e.impact.overdraftUntil) {
    const short = Math.max(e.overdraftShortPence, -e.impact.safeToSpendAfterPence);
    const room = bestLimitWithRoom(store, cats, short);
    if (room) return `Buy it. Hold back ${pounds(short)} of ${CATEGORY_LABELS[room.category].toLowerCase()} this week and you stay out of overdraft.`;
    const until = e.impact.overdraftUntil ?? income.date;
    return `Buy it. You'd be ${pounds(short)} overdrawn until ${shortDate(until)}, when ${income.name.toLowerCase()} pays.`;
  }
  if (e.affordability < 40) {
    const room = bestLimitWithRoom(store, cats, e.paidPence);
    if (room) return `Buy it. Take ${pounds(e.paidPence)} out of this week's ${CATEGORY_LABELS[room.category].toLowerCase()} money and you're covered.`;
    return `Buy it. It's tight: ${pounds(e.impact.safeToSpendAfterPence)} left until ${weekdayName(income.date)}.`;
  }
  return `Buy it. ${pounds(e.impact.safeToSpendAfterPence)} still safe until ${weekdayName(income.date)}.`;
}

export function templateHeadline(store: StoreState, e: Evaluation): string {
  switch (e.verdict) {
    case "go_ahead":
      return `Looks fine. ${pounds(e.impact.safeToSpendAfterPence)} safe after this.`;
    case "essential_cover":
      return coverHeadline(store, e);
    case "nudge":
      return e.pendingPrompt && e.regretRisk < 40 ? "Looks essential. Is it?" : "Worth a second look before you buy.";
    case "strong_nudge":
      return "Hold on, this looks like an impulse buy.";
  }
}

export function templateSpokenLine(e: Evaluation, headline: string): string {
  if (e.verdict === "go_ahead") return "Looks fine.";
  if (e.pendingPrompt && e.verdict === "nudge" && e.regretRisk < 40) return "This looks essential. Is it?";
  return headline;
}

export interface FactorCandidate {
  key: FactorKey;
  text: string;
  points: number;
  item: string;
}

/** Best factor per key across the basket, biggest contribution first. */
export function factorCandidates(e: Evaluation): FactorCandidate[] {
  const best = new Map<FactorKey, FactorCandidate & { weight: number }>();
  for (const it of e.items) {
    for (const f of it.factors) {
      const weight = Math.abs(f.points) * (it.pricePence * it.qty);
      const cur = best.get(f.key);
      if (!cur || Math.abs(f.points) > Math.abs(cur.points) || (Math.abs(f.points) === Math.abs(cur.points) && weight > cur.weight)) {
        best.set(f.key, { key: f.key, text: f.text, points: f.points, item: it.name, weight });
      }
    }
  }
  return [...best.values()].sort((a, b) => Math.abs(b.points) - Math.abs(a.points)).map(({ key, text, points, item }) => ({ key, text, points, item }));
}

export function templateTopFactors(e: Evaluation): { key: FactorKey; text: string }[] {
  const c = factorCandidates(e);
  const reasonFirst = c.filter((f) => f.key === "reason");
  let ordered = [...reasonFirst, ...c.filter((f) => f.key !== "reason")];
  if (e.verdict === "go_ahead" || e.verdict === "essential_cover" || (e.pendingPrompt && e.regretRisk < 40)) {
    const want = ordered.filter((f) => f.key === "want_level");
    ordered = [...want, ...ordered.filter((f) => f.key !== "want_level" && f.points > 0)];
  } else {
    ordered = ordered.filter((f) => f.points !== 0);
  }
  return ordered.slice(0, 3).map(({ key, text }) => ({ key, text }));
}

export function templateReasoning(e: Evaluation): string {
  const parts: string[] = [];
  const ranked = [...e.items].sort((a, b) => b.regretRisk - a.regretRisk);
  const top = ranked[0];
  if (top) {
    const strongest = [...top.factors].filter((f) => f.points > 0).sort((a, b) => b.points - a.points).slice(0, 2).map((f) => f.text.replace(/\.$/, ""));
    parts.push(`Regret risk on the ${top.shortName}: ${top.regretRisk}%${strongest.length ? `. ${strongest.join(". ")}` : ""}.`);
  }
  for (const it of ranked.slice(1, 3)) parts.push(`Regret risk on the ${it.shortName}: ${it.regretRisk}%, tagged ${it.necessityTag}.`);
  const imp = e.impact;
  parts.push(`${pounds(e.paidPence)} leaves ${pounds(imp.safeToSpendAfterPence)} safe before ${weekdayName(imp.nextIncome.date)}'s ${imp.nextIncome.name.toLowerCase()}.`);
  if (imp.limit && imp.limit.overByPence > 0) parts.push(`It takes ${catLabel(imp.limit.category)} ${pounds(imp.limit.overByPence)} over this week's limit.`);
  if (imp.overdraftUntil) parts.push(`Later on you would be ${pounds(e.overdraftShortPence)} short until ${shortDate(imp.overdraftUntil)}.`);
  const opt = e.negotiation[0];
  if (opt) parts.push(`${opt.text} and the risk drops to ${opt.resultRegretRisk}.`);
  return parts.join(" ");
}

/** SPEC 5.6 reflection guide: food 1, clothes 3, electronics 7, subscriptions 30, courses 60. */
export function templateReflectionDays(e: Evaluation): number {
  const byCat: Record<Category, number> = {
    groceries: 1, eating_out: 1, clothes: 3, accessories: 3, tech: 7, fun: 7, books: 14, health: 14,
    transport: 3, subscriptions: 30, gifts: 7, household: 7, other: 7,
  };
  const course = e.items.some((i) => /course|module|lecture|class/i.test(i.name) && i.category !== "books");
  return course ? 60 : byCat[e.calibrationCategory] ?? 7;
}
