/**
 * npm run check:data — loads every file in data/, validates shapes against the types in
 * src/lib/types.ts with a small hand-rolled validator, then checks the cross-file
 * consistency the demo relies on. Prints PASS/FAIL per check and exits 1 on any failure.
 */
import fs from "node:fs";
import path from "node:path";
import { CATEGORIES, CUE_KEYS } from "../src/lib/types";

// ---------- locate data/ ----------
function findDataDir(): string {
  let dir = process.cwd();
  for (let i = 0; i < 6; i++) {
    const candidate = path.join(dir, "data");
    if (fs.existsSync(path.join(candidate, "persona.json"))) return candidate;
    const parent = path.dirname(dir);
    if (parent === dir) break;
    dir = parent;
  }
  throw new Error("Could not find data/persona.json above " + process.cwd());
}
const DATA = findDataDir();
const load = (name: string): unknown => JSON.parse(fs.readFileSync(path.join(DATA, name), "utf8"));

// ---------- tiny validator ----------
type V = (x: unknown, at: string, errs: string[]) => void;
const fail = (errs: string[], at: string, msg: string) => errs.push(`${at}: ${msg}`);

const str: V = (x, at, e) => { if (typeof x !== "string") fail(e, at, `expected string, got ${typeof x}`); };
const nonEmpty: V = (x, at, e) => { str(x, at, e); if (typeof x === "string" && !x.trim()) fail(e, at, "empty string"); };
const num: V = (x, at, e) => { if (typeof x !== "number" || Number.isNaN(x)) fail(e, at, `expected number, got ${typeof x}`); };
const int: V = (x, at, e) => { num(x, at, e); if (typeof x === "number" && !Number.isInteger(x)) fail(e, at, `expected integer, got ${x}`); };
const bool: V = (x, at, e) => { if (typeof x !== "boolean") fail(e, at, `expected boolean, got ${typeof x}`); };
const range = (lo: number, hi: number): V => (x, at, e) => { num(x, at, e); if (typeof x === "number" && (x < lo || x > hi)) fail(e, at, `expected ${lo}-${hi}, got ${x}`); };
const oneOf = (values: readonly string[]): V => (x, at, e) => { if (!values.includes(x as string)) fail(e, at, `expected one of ${values.join("|")}, got ${JSON.stringify(x)}`); };
const nullable = (v: V): V => (x, at, e) => { if (x !== null) v(x, at, e); };
const isoDate: V = (x, at, e) => { str(x, at, e); if (typeof x === "string" && !/^\d{4}-\d{2}-\d{2}$/.test(x)) fail(e, at, `expected YYYY-MM-DD, got ${x}`); };
const isoDateTime: V = (x, at, e) => {
  str(x, at, e);
  if (typeof x === "string" && (!/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d+)?(?:Z|[+-]\d{2}:\d{2})$/.test(x) || Number.isNaN(Date.parse(x)))) fail(e, at, `expected ISO 8601 with offset, got ${x}`);
};
const arr = (v: V, min = 0): V => (x, at, e) => {
  if (!Array.isArray(x)) return fail(e, at, `expected array, got ${typeof x}`);
  if (x.length < min) fail(e, at, `expected at least ${min} items, got ${x.length}`);
  x.forEach((item, i) => v(item, `${at}[${i}]`, e));
};
type Shape = Record<string, V | { opt: V }>;
const opt = (v: V) => ({ opt: v });
const obj = (shape: Shape, extra = false): V => (x, at, e) => {
  if (!x || typeof x !== "object" || Array.isArray(x)) return fail(e, at, `expected object, got ${Array.isArray(x) ? "array" : typeof x}`);
  const o = x as Record<string, unknown>;
  for (const [key, rule] of Object.entries(shape)) {
    const optional = typeof rule === "object";
    const v = typeof rule === "object" ? rule.opt : rule;
    if (!(key in o)) { if (!optional) fail(e, `${at}.${key}`, "missing"); continue; }
    if (optional && o[key] === undefined) continue;
    v(o[key], `${at}.${key}`, e);
  }
  if (!extra) for (const key of Object.keys(o)) if (!(key in shape)) fail(e, `${at}.${key}`, "unexpected key");
};
const or = (...vs: V[]): V => (x, at, e) => {
  for (const v of vs) { const local: string[] = []; v(x, at, local); if (local.length === 0) return; }
  fail(e, at, "matched none of the allowed shapes");
};
const noBang: V = (x, at, e) => { if (typeof x === "string" && x.includes("!")) fail(e, at, "no exclamation marks in copy"); };
const copy: V = (x, at, e) => { nonEmpty(x, at, e); noBang(x, at, e); };

// ---------- shapes (mirror src/lib/types.ts) ----------
const category = oneOf(CATEGORIES);
const cueKey = oneOf(CUE_KEYS);
const verdict = oneOf(["go_ahead", "essential_cover", "nudge", "strong_nudge"]);
const decision = oneOf(["none", "wait", "buy_anyway", "dismiss", "negotiated"]);
const feedback = oneOf(["happy", "regretted", "unsure"]);
const factorKey = oneOf(["want_level", "history", "duplicate", "pressure", "timing", "money_strain", "reason"]);

const moneyEvent = obj({ name: copy, date: isoDate, amountPence: int });
const schedule = or(
  obj({ type: oneOf(["once"]), date: isoDate }),
  obj({ type: oneOf(["monthly"]), dayOfMonth: range(1, 31) }),
  obj({ type: oneOf(["fortnightly"]), weekday: range(0, 6), nextDate: isoDate }),
);
const persona = obj({
  name: copy, demoDate: isoDate, demoNow: isoDateTime, hourlyRatePence: int, balancePence: int,
  incomes: arr(obj({ id: nonEmpty, name: copy, amountPence: int, schedule, nextDate: isoDate }), 1),
  outgoings: arr(obj({ id: nonEmpty, name: copy, amountPence: int, dayOfMonth: range(1, 31), category }), 1),
  limits: arr(obj({ category, weeklyLimitPence: int })),
  rules: arr(obj({ id: nonEmpty, text: copy, category: opt(category), direction: oneOf(["avoid", "always_fine"]), until: opt(nonEmpty) })),
  goal: obj({ name: copy, targetPence: int, savedPence: int }),
});
const purchase = obj({
  id: nonEmpty, merchant: copy, item: copy, category, amountPence: int, purchasedAt: isoDateTime,
  source: oneOf(["feed", "watcher", "manual"]), essential: bool, cues: arr(cueKey),
  predictedRegret: opt(range(0, 100)), assessmentId: opt(nonEmpty), feedback: nullable(feedback),
  feedbackReason: opt(copy), feedbackAt: opt(isoDateTime), reflectionDueAt: opt(isoDateTime),
});
const factor = obj({ key: factorKey, points: num, max: num, text: copy, evidence: opt(copy) });
const assessedItem = obj({
  index: int, name: copy, pricePence: int, qty: int, category, necessity: range(0, 100),
  necessityTag: oneOf(["need", "useful", "want"]), necessityConfidence: oneOf(["low", "medium", "high"]),
  essentialPrompt: bool, essential: nullable(bool), regretRisk: range(0, 100), factors: arr(factor),
  duplicateOf: opt(obj({ purchaseId: nonEmpty, item: copy, purchasedAt: isoDateTime })), limitedHistory: bool,
});
const limitImpact = obj({ category, weeklyLimitPence: int, spentThisWeekPence: int, remainingAfterPence: int, overByPence: int });
const impact = obj({
  safeToSpendBeforePence: int, safeToSpendAfterPence: int, daysToNextIncome: int, nextIncome: moneyEvent,
  nextBill: obj({ name: copy, date: isoDate, amountPence: int, coveredAfter: bool }), limit: opt(limitImpact),
  workingHours: num, goalSharePct: num, overdraftUntil: nullable(isoDate),
});
const timelinePoint = obj({
  date: isoDate, projectedPence: int, projectedAfterPence: opt(int),
  events: arr(obj({ type: oneOf(["income", "bill", "purchase"]), name: copy, amountPence: int })),
});
const calibrationRef = obj({ category, multiplier: range(0.5, 1.5), tunedPct: range(0, 100) });
const assessment = obj({
  id: nonEmpty, createdAt: isoDateTime, source: oneOf(["watcher", "extension", "manual", "shortcut", "demo"]),
  merchant: copy, url: opt(nonEmpty), totalPence: int, verdict, headline: copy, spokenLine: copy,
  regretRisk: range(0, 100), affordability: range(0, 100), items: arr(assessedItem, 1), impact,
  topFactors: arr(obj({ key: factorKey, text: copy })), cues: arr(obj({ key: cueKey, text: copy, note: copy })),
  negotiation: arr(obj({
    id: nonEmpty, action: oneOf(["drop", "delay"]), itemIndex: int, text: copy, resultRegretRisk: range(0, 100),
    resultSafeToSpendAfterPence: int, resultVerdict: verdict, delayUntil: opt(isoDate),
  })),
  reflectionDays: range(1, 60), reasoning: copy, timeline: arr(timelinePoint, 1), calibration: calibrationRef,
  reason: opt(obj({ text: nonEmpty, accepted: bool, adjustment: num, verdictText: copy })), decision,
});
const assessRequest = obj({
  source: oneOf(["watcher", "extension", "manual", "shortcut", "demo"]), merchant: copy, url: opt(nonEmpty),
  items: arr(obj({ name: copy, pricePence: int, qty: int, category: opt(category) }), 1), deliveryPence: int,
  totalPence: int, cues: arr(obj({ key: cueKey, text: copy })), capturedAt: isoDateTime, basketHash: nonEmpty, scenarioId: opt(nonEmpty),
});
const scenario = obj({
  id: nonEmpty, title: copy, trigger: obj({ merchant: copy, keywords: arr(nonEmpty), urlPattern: opt(nonEmpty) }),
  request: assessRequest, response: assessment,
  variants: opt(obj({
    reason: opt(obj({ input: nonEmpty, response: assessment })),
    negotiated: opt(obj({ optionId: nonEmpty, response: assessment })),
    essentialYes: opt(obj({ itemIndex: int, response: assessment })),
  })),
});
const summary = obj({
  id: nonEmpty, createdAt: isoDateTime, merchant: copy, totalPence: int, verdict, regretRisk: range(0, 100),
  headline: copy, decision, outcome: opt(nullable(feedback)),
});
const home = obj({
  demoNow: isoDateTime,
  spendScore: obj({ value: range(0, 100), band: oneOf(["green", "amber", "red"]), trend: oneOf(["up", "flat", "down"]), explanation: copy, history: arr(obj({ weekStart: isoDate, value: range(0, 100) }), 1) }),
  balancePence: int, safeToSpendPence: int, daysToNextIncome: int, nextIncome: moneyEvent, nextBill: moneyEvent,
  insight: copy, recentAssessments: arr(summary), pendingReflections: int,
});
const insights = obj({
  sentences: arr(obj({ key: nonEmpty, text: copy, evidence: copy }), 6),
  regretByCategory: arr(obj({ category, reviewed: int, regretted: int, ratePct: range(0, 100) })),
  riskyWindows: arr(obj({ label: copy, ratePct: range(0, 100), evidence: copy })),
  pressure: obj({ withCueRatePct: range(0, 100), withoutCueRatePct: range(0, 100), sentence: copy }),
  duplicates: arr(obj({ item: copy, count: int, purchaseIds: arr(nonEmpty, 1) })),
  avoidedPence: int, avoidedCouldBe: arr(obj({ label: copy, text: copy })),
  calibration: obj({ overallPct: range(0, 100), byCategory: arr(obj({ category, pct: range(0, 100), multiplier: range(0.5, 1.5), deltaPct: num })) }),
  limits: arr(obj({ category, weeklyLimitPence: int, spentThisWeekPence: int })), timeline: arr(timelinePoint),
});
const waitingItem = obj({
  id: nonEmpty, assessmentId: nonEmpty, itemName: copy, pricePence: int, merchant: copy, url: opt(nonEmpty),
  savedAt: isoDateTime, reconsiderAt: isoDateTime, status: oneOf(["waiting", "bought", "removed", "extended"]),
});
const report = obj({
  weekStart: isoDate, nudgesShown: int, heeded: int, overridden: int, overriddenHappy: int, overriddenRegretted: int,
  limitsKept: int, limitsExceeded: int, avoidedPence: int, spendScore: range(0, 100), sentences: arr(copy, 1),
});

// ---------- run ----------
type Result = { name: string; errors: string[] };
const results: Result[] = [];
function check(name: string, fn: (errs: string[]) => void) {
  const errors: string[] = [];
  try { fn(errors); } catch (e) { errors.push(e instanceof Error ? e.message : String(e)); }
  results.push({ name, errors });
}

// Loose but typed-enough views of the data for the consistency checks.
/* eslint-disable @typescript-eslint/no-explicit-any */
const files: Record<string, any> = {};
const shapes: Record<string, V> = {
  "persona.json": persona, "purchases.json": arr(purchase, 1), "assessments-history.json": arr(summary, 1),
  "scenarios.json": arr(scenario, 1), "home.json": home, "insights.json": insights, "timeline.json": arr(timelinePoint, 1),
  "waiting.json": arr(waitingItem), "report.json": report, "calibration.json": arr(calibrationRef, 1),
};
for (const [name, shape] of Object.entries(shapes)) {
  check(`shape ${name}`, (errs) => {
    files[name] = load(name);
    shape(files[name], name.replace(".json", ""), errs);
  });
}

const P = files["persona.json"];
const purchases: any[] = files["purchases.json"] ?? [];
const scenarios: any[] = files["scenarios.json"] ?? [];
const timeline: any[] = files["timeline.json"] ?? [];
const calibration: any[] = files["calibration.json"] ?? [];
const insightsData = files["insights.json"];
const homeData = files["home.json"];
const history: any[] = files["assessments-history.json"] ?? [];
const waiting: any[] = files["waiting.json"] ?? [];
const ready = P && purchases.length && scenarios.length && timeline.length && calibration.length;

if (ready) {
  const demoNowMs = Date.parse(P.demoNow);
  const DAY = 86_400_000;
  const nextIncome = [...P.incomes].sort((a: any, b: any) => (a.nextDate < b.nextDate ? -1 : 1))[0];
  const lowestBeforeIncome = Math.min(...timeline.filter((p) => p.date < nextIncome.nextDate).map((p) => p.projectedPence));
  const spentThisWeek = (cat: string) =>
    purchases.filter((p) => p.category === cat && Date.parse(p.purchasedAt) > demoNowMs - 7 * DAY && Date.parse(p.purchasedAt) <= demoNowMs)
      .reduce((s, p) => s + p.amountPence, 0);
  const allResponses: [string, any][] = [];
  for (const s of scenarios) {
    allResponses.push([`${s.id}.response`, s.response]);
    for (const [k, v] of Object.entries(s.variants ?? {})) allResponses.push([`${s.id}.variants.${k}`, (v as any).response]);
  }

  check("persona: demoNow is on demoDate and balance is set", (errs) => {
    if (!P.demoNow.startsWith(P.demoDate)) errs.push(`demoNow ${P.demoNow} is not on demoDate ${P.demoDate}`);
    if (P.balancePence <= 0) errs.push("balancePence should be positive for the demo");
    for (const inc of P.incomes) if (inc.nextDate < P.demoDate) errs.push(`income ${inc.id} nextDate ${inc.nextDate} is before demoDate`);
    const ids = new Set<string>();
    for (const x of [...P.incomes, ...P.outgoings, ...P.rules]) { if (ids.has(x.id)) errs.push(`duplicate id ${x.id}`); ids.add(x.id); }
  });

  check("timeline: starts on demoDate at the balance, one point per day, no gaps", (errs) => {
    if (timeline[0].date !== P.demoDate) errs.push(`first point is ${timeline[0].date}, expected ${P.demoDate}`);
    if (timeline[0].projectedPence !== P.balancePence) errs.push(`first point projects ${timeline[0].projectedPence}, expected balance ${P.balancePence}`);
    for (let i = 1; i < timeline.length; i++) {
      const gap = (Date.parse(timeline[i].date) - Date.parse(timeline[i - 1].date)) / DAY;
      if (gap !== 1) errs.push(`gap of ${gap} days between ${timeline[i - 1].date} and ${timeline[i].date}`);
      const delta = timeline[i].events.reduce((s: number, e: any) => s + (e.type === "income" ? e.amountPence : -e.amountPence), 0);
      if (timeline[i].projectedPence !== timeline[i - 1].projectedPence + delta) errs.push(`${timeline[i].date}: projectedPence does not follow from the previous day plus its events`);
    }
    if (timeline.length < 60) errs.push(`expected at least 60 points, got ${timeline.length}`);
  });

  check("timeline: every persona bill and income appears on the right days", (errs) => {
    const byDate = new Map(timeline.map((p) => [p.date, p]));
    for (const p of timeline) {
      if (p.date === P.demoDate) continue;
      const dom = Number(p.date.slice(8, 10));
      for (const o of P.outgoings) if (o.dayOfMonth === dom && !p.events.some((e: any) => e.type === "bill" && e.name === o.name && e.amountPence === o.amountPence)) errs.push(`${p.date}: missing bill ${o.name}`);
    }
    for (const inc of P.incomes) {
      const point = byDate.get(inc.nextDate);
      if (point && !point.events.some((e: any) => e.type === "income" && e.name === inc.name)) errs.push(`${inc.nextDate}: missing income ${inc.name}`);
    }
  });

  check("purchases: ids unique, feedbackAt after purchasedAt, feedback fields consistent, nothing after demoNow", (errs) => {
    const ids = new Set<string>();
    for (const p of purchases) {
      if (ids.has(p.id)) errs.push(`duplicate id ${p.id}`); ids.add(p.id);
      if (Date.parse(p.purchasedAt) > demoNowMs) errs.push(`${p.id} purchased after demoNow`);
      if (Date.parse(p.purchasedAt) < demoNowMs - 90 * DAY) errs.push(`${p.id} is older than 90 days`);
      if (p.feedback !== null) {
        if (!p.feedbackAt) errs.push(`${p.id} has feedback but no feedbackAt`);
        else if (Date.parse(p.feedbackAt) <= Date.parse(p.purchasedAt)) errs.push(`${p.id} feedbackAt is not after purchasedAt`);
      } else if (p.feedbackAt || p.feedbackReason) errs.push(`${p.id} has feedbackAt/feedbackReason without feedback`);
      if (p.assessmentId && !history.some((h) => h.id === p.assessmentId)) errs.push(`${p.id} points at unknown assessment ${p.assessmentId}`);
    }
  });

  check("purchases: the patterns the demo depends on are present", (errs) => {
    const reviewed = (cat: string) => purchases.filter((p) => p.category === cat && p.feedback !== null);
    const regretted = (list: any[]) => list.filter((p) => p.feedback === "regretted").length;
    const clothes = reviewed("clothes"), acc = reviewed("accessories"), books = reviewed("books");
    if (clothes.length < 5 || regretted(clothes) < 3) errs.push(`clothes: want 5 reviewed with 3 regretted, got ${clothes.length}/${regretted(clothes)}`);
    if (acc.length < 4 || regretted(acc) < 3) errs.push(`accessories: want 4 reviewed with 3 regretted, got ${acc.length}/${regretted(acc)}`);
    if (books.length < 3 || regretted(books) > 0) errs.push(`books: want 3 reviewed and none regretted, got ${books.length}/${regretted(books)}`);
    const late = purchases.filter((p) => { const h = Number(p.purchasedAt.slice(11, 13)); return h >= 23 || h < 2; });
    if (late.length < 6 || regretted(late) < 4) errs.push(`late night: want 6 purchases with 4 regretted, got ${late.length}/${regretted(late)}`);
    const withCue = purchases.filter((p) => p.cues.length > 0);
    if (withCue.length < 8 || regretted(withCue) < 5) errs.push(`cues: want 8 purchases with 5 regretted, got ${withCue.length}/${regretted(withCue)}`);
    const cases = purchases.filter((p) => /phone case/i.test(p.item));
    if (cases.length < 2 || !cases.some((p) => p.feedback === "regretted")) errs.push("want two phone cases with the second regretted");
    if (!purchases.some((p) => /headphones/i.test(p.item) && p.purchasedAt.startsWith("2026-09") && p.feedback === "happy")) errs.push("want happy headphones bought in September");
  });

  check("scenarios: all five ids present, unique, with the variants the guide names", (errs) => {
    const ids = scenarios.map((s) => s.id);
    for (const want of ["scn_1_impulse", "scn_2_essential", "scn_3_duplicate", "scn_4_fine", "scn_5_steam"]) if (!ids.includes(want)) errs.push(`missing ${want}`);
    if (new Set(ids).size !== ids.length) errs.push("duplicate scenario ids");
    const by = (id: string) => scenarios.find((s) => s.id === id);
    if (!by("scn_1_impulse")?.variants?.reason) errs.push("scn_1_impulse needs variants.reason");
    if (!by("scn_1_impulse")?.variants?.negotiated) errs.push("scn_1_impulse needs variants.negotiated");
    if (!by("scn_2_essential")?.variants?.essentialYes) errs.push("scn_2_essential needs variants.essentialYes");
    if (!by("scn_3_duplicate")?.variants?.negotiated) errs.push("scn_3_duplicate needs variants.negotiated");
  });

  check("scenarios: request and response agree (merchant, total, items)", (errs) => {
    for (const s of scenarios) {
      const r = s.request, a = s.response;
      const sum = r.items.reduce((t: number, i: any) => t + i.pricePence * i.qty, 0) + r.deliveryPence;
      if (sum !== r.totalPence) errs.push(`${s.id}: request items + delivery = ${sum}, totalPence = ${r.totalPence}`);
      if (a.merchant !== r.merchant) errs.push(`${s.id}: response merchant differs from request`);
      if (a.totalPence !== r.totalPence) errs.push(`${s.id}: response totalPence differs from request`);
      if (a.items.length !== r.items.length) errs.push(`${s.id}: response has ${a.items.length} items, request ${r.items.length}`);
      a.items.forEach((it: any, i: number) => {
        if (it.index !== i) errs.push(`${s.id}: item ${i} has index ${it.index}`);
        if (r.items[i] && (it.name !== r.items[i].name || it.pricePence !== r.items[i].pricePence)) errs.push(`${s.id}: item ${i} differs from request`);
      });
      if (a.decision !== "none") errs.push(`${s.id}: response.decision should be none`);
      if (a.reason) errs.push(`${s.id}: response should not carry a reason`);
      if (!s.trigger.merchant || s.trigger.merchant !== r.merchant) errs.push(`${s.id}: trigger merchant differs from request`);
    }
  });

  check("every response: item risks, factor sums, negotiation indexes and variants are self-consistent", (errs) => {
    for (const [name, a] of allResponses) {
      const sum = a.items.reduce((t: number, i: any) => t + i.pricePence * i.qty, 0);
      if (sum !== a.totalPence) errs.push(`${name}: items sum to ${sum}, totalPence is ${a.totalPence}`);
      for (const it of a.items) {
        const pts = it.factors.reduce((t: number, f: any) => t + f.points, 0);
        if (it.factors.length && pts !== it.regretRisk) errs.push(`${name}: item ${it.index} factors sum to ${pts}, regretRisk is ${it.regretRisk}`);
        for (const f of it.factors) if (f.key !== "reason" && (f.points < 0 || f.points > f.max)) errs.push(`${name}: item ${it.index} factor ${f.key} points ${f.points} outside 0-${f.max}`);
        if (it.duplicateOf && !purchases.some((p) => p.id === it.duplicateOf.purchaseId)) errs.push(`${name}: duplicateOf points at unknown purchase ${it.duplicateOf.purchaseId}`);
      }
      if (a.topFactors.length > 3) errs.push(`${name}: more than three topFactors`);
      for (const n of a.negotiation) if (!a.items[n.itemIndex]) errs.push(`${name}: negotiation ${n.id} points at missing item ${n.itemIndex}`);
      if (a.impact.safeToSpendAfterPence !== a.impact.safeToSpendBeforePence - a.totalPence) errs.push(`${name}: safeToSpendAfter != before - total`);
      if (a.verdict === "strong_nudge" && a.regretRisk < 70) errs.push(`${name}: strong_nudge with risk ${a.regretRisk}`);
      if (a.verdict === "nudge" && a.items.every((i: any) => !i.essentialPrompt) && (a.regretRisk < 40 || a.regretRisk >= 70)) errs.push(`${name}: nudge with risk ${a.regretRisk}`);
      if (a.verdict === "go_ahead" && a.regretRisk >= 40) errs.push(`${name}: go_ahead with risk ${a.regretRisk}`);
      if (a.timeline[0]?.date !== P.demoDate) errs.push(`${name}: timeline should start on demoDate`);
      for (const p of a.timeline) if (p.projectedAfterPence !== p.projectedPence - a.totalPence) errs.push(`${name}: ${p.date} projectedAfterPence != projectedPence - total`);
      if (a.impact.limit) {
        const l = a.impact.limit;
        const basket = a.items.filter((i: any) => i.category === l.category).reduce((t: number, i: any) => t + i.pricePence * i.qty, 0);
        if (l.remainingAfterPence !== l.weeklyLimitPence - l.spentThisWeekPence - basket) errs.push(`${name}: limit.remainingAfterPence is off`);
        if (l.overByPence !== Math.max(0, l.spentThisWeekPence + basket - l.weeklyLimitPence)) errs.push(`${name}: limit.overByPence is off`);
      }
    }
    for (const s of scenarios) {
      const v = s.variants ?? {};
      if (v.negotiated) {
        const opt = s.response.negotiation.find((n: any) => n.id === v.negotiated.optionId);
        if (!opt) errs.push(`${s.id}: negotiated.optionId ${v.negotiated.optionId} is not a negotiation option`);
        else {
          if (v.negotiated.response.regretRisk !== opt.resultRegretRisk) errs.push(`${s.id}: negotiated variant risk ${v.negotiated.response.regretRisk} != option result ${opt.resultRegretRisk}`);
          if (v.negotiated.response.verdict !== opt.resultVerdict) errs.push(`${s.id}: negotiated variant verdict != option resultVerdict`);
          if (v.negotiated.response.impact.safeToSpendAfterPence !== opt.resultSafeToSpendAfterPence) errs.push(`${s.id}: negotiated variant safeToSpendAfter != option result`);
          if (opt.action === "drop" && v.negotiated.response.items.length !== s.response.items.length - 1) errs.push(`${s.id}: drop variant should have one item fewer`);
        }
        if (v.negotiated.response.decision !== "negotiated") errs.push(`${s.id}: negotiated variant decision should be negotiated`);
      }
      if (v.reason) {
        const r = v.reason.response;
        if (!r.reason) errs.push(`${s.id}: reason variant needs a reason block`);
        else if (r.reason.text !== v.reason.input) errs.push(`${s.id}: reason.text should equal variants.reason.input`);
        if (JSON.stringify(r.impact) !== JSON.stringify(s.response.impact)) errs.push(`${s.id}: reason variant must not change impact`);
        if (r.totalPence !== s.response.totalPence) errs.push(`${s.id}: reason variant must not change totalPence`);
      }
      if (v.essentialYes) {
        const r = v.essentialYes.response;
        if (r.verdict !== "essential_cover") errs.push(`${s.id}: essentialYes variant verdict should be essential_cover`);
        if (r.items[v.essentialYes.itemIndex]?.essential !== true) errs.push(`${s.id}: essentialYes variant item ${v.essentialYes.itemIndex} should have essential true`);
      }
    }
  });

  check("every response: impact.safeToSpendBeforePence equals the timeline's lowest point before the next income", (errs) => {
    for (const [name, a] of allResponses) {
      if (a.impact.safeToSpendBeforePence !== lowestBeforeIncome) errs.push(`${name}: ${a.impact.safeToSpendBeforePence} != ${lowestBeforeIncome}`);
      if (a.impact.nextIncome.date !== nextIncome.nextDate || a.impact.nextIncome.amountPence !== nextIncome.amountPence) errs.push(`${name}: nextIncome differs from persona`);
      const days = Math.round((Date.parse(nextIncome.nextDate) - Date.parse(P.demoDate)) / DAY);
      if (a.impact.daysToNextIncome !== days) errs.push(`${name}: daysToNextIncome ${a.impact.daysToNextIncome} != ${days}`);
      const hours = Math.round((a.totalPence / P.hourlyRatePence) * 10) / 10;
      if (Math.abs(a.impact.workingHours - hours) > 0.11) errs.push(`${name}: workingHours ${a.impact.workingHours} != ${hours}`);
    }
  });

  check("every response: impact.nextBill is the persona's next outgoing after demoDate", (errs) => {
    const today = new Date(P.demoDate + "T00:00:00Z");
    let best: any = null;
    for (const o of P.outgoings) {
      let d = new Date(Date.UTC(today.getUTCFullYear(), today.getUTCMonth(), o.dayOfMonth));
      if (d <= today) d = new Date(Date.UTC(today.getUTCFullYear(), today.getUTCMonth() + 1, o.dayOfMonth));
      const iso = d.toISOString().slice(0, 10);
      if (!best || iso < best.date) best = { name: o.name, date: iso, amountPence: o.amountPence };
    }
    for (const [name, a] of allResponses) {
      if (a.impact.nextBill.name !== best.name || a.impact.nextBill.date !== best.date || a.impact.nextBill.amountPence !== best.amountPence) errs.push(`${name}: nextBill ${JSON.stringify(a.impact.nextBill)} != ${JSON.stringify(best)}`);
      if (a.impact.nextBill.coveredAfter !== a.impact.safeToSpendAfterPence >= best.amountPence) errs.push(`${name}: nextBill.coveredAfter is wrong`);
    }
    if (homeData && (homeData.nextBill.name !== best.name || homeData.nextBill.date !== best.date)) errs.push(`home.nextBill != ${JSON.stringify(best)}`);
  });

  check("limits: limit.spentThisWeekPence equals the purchases in that category in the 7 days ending demoNow", (errs) => {
    for (const [name, a] of allResponses) {
      if (!a.impact.limit) continue;
      const l = a.impact.limit;
      const persona = P.limits.find((x: any) => x.category === l.category);
      if (!persona) errs.push(`${name}: limit category ${l.category} has no persona limit`);
      else if (persona.weeklyLimitPence !== l.weeklyLimitPence) errs.push(`${name}: weeklyLimitPence differs from persona`);
      const spent = spentThisWeek(l.category);
      if (l.spentThisWeekPence !== spent) errs.push(`${name}: spentThisWeekPence ${l.spentThisWeekPence} != ${spent}`);
    }
    for (const l of insightsData?.limits ?? []) {
      const spent = spentThisWeek(l.category);
      if (l.spentThisWeekPence !== spent) errs.push(`insights.limits ${l.category}: ${l.spentThisWeekPence} != ${spent}`);
      const persona = P.limits.find((x: any) => x.category === l.category);
      if (!persona || persona.weeklyLimitPence !== l.weeklyLimitPence) errs.push(`insights.limits ${l.category}: differs from persona`);
    }
  });

  check("calibration: every category present once; responses and insights match calibration.json", (errs) => {
    const seen = new Set<string>();
    for (const c of calibration) { if (seen.has(c.category)) errs.push(`duplicate ${c.category}`); seen.add(c.category); }
    for (const cat of CATEGORIES) if (!seen.has(cat)) errs.push(`missing ${cat}`);
    const by = (cat: string) => calibration.find((c) => c.category === cat);
    for (const [name, a] of allResponses) {
      const ref = by(a.calibration.category);
      if (!ref) errs.push(`${name}: calibration category ${a.calibration.category} missing from calibration.json`);
      else if (ref.multiplier !== a.calibration.multiplier || ref.tunedPct !== a.calibration.tunedPct) errs.push(`${name}: calibration ${JSON.stringify(a.calibration)} != ${JSON.stringify(ref)}`);
    }
    for (const c of insightsData?.calibration?.byCategory ?? []) {
      const ref = by(c.category);
      if (!ref || ref.multiplier !== c.multiplier || ref.tunedPct !== c.pct) errs.push(`insights.calibration ${c.category}: differs from calibration.json`);
    }
  });

  check("home: demoNow, balance, safe-to-spend and next income agree with persona and timeline", (errs) => {
    if (!homeData) return;
    if (homeData.demoNow !== P.demoNow) errs.push("home.demoNow != persona.demoNow");
    if (homeData.balancePence !== P.balancePence) errs.push("home.balancePence != persona.balancePence");
    if (homeData.safeToSpendPence !== lowestBeforeIncome) errs.push(`home.safeToSpendPence ${homeData.safeToSpendPence} != ${lowestBeforeIncome}`);
    if (homeData.nextIncome.date !== nextIncome.nextDate) errs.push("home.nextIncome.date != persona next income");
    if (homeData.spendScore.history.length < 8) errs.push("want 8 weeks of spend score history");
    const last = homeData.spendScore.history[homeData.spendScore.history.length - 1];
    if (last.value !== homeData.spendScore.value) errs.push("last history value != spendScore.value");
  });

  check("insights: regretByCategory, duplicates and pressure agree with purchases", (errs) => {
    if (!insightsData) return;
    for (const row of insightsData.regretByCategory) {
      const reviewed = purchases.filter((p) => p.category === row.category && p.feedback !== null);
      const regretted = reviewed.filter((p) => p.feedback === "regretted").length;
      if (reviewed.length !== row.reviewed || regretted !== row.regretted) errs.push(`${row.category}: file says ${row.regretted}/${row.reviewed}, purchases say ${regretted}/${reviewed.length}`);
      const rate = reviewed.length ? Math.round((regretted / reviewed.length) * 100) : 0;
      if (row.ratePct !== rate) errs.push(`${row.category}: ratePct ${row.ratePct} != ${rate}`);
    }
    for (const d of insightsData.duplicates) {
      for (const id of d.purchaseIds) if (!purchases.some((p) => p.id === id)) errs.push(`duplicate ${d.item} points at unknown purchase ${id}`);
      if (d.count !== d.purchaseIds.length) errs.push(`duplicate ${d.item}: count ${d.count} != ${d.purchaseIds.length} ids`);
    }
    const withCue = purchases.filter((p) => p.cues.length && p.feedback !== null);
    const without = purchases.filter((p) => !p.cues.length && p.feedback !== null);
    const rate = (l: any[]) => (l.length ? Math.round((l.filter((p) => p.feedback === "regretted").length / l.length) * 100) : 0);
    if (insightsData.pressure.withCueRatePct !== rate(withCue)) errs.push(`pressure.withCueRatePct ${insightsData.pressure.withCueRatePct} != ${rate(withCue)}`);
    if (insightsData.pressure.withoutCueRatePct !== rate(without)) errs.push(`pressure.withoutCueRatePct ${insightsData.pressure.withoutCueRatePct} != ${rate(without)}`);
  });

  check("history and waiting: ids unique, scn_3 basket absent, waiting items point at history", (errs) => {
    const ids = new Set<string>();
    for (const h of history) { if (ids.has(h.id)) errs.push(`duplicate history id ${h.id}`); ids.add(h.id); if (Date.parse(h.createdAt) > demoNowMs) errs.push(`${h.id} is after demoNow`); }
    const s3 = scenarios.find((s) => s.id === "scn_3_duplicate");
    if (s3 && history.some((h) => h.merchant === s3.request.merchant && Math.abs(h.totalPence - s3.request.totalPence) <= 1)) errs.push("history already contains the scn_3 basket; the demo buys it live");
    for (const w of waiting) {
      if (!ids.has(w.assessmentId)) errs.push(`waiting ${w.id} points at unknown assessment ${w.assessmentId}`);
      if (Date.parse(w.reconsiderAt) <= Date.parse(w.savedAt)) errs.push(`waiting ${w.id}: reconsiderAt is not after savedAt`);
    }
    const heeded = history.filter((h) => h.verdict !== "go_ahead" && (h.decision === "wait" || h.decision === "dismiss") && Date.parse(h.createdAt) > demoNowMs - 30 * DAY)
      .reduce((s, h) => s + h.totalPence, 0);
    if (insightsData && heeded !== insightsData.avoidedPence) errs.push(`insights.avoidedPence ${insightsData.avoidedPence} != heeded nudges in the last 30 days ${heeded}`);
  });
}

// ---------- print ----------
let failed = 0;
for (const r of results) {
  const ok = r.errors.length === 0;
  if (!ok) failed++;
  console.log(`${ok ? "PASS" : "FAIL"}  ${r.name}`);
  for (const e of r.errors.slice(0, 25)) console.log(`        - ${e}`);
  if (r.errors.length > 25) console.log(`        ... and ${r.errors.length - 25} more`);
}
console.log(`\n${results.length - failed}/${results.length} checks passed (data: ${DATA})`);
process.exit(failed ? 1 : 0);
