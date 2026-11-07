/**
 * Thin client over @anthropic-ai/sdk for the Brain. Every call asks for JSON through
 * structured outputs, parses it and runs a caller-supplied validator. Any failure (no key,
 * network, refusal, truncation, bad JSON, failed validation) becomes BrainUnavailable so
 * the caller can drop to its pure-code fallback. Live-path callers pass timeoutMs (and
 * optionally hedgeAfterMs) so a slow API never holds the checkout card.
 */
import Anthropic from "@anthropic-ai/sdk";

/** Judgement (necessity, words, reasons, the Spend Score). */
export const BRAIN_MODEL = "claude-sonnet-5-5";
/** For categorisation-only work; no live-path call is categorisation-only today. */
export const BRAIN_FAST_MODEL = "claude-haiku-5-5";

export class BrainUnavailable extends Error {
  constructor(message: string, readonly detail?: unknown) {
    super(message);
    this.name = "BrainUnavailable";
  }
}

const GLOBAL_KEY = "__brainClaudeClient__";
const WARM_KEY = "__brainClaudeWarmed__";
type GlobalWithClient = typeof globalThis & { [GLOBAL_KEY]?: { key: string; client: Anthropic }; [WARM_KEY]?: boolean };

function client(): Anthropic {
  const key = process.env.ANTHROPIC_API_KEY?.trim();
  if (!key) throw new BrainUnavailable("ANTHROPIC_API_KEY is not set");
  const g = globalThis as GlobalWithClient;
  if (!g[GLOBAL_KEY] || g[GLOBAL_KEY].key !== key) {
    g[GLOBAL_KEY] = { key, client: new Anthropic({ apiKey: key, maxRetries: 1, timeout: 25_000 }) };
  }
  return g[GLOBAL_KEY].client;
}

export function brainKeyPresent(): boolean {
  return Boolean(process.env.ANTHROPIC_API_KEY?.trim());
}

/**
 * Fire one tiny request so the first real assessment does not pay for the TLS handshake
 * and connection setup. Not awaited; runs once per process (the flag lives on globalThis
 * so a dev hot reload does not fire it again). Never throws.
 */
export function warmUp(): boolean {
  const g = globalThis as GlobalWithClient;
  if (g[WARM_KEY] || !brainKeyPresent()) return false;
  g[WARM_KEY] = true;
  const t0 = Date.now();
  void client()
    .messages.create(
      { model: BRAIN_MODEL, max_tokens: 1, messages: [{ role: "user", content: "ok" }], output_config: { effort: "low" } },
      { maxRetries: 0, timeout: 10_000 },
    )
    .then(() => console.info(`[brain] warm-up ${Date.now() - t0} ms`))
    .catch((e: unknown) => console.warn("[brain] warm-up failed:", e instanceof Error ? e.message : e));
  return true;
}

export interface AskJsonOptions<T> {
  /** short name used in logs and error messages */
  label: string;
  system: string;
  user: string;
  /** JSON schema for structured outputs (objects need additionalProperties: false) */
  schema: Record<string, unknown>;
  /** return the typed value, or null when the shape is wrong */
  validate: (raw: unknown) => T | null;
  maxTokens?: number;
  /** defaults to BRAIN_MODEL */
  model?: string;
  /**
   * Hard deadline for the whole call, retries and hedges included. On expiry every
   * in-flight request is aborted and BrainUnavailable is thrown. Without it the client's
   * 25 s timeout and one retry apply.
   */
  timeoutMs?: number;
  /**
   * With timeoutMs: if no answer has arrived after this many ms, send the same request
   * once more and take whichever valid answer lands first (API latency varies a lot
   * between identical requests, so this trims the slow tail).
   */
  hedgeAfterMs?: number;
}

class Deadline extends Error {}

async function attempt<T>(c: Anthropic, opts: AskJsonOptions<T>, signal?: AbortSignal): Promise<T> {
  const t0 = Date.now();
  const model = opts.model ?? BRAIN_MODEL;
  const sonnetFallbacks = model === BRAIN_MODEL ? { betas: ["server-side-fallback-2026-07-01"], fallbacks: "default" as const } : {};
  const res = await c.beta.messages.create(
    {
      model,
      max_tokens: opts.maxTokens ?? 2500,
      system: opts.system,
      messages: [{ role: "user", content: opts.user }],
      output_config: { effort: "low", format: { type: "json_schema", schema: opts.schema } },
      ...sonnetFallbacks,
    },
    signal ? { signal, maxRetries: 0, timeout: opts.timeoutMs } : undefined,
  );
  console.info(`[brain] ${opts.label}: ${model} answered in ${Date.now() - t0} ms, ${res.usage.output_tokens} output tokens`);
  if (res.stop_reason === "refusal") throw new BrainUnavailable(`${opts.label}: model declined`);
  if (res.stop_reason === "max_tokens") throw new BrainUnavailable(`${opts.label}: output truncated`);
  const text = res.content
    .map((b) => (b.type === "text" ? b.text : ""))
    .join("")
    .trim();
  if (!text) throw new BrainUnavailable(`${opts.label}: empty response`);
  let parsed: unknown;
  try {
    parsed = JSON.parse(text);
  } catch {
    throw new BrainUnavailable(`${opts.label}: response was not JSON`);
  }
  const value = opts.validate(parsed);
  if (value === null) throw new BrainUnavailable(`${opts.label}: response failed validation`);
  return value;
}

/**
 * Run attempts under one deadline: the first valid answer wins and the rest are aborted.
 * With hedgeAfterMs a second attempt starts at that point, or at once if the first fails
 * sooner (so it doubles as the retry).
 */
function raced<T>(c: Anthropic, opts: AskJsonOptions<T>, timeoutMs: number): Promise<T> {
  const controllers: AbortController[] = [];
  let hedgeTimer: ReturnType<typeof setTimeout> | undefined;
  let deadlineTimer: ReturnType<typeof setTimeout> | undefined;
  return new Promise<T>((resolve, reject) => {
    let settled = false;
    let running = 0;
    let spare = opts.hedgeAfterMs !== undefined && opts.hedgeAfterMs < timeoutMs ? 1 : 0;
    let lastError = "";
    const finish = (fn: () => void) => {
      if (settled) return;
      settled = true;
      clearTimeout(hedgeTimer);
      clearTimeout(deadlineTimer);
      controllers.forEach((ac) => ac.abort());
      fn();
    };
    const launch = () => {
      if (settled) return;
      const ac = new AbortController();
      controllers.push(ac);
      running++;
      attempt(c, opts, ac.signal).then(
        (v) => finish(() => resolve(v)),
        (e: unknown) => {
          running--;
          lastError = e instanceof Error ? e.message : String(e);
          if (spare > 0) {
            clearTimeout(hedgeTimer);
            hedge();
          } else if (running === 0) finish(() => reject(e));
        },
      );
    };
    const hedge = () => {
      if (spare <= 0) return;
      spare--;
      launch();
    };
    deadlineTimer = setTimeout(() => finish(() => reject(new Deadline(lastError))), timeoutMs);
    launch();
    if (spare > 0) hedgeTimer = setTimeout(hedge, opts.hedgeAfterMs);
  });
}

export async function askJson<T>(opts: AskJsonOptions<T>): Promise<T> {
  const t0 = Date.now();
  try {
    const c = client();
    const value = opts.timeoutMs === undefined ? await attempt(c, opts) : await raced(c, opts, opts.timeoutMs);
    return value;
  } catch (e) {
    console.warn(`[brain] ${opts.label} failed after ${Date.now() - t0} ms`);
    if (e instanceof Deadline) throw new BrainUnavailable(`${opts.label}: timed out after ${opts.timeoutMs} ms${e.message ? ` (${e.message})` : ""}`, e);
    if (e instanceof BrainUnavailable) throw e;
    if (e instanceof Anthropic.APIError) {
      throw new BrainUnavailable(`${opts.label}: API error ${e.status ?? "?"}`, e);
    }
    throw new BrainUnavailable(`${opts.label}: ${e instanceof Error ? e.message : "unknown error"}`, e);
  }
}

// ---------- small validation helpers ----------

export function obj(x: unknown): Record<string, unknown> | null {
  return x && typeof x === "object" && !Array.isArray(x) ? (x as Record<string, unknown>) : null;
}

export function str(x: unknown, maxLen = 2000): string | null {
  if (typeof x !== "string") return null;
  const t = x.trim();
  return t && t.length <= maxLen ? t : null;
}

export function int(x: unknown, lo: number, hi: number): number | null {
  if (typeof x !== "number" || Number.isNaN(x)) return null;
  return Math.min(hi, Math.max(lo, Math.round(x)));
}
