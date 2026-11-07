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


// ---------- 4. Network trigger: Amazon's add-to-basket request, however the button is built ----------
const ADD_URLS = [
  "*://www.amazon.co.uk/*add-to-cart*",
  "*://www.amazon.co.uk/*handle-buy-box*",
  "*://www.amazon.co.uk/cart/add-to-cart*",
  "*://www.amazon.co.uk/gp/item-dispatch*",
  "*://www.amazon.co.uk/*/sw-atc*",
  "*://www.amazon.co.uk/*smart-wagon*",
];
const ASIN_RE = /\b([A-Z0-9]{10})\b/;

function asinFromBody(body: { formData?: Record<string, unknown[]> } | undefined | null): string | null {
  const fd = body?.formData;
  if (!fd) return null;
  for (const key of Object.keys(fd)) {
    if (/asin/i.test(key)) {
      const v = fd[key]?.[0];
      if (typeof v === "string" && ASIN_RE.test(v)) return ASIN_RE.exec(v)![1];
    }
  }
  return null;
}

try {
  chrome.webRequest.onBeforeRequest.addListener(
    (details) => {
      if (details.tabId < 0) return;
      let asin = asinFromBody(details.requestBody) ?? (/[?&](?:asin|ASIN)=([A-Z0-9]{10})/.exec(details.url)?.[1] ?? null);
      void (async () => {
        if (!asin) {
          try {
            const tab = await chrome.tabs.get(details.tabId);
            const m = /\/(?:dp|gp\/product)\/([A-Z0-9]{10})/i.exec(tab.url ?? "");
            asin = m ? m[1].toUpperCase() : null;
          } catch {
            /* ignore */
          }
        }
        await chrome.storage.local.set({ addedAsin: asin, addedAt: Date.now(), addedTab: details.tabId });
        console.info("[st] add-to-basket request seen", details.url.slice(0, 80), "asin:", asin);
        const msg: TabMessage = { type: "st-added", asin };
        try {
          await chrome.tabs.sendMessage(details.tabId, msg);
        } catch {
          /* page is navigating; the content script on the next page reads storage */
        }
      })();
    },
    { urls: ADD_URLS, types: ["main_frame", "sub_frame", "xmlhttprequest", "other"] },
    ["requestBody"],
  );
} catch (e) {
  console.warn("[st] webRequest listener not available", e);
}
