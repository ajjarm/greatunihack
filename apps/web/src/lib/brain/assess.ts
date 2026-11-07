/**
 * The live Brain: assessLive builds a full Assessment from a request (one Claude call for
 * necessity and words, code for every number), and the recompute helpers re-judge it when
 * the user answers the essential prompt, applies a negotiation option or gives a reason.
 * Every Claude call has a deadline and a pure-code fallback, so this path always answers,
 * with no API key too; fallback words are marked "(fast fallback) " in reasoning.
 */
import type { AssessRequest, Assessment, Category, Decision, NegotiationOption, ReasonVerdict } from "../types";
import { MS_MINUTE, calibrationFor, type StoreState } from "../store";
import { clamp, cueFromInput, headlineFor, newId, pounds, reasonAccepted, verdictFor } from "../logic";
import { BrainUnavailable } from "./claude";
import {
  evaluate,
  templateHeadline,
  templateReasoning,
  templateReflectionDays,
  templateSpokenLine,
  templateTopFactors,
  type Evaluation,
  type Overrides,
} from "./engine";
import { judgeBasket, type Narrative } from "./judge";
import { heuristicJudgement, type ItemJudgement } from "./necessity";
import { localMoment, nameTokens, type LocalMoment } from "./signals";
import { judgeReason, type ReasonJudgement } from "./words";

export { BrainUnavailable } from "./claude";

export type Source = "claude" | "fallback";

/** Marks reasoning written by the templates because Claude was slow, failed or had no key. */
export const FAST_FALLBACK = "(fast fallback) ";

/** The live assess path answers within this, whatever the API does. */
export const ASSESS_HARD_CAP_MS = 7500;

export interface LiveContext {
  id: string;
  createdAt: string;
  req: AssessRequest;
  now: LocalMoment;
  judgements: ItemJudgement[];
  overrides: Overrides;
  narrative?: Narrative;
  sources: { necessity: Source; narrative: Source; reason?: Source; notes: string[] };
}

// ---------- process-lifetime state (globalThis survives next dev hot reloads) ----------

const CTX_KEY = "__brainLiveContexts__";
const MEMORY_KEY = "__brainEssentialMemory__";
type G = typeof globalThis & {
  [CTX_KEY]?: Map<string, LiveContext>;
  [MEMORY_KEY]?: { category: Category; tokens: string[]; essential: boolean }[];
};

function contexts(): Map<string, LiveContext> {
  const g = globalThis as G;
  if (!g[CTX_KEY]) g[CTX_KEY] = new Map();
  return g[CTX_KEY];
}

function memory() {
  const g = globalThis as G;
  if (!g[MEMORY_KEY]) g[MEMORY_KEY] = [];
  return g[MEMORY_KEY];
}

export function liveContext(id: string): LiveContext | undefined {
  return contexts().get(id);
}

function similar(a: string[], b: string[]): boolean {
  const shared = a.filter((t) => b.includes(t)).length;
  return shared / Math.max(1, a.length, b.length) >= 0.5;
}

/** SPEC 5.2: the user's answer wins and is remembered for similar items. */
function rememberEssential(name: string, category: Category, essential: boolean): void {
  const tokens = nameTokens(name);
  const list = memory();
  const i = list.findIndex((m) => m.category === category && similar(m.tokens, tokens));
  if (i >= 0) list.splice(i, 1);
  list.unshift({ category, tokens, essential });
}

function recallEssential(name: string, category: Category): boolean | null {
  const tokens = nameTokens(name);
  return memory().find((m) => m.category === category && similar(m.tokens, tokens))?.essential ?? null;
}

/**
 * The moment the timing factor reads. A capture stamped "just now" by a real browser runs
 * on the demo clock (persona.demoNow, which is "now" everywhere else); a scripted request
 * carrying its own timestamp (the scenario fixtures) keeps it.
 */
function momentFor(req: AssessRequest, store: StoreState): LocalMoment {
  const cap = Date.parse(req.capturedAt);
  if (Number.isNaN(cap) || Math.abs(Date.now() - cap) < 10 * MS_MINUTE) return localMoment(store.persona.demoNow);
  return localMoment(req.capturedAt);
}

// ---------- building the Assessment ----------

interface Words {
  headline?: string;
  spokenLine?: string;
  reasoning?: string;
  topFactors?: Assessment["topFactors"];
}

function build(store: StoreState, ctx: LiveContext, e: Evaluation, words: Words, decision: Decision, reason?: ReasonVerdict): Assessment {
  const req = ctx.req;
  const template = templateHeadline(store, e);
  const claudeHeadlineAllowed = (e.verdict === "nudge" || e.verdict === "strong_nudge") && !(e.pendingPrompt && e.regretRisk < 40);
  const headline = claudeHeadlineAllowed && words.headline ? words.headline : template;
  const cueNotes = ctx.narrative?.cueNotes ?? {};
  return {
    id: ctx.id,
    createdAt: ctx.createdAt,
    source: req.source,
    merchant: req.merchant,
    ...(req.url ? { url: req.url } : {}),
    totalPence: e.paidPence,
    verdict: e.verdict,
    headline,
    spokenLine: words.spokenLine ?? templateSpokenLine(e, headline),
    regretRisk: e.regretRisk,
    affordability: e.affordability,
    items: e.items.map((it) => ({
      index: it.index,
      name: it.name,
      pricePence: it.pricePence,
      qty: it.qty,
      category: it.category,
      necessity: it.necessity,
      necessityTag: it.necessityTag,
      necessityConfidence: it.necessityConfidence,
      essentialPrompt: it.essentialPrompt,
      essential: it.essential,
      regretRisk: it.regretRisk,
      factors: it.factors,
      ...(it.duplicateOf ? { duplicateOf: it.duplicateOf } : {}),
      limitedHistory: it.limitedHistory,
    })),
    impact: e.impact,
    topFactors: words.topFactors ?? templateTopFactors(e),
    cues: req.cues.map((c) => {
      const base = cueFromInput(c.key, c.text);
      return cueNotes[c.key] ? { ...base, note: cueNotes[c.key]! } : base;
    }),
    negotiation: e.negotiation,
    reflectionDays: ctx.narrative?.reflectionDays ?? templateReflectionDays(e),
    reasoning: words.reasoning ?? templateReasoning(e),
    timeline: e.timeline,
    calibration: { ...calibrationFor(e.calibrationCategory) },
    ...(reason ? { reason } : {}),
    decision,
  };
}

/** A re-judge that leaves verdict and risk where they were keeps the words already on the card. */
function keptWords(current: Assessment, e: Evaluation): Words {
  if (current.verdict !== e.verdict || current.regretRisk !== e.regretRisk) return {};
  return { headline: current.headline, spokenLine: current.spokenLine, reasoning: current.reasoning, topFactors: current.topFactors };
}

function evalCtx(store: StoreState, ctx: LiveContext): Evaluation {
  return evaluate({ store, req: ctx.req, now: ctx.now, judgements: ctx.judgements, overrides: ctx.overrides });
}

/** For nudges, the cheapest way to a yes, from the arithmetic. */
function nextStep(e: Evaluation): string {
  const opt = e.negotiation[0];
  if (!opt || (e.verdict !== "nudge" && e.verdict !== "strong_nudge")) return "";
  return ` ${opt.text} and the risk drops to ${opt.resultRegretRisk}.`;
}

function fastFallback(reasoning: string): string {
  return reasoning.startsWith(FAST_FALLBACK) ? reasoning : `${FAST_FALLBACK}${reasoning}`;
}

export interface AssessOptions {
  /** false skips Claude entirely (the hard-cap path) */
  claude?: boolean;
}

/** SPEC 5.1-5.6 for a fresh basket. Throws BrainUnavailable only if the engine itself cannot run. */
export async function assessLive(req: AssessRequest, store: StoreState, opts: AssessOptions = {}): Promise<Assessment> {
  const now = momentFor(req, store);
  const heuristic = req.items.map((it) => heuristicJudgement(store, it));
  const ctx: LiveContext = {
    id: newId("asm"),
    createdAt: store.persona.demoNow,
    req: JSON.parse(JSON.stringify(req)) as AssessRequest,
    now,
    judgements: heuristic,
    overrides: {
      essential: req.items.map((it, i) => recallEssential(it.name, heuristic[i].category)),
      dropped: [],
      delayed: [],
    },
    sources: { necessity: "fallback", narrative: "fallback", notes: [] },
  };
  const run = (): Evaluation => {
    try {
      return evalCtx(store, ctx);
    } catch (err) {
      throw new BrainUnavailable(`engine: ${err instanceof Error ? err.message : "failed"}`, err);
    }
  };

  // the heuristic evaluation is both the money facts for the prompt and the fallback card
  let e = run();
  let words: Words = {};
  if (req.items.length > 0) {
    try {
      if (opts.claude === false) throw new BrainUnavailable("judge: skipped (hard cap)");
      const j = await judgeBasket(store, req, now, heuristic, e);
      ctx.judgements = j.items;
      ctx.overrides.essential = req.items.map((it, i) => recallEssential(it.name, j.items[i].category));
      ctx.narrative = j.narrative;
      ctx.sources.necessity = "claude";
      ctx.sources.narrative = "claude";
      e = run();
      words = { headline: j.narrative.headline, reasoning: `${j.narrative.reasoning}${nextStep(e)}` };
    } catch (err) {
      if (!(err instanceof BrainUnavailable)) throw err;
      ctx.sources.notes.push(err.message);
      words = { reasoning: fastFallback(templateReasoning(e)) };
    }
  }
  if (!ctx.narrative) ctx.narrative = { headline: "", reasoning: "", reflectionDays: templateReflectionDays(e), cueNotes: {} };
  if (ctx.sources.notes.length) console.warn("[brain] fallback:", ctx.sources.notes.join("; "));
  contexts().set(ctx.id, ctx);
  return build(store, ctx, e, words, "none");
}

/**
 * assessLive under a hard cap: if the Claude path has not answered by capMs (it has its
 * own deadline, so this is the belt to its braces), answer from code instead.
 */
export async function assessLiveWithin(req: AssessRequest, store: StoreState, capMs = ASSESS_HARD_CAP_MS): Promise<Assessment> {
  let timer: ReturnType<typeof setTimeout> | undefined;
  const cap = new Promise<null>((resolve) => {
    timer = setTimeout(() => resolve(null), capMs);
  });
  const live = assessLive(req, store);
  try {
    const a = await Promise.race([live, cap]);
    if (a) return a;
  } finally {
    clearTimeout(timer);
  }
  live.catch(() => undefined);
  console.warn(`[brain] fallback: assess passed the ${capMs} ms cap`);
  return assessLive(req, store, { claude: false });
}

// ---------- re-judging a live assessment ----------

function origIndex(ctx: LiveContext, visibleIndex: number): number | undefined {
  const active = ctx.req.items.map((_, i) => i).filter((i) => !ctx.overrides.dropped.includes(i));
  return active[visibleIndex];
}

/** PATCH essential. true → necessity 95 and a cover-it headline; false → back to the original judgement. */
export function recomputeEssential(store: StoreState, current: Assessment, itemIndex: number, essential: boolean): Assessment | null {
  const ctx = liveContext(current.id);
  if (!ctx) return null;
  const orig = origIndex(ctx, itemIndex);
  if (orig === undefined) return null;
  ctx.overrides.essential[orig] = essential;
  rememberEssential(ctx.req.items[orig].name, ctx.judgements[orig].category, essential);
  const e = evalCtx(store, ctx);
  const a = build(store, ctx, e, keptWords(current, e), current.decision, current.reason);
  contexts().set(ctx.id, ctx);
  return a;
}

/** POST negotiate: drop or delay the option's item and re-judge. */
export function recomputeNegotiation(store: StoreState, current: Assessment, option: NegotiationOption): Assessment | null {
  const ctx = liveContext(current.id);
  if (!ctx) return null;
  const m = /^neg_(drop|delay)_(\d+)$/.exec(option.id);
  const orig = m ? Number(m[2]) : origIndex(ctx, option.itemIndex);
  if (orig === undefined || !ctx.req.items[orig]) return null;
  if (option.action === "drop" && !ctx.overrides.dropped.includes(orig)) ctx.overrides.dropped.push(orig);
  if (option.action === "delay" && !ctx.overrides.delayed.includes(orig)) ctx.overrides.delayed.push(orig);
  const e = evalCtx(store, ctx);
  const headline =
    e.verdict === "essential_cover"
      ? undefined
      : option.action === "drop"
        ? `Better. ${pounds(e.impact.safeToSpendAfterPence)} safe after this.`
        : "Better. That one can wait.";
  return build(store, ctx, e, { headline, spokenLine: headline }, "negotiated", current.reason);
}

/** More of the SPEC 5.4 reason kinds (replacement, course, health, work, gift) than logic.ts lists. */
const MORE_REASON_WORDS = /\b(present|died|dead|lost|stolen|cracked|smashed|stopped working|replac\w*|worn out|dissertation|module|exams?|seminar|placement|university|uni|shift|job|doctor|dentist|medical|ill|sick)\b/i;

function fallbackJudgement(text: string): ReasonJudgement {
  const accepted = reasonAccepted(text) || MORE_REASON_WORDS.test(text);
  return {
    accepted,
    adjustment: accepted ? -30 : 0,
    appliesTo: [],
    verdictText: accepted ? "That changes the risk, not the money." : "Noted, but it does not change the picture.",
  };
}

function riskSentence(accepted: boolean, before: number, after: number): string {
  return accepted && after < before ? `Risk drops from ${before} to ${after}.` : `Risk stays at ${after}.`;
}

/** Fixture-created assessments (no live context): apply a judgement the way the fallback does. */
function applyJudgementToFixture(a: Assessment, text: string, j: ReasonJudgement): Assessment {
  const before = a.regretRisk;
  const applies = (index: number) => j.appliesTo.length === 0 || j.appliesTo.includes(index);
  a.items = a.items.map((it) => {
    if (!j.adjustment || !applies(it.index)) return it;
    return {
      ...it,
      regretRisk: clamp(it.regretRisk + j.adjustment, 0, 100),
      factors: [...it.factors.filter((f) => f.key !== "reason"), { key: "reason", points: j.adjustment, max: 0, text: `Your reason: ${text}` }],
    };
  });
  const weight = a.items.reduce((s, it) => s + it.pricePence * it.qty, 0);
  a.regretRisk = j.adjustment
    ? j.appliesTo.length === 0
      ? clamp(before + j.adjustment, 0, 100)
      : clamp(Math.round(a.items.reduce((s, it) => s + it.regretRisk * it.pricePence * it.qty, 0) / Math.max(1, weight)), 0, 100)
    : before;
  a.verdict = verdictFor(a.regretRisk, a.affordability, a.items);
  a.headline = headlineFor(a.verdict, a);
  a.reason = { text, accepted: j.accepted, adjustment: j.adjustment, verdictText: `${j.verdictText} ${riskSentence(j.accepted, before, a.regretRisk)}` };
  if (j.accepted) a.topFactors = [{ key: "reason" as const, text: "You gave a reason, so the want score drops" }, ...a.topFactors.filter((f) => f.key !== "reason")].slice(0, 3);
  return a;
}

/**
 * POST reason in live mode: Claude judges the reason, the engine re-derives risk and
 * verdict, money is untouched. Returns null when Claude is unavailable for a fixture-created
 * assessment, so the route keeps its existing fallback.
 */
export async function judgeReasonLive(store: StoreState, current: Assessment, text: string): Promise<Assessment | null> {
  const ctx = liveContext(current.id);
  let j: ReasonJudgement;
  let source: Source = "claude";
  try {
    j = await judgeReason(
      text,
      current.items.map((i) => ({ index: i.index, name: i.name, tag: i.necessityTag, regretRisk: i.regretRisk })),
    );
  } catch (err) {
    if (!(err instanceof BrainUnavailable)) throw err;
    console.warn("[brain] fallback:", err.message);
    if (!ctx) return null;
    j = fallbackJudgement(text);
    source = "fallback";
  }
  if (!ctx) return applyJudgementToFixture(current, text, j);

  ctx.sources.reason = source;
  const appliesTo = j.appliesTo.map((i) => origIndex(ctx, i)).filter((i): i is number => i !== undefined);
  ctx.overrides.reason = { text, accepted: j.accepted, adjustment: j.adjustment, verdictText: j.verdictText, appliesTo };
  const e = evalCtx(store, ctx);
  const reason: ReasonVerdict = {
    text,
    accepted: j.accepted,
    adjustment: j.adjustment,
    verdictText: `${j.verdictText} ${riskSentence(j.accepted, current.regretRisk, e.regretRisk)}`,
  };
  ctx.overrides.reason = { ...reason, appliesTo };
  const words = keptWords(current, e);
  if (source === "fallback") words.reasoning = fastFallback(words.reasoning ?? templateReasoning(e));
  return build(store, ctx, e, words, current.decision, reason);
}
