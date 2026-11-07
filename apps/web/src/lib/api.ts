/**
 * Tiny helpers shared by every route handler. OWNED BY AJJAR.
 *
 * next.config.ts enables cacheComponents, which removes the `dynamic = "force-dynamic"`
 * segment config. `uncached()` calls connection() so the handler always runs at request
 * time, and every response carries Cache-Control: no-store.
 */
import { connection } from "next/server";

export async function uncached(): Promise<void> {
  await connection();
}

const NO_STORE = { "Cache-Control": "no-store, max-age=0" };

export function json(data: unknown, status = 200): Response {
  return Response.json(data, { status, headers: NO_STORE });
}

export function error(message: string, status = 400): Response {
  return Response.json({ error: message }, { status, headers: NO_STORE });
}

export class BodyError extends Error {}

/** Parse a JSON object body; throws BodyError (400) when it is missing or not an object. */
export async function readBody(req: Request): Promise<Record<string, unknown>> {
  let parsed: unknown;
  try {
    parsed = await req.json();
  } catch {
    throw new BodyError("Body must be valid JSON");
  }
  if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
    throw new BodyError("Body must be a JSON object");
  }
  return parsed as Record<string, unknown>;
}

export type Params<K extends string> = { params: Promise<Record<K, string>> };

/** Run a handler, turning BodyError into a 400 and anything else into a 500 with a message. */
export async function handle(fn: () => Promise<Response>): Promise<Response> {
  try {
    return await fn();
  } catch (e) {
    if (e instanceof BodyError) return error(e.message, 400);
    const message = e instanceof Error ? e.message : "Unknown error";
    console.error("[api]", e);
    return error(message, 500);
  }
}

export const isInt = (x: unknown): x is number => typeof x === "number" && Number.isInteger(x);
export const isStr = (x: unknown): x is string => typeof x === "string" && x.length > 0;
