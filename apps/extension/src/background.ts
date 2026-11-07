/**
 * Service worker. Three jobs:
 *  1. The "judge-now" command (Alt+Shift+N) → relay to the active tab's content script.
 *  2. "st-open" → open a dashboard URL in a new tab (asked for by the nudge iframe).
 *  3. "st-fetch" → fetch proxy for the API. Content scripts on amazon.co.uk can't call
 *     localhost directly (CORS); the worker can, thanks to host_permissions.
 */
import { getWebUrl, type FetchReply, type TabMessage, type WorkerMessage } from "./config";

chrome.commands.onCommand.addListener(async (command) => {
  if (command !== "judge-now") return;
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  if (tab?.id == null) return;
  const msg: TabMessage = { type: "st-judge-now" };
  try {
    await chrome.tabs.sendMessage(tab.id, msg);
  } catch {
    // No content script on this page (not a checkout URL or the test page). Nothing to do.
    console.info("[st] judge-now: no content script on the active tab");
  }
});

async function sameOrigin(url: string): Promise<boolean> {
  try {
    return new URL(url).origin === new URL(await getWebUrl()).origin;
  } catch {
    return false;
  }
}

async function proxyFetch(msg: Extract<WorkerMessage, { type: "st-fetch" }>): Promise<FetchReply> {
  if (!(await sameOrigin(msg.url))) return { ok: false, status: 0, error: "URL is not on WEB_URL" };
  try {
    const res = await fetch(msg.url, {
      method: msg.method ?? "GET",
      headers: msg.body !== undefined ? { "content-type": "application/json" } : undefined,
      body: msg.body !== undefined ? JSON.stringify(msg.body) : undefined,
    });
    const text = await res.text();
    let data: unknown = null;
    try {
      data = text ? JSON.parse(text) : null;
    } catch {
      data = text;
    }
    if (!res.ok) {
      const err = data && typeof data === "object" && "error" in data ? String((data as { error: unknown }).error) : `HTTP ${res.status}`;
      return { ok: false, status: res.status, error: err };
    }
    return { ok: true, status: res.status, data };
  } catch (e) {
    return { ok: false, status: 0, error: e instanceof Error ? e.message : String(e) };
  }
}

chrome.runtime.onMessage.addListener((raw: WorkerMessage, _sender, sendResponse) => {
  if (raw?.type === "st-fetch") {
    proxyFetch(raw).then(sendResponse);
    return true; // async response
  }
  if (raw?.type === "st-open") {
    sameOrigin(raw.url).then((ok) => {
      if (ok) chrome.tabs.create({ url: raw.url });
      sendResponse({ ok });
    });
    return true;
  }
  return false;
});
