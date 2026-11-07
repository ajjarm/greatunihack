/**
 * Thin client over @anthropic-ai/sdk for the Brain. Every call asks for JSON through
 * structured outputs, parses it and runs a caller-supplied validator. Any failure (no key,
 * network, refusal, truncation, bad JSON, failed validation) becomes BrainUnavailable so
 * the caller can drop to its pure-code fallback.
 */
import Anthropic from "@anthropic-ai/sdk";

export const BRAIN_MODEL = "claude-sonnet-5-5";

export class BrainUnavailable extends Error {
  constructor(message: string, readonly detail?: unknown) {
    super(message);
    this.name = "BrainUnavailable";
  }
}

const GLOBAL_KEY = "__brainClaudeClient__";
type GlobalWithClient = typeof globalThis & { [GLOBAL_KEY]?: { key: string; client: Anthropic } };

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
}

export async function askJson<T>(opts: AskJsonOptions<T>): Promise<T> {
  const c = client();
  try {
    const res = await c.beta.messages.create({
      model: BRAIN_MODEL,
      max_tokens: opts.maxTokens ?? 2500,
      system: opts.system,
      messages: [{ role: "user", content: opts.user }],
      output_config: { effort: "low", format: { type: "json_schema", schema: opts.schema } },
      betas: ["server-side-fallback-2026-07-01"],
      fallbacks: "default",
    });
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
  } catch (e) {
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
