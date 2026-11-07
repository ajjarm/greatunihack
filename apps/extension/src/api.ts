/**
 * API client for the content script. On the test page (same origin as WEB_URL) it
 * fetches directly. Elsewhere (amazon.co.uk) a direct fetch to localhost is blocked by
 * CORS, so it goes through the service worker proxy first and falls back to a direct
 * fetch only if the proxy itself fails.
 */
import { getWebUrl, type FetchReply, type WorkerMessage } from "./config";

async function direct<T>(url: string, method: string, body?: unknown): Promise<T> {
  const res = await fetch(url, {
    method,
    headers: body !== undefined ? { "content-type": "application/json" } : undefined,
    body: body !== undefined ? JSON.stringify(body) : undefined,
  });
  const data = await res.json().catch(() => null);
  if (!res.ok) throw new Error((data && (data as { error?: string }).error) || `HTTP ${res.status}`);
  return data as T;
}

async function viaWorker<T>(url: string, method: string, body?: unknown): Promise<T> {
  const msg: WorkerMessage = { type: "st-fetch", url, method, body };
  const reply = (await chrome.runtime.sendMessage(msg)) as FetchReply | undefined;
  if (!reply) throw new Error("no reply from service worker");
  if (!reply.ok) {
    const e = new Error(reply.error) as Error & { status?: number };
    e.status = reply.status;
    throw e;
  }
  return reply.data as T;
}

export async function api<T>(path: string, method = "GET", body?: unknown): Promise<T> {
  const base = await getWebUrl();
  const url = `${base}${path}`;
  if (location.origin === new URL(base).origin) {
    try {
      return await direct<T>(url, method, body);
    } catch (e) {
      console.warn("[st] direct fetch failed, trying the service worker", e);
      return viaWorker<T>(url, method, body);
    }
  }
  try {
    return await viaWorker<T>(url, method, body);
  } catch (e) {
    // An HTTP error from the API is a real answer; only retry when the proxy itself failed.
    if ((e as { status?: number }).status) throw e;
    console.warn("[st] service worker fetch failed, trying direct", e);
    return direct<T>(url, method, body);
  }
}
