// Settings shared by the content script, service worker and popup (chrome.storage.local).

export const DEFAULT_WEB_URL = "http://localhost:3000";

export function normaliseWebUrl(raw: string | undefined | null): string {
  const v = (raw ?? "").trim().replace(/\/+$/, "");
  if (!/^https?:\/\/[^/]+/i.test(v)) return DEFAULT_WEB_URL;
  return v;
}

export async function getWebUrl(): Promise<string> {
  try {
    const { webUrl } = await chrome.storage.local.get("webUrl");
    return normaliseWebUrl(webUrl as string | undefined);
  } catch {
    return DEFAULT_WEB_URL;
  }
}

export async function setWebUrl(raw: string): Promise<string> {
  const v = normaliseWebUrl(raw);
  await chrome.storage.local.set({ webUrl: v });
  return v;
}

export async function getPausedUntil(): Promise<number> {
  try {
    const { pausedUntil } = await chrome.storage.local.get("pausedUntil");
    return typeof pausedUntil === "number" ? pausedUntil : 0;
  } catch {
    return 0;
  }
}

export async function isPaused(): Promise<boolean> {
  return (await getPausedUntil()) > Date.now();
}

// Messages between content script / popup and the service worker.
export type WorkerMessage =
  | { type: "st-fetch"; url: string; method?: string; body?: unknown }
  | { type: "st-open"; url: string };

export type FetchReply = { ok: true; status: number; data: unknown } | { ok: false; status: number; error: string };

// Message from the service worker to the active tab's content script.
export type TabMessage = { type: "st-judge-now" } | { type: "st-added"; asin: string | null };
