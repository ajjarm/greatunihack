/**
 * Content script: Amazon checkout pages and the local test page.
 *
 * Flow: confirm it's a checkout → parse the basket → inject the nudge iframe at once in
 * its pending ("Having a second think…") state → GET /api/scenarios and attach a
 * scenarioId when a fixture total matches (±1p) → POST /api/assess → point the iframe at
 * the assessment (or at /nudge?error=1 if that failed). One nudge per basketHash per page
 * load (in memory, so SPA re-renders don't re-judge but a reload does); a changed total
 * makes a new hash, so it judges again. Alt+Shift+N forces a re-judge. Does nothing while paused.
 */
import type { AssessRequest, Assessment, HostMessage } from "../../web/src/lib/types";
import { api } from "./api";
import { getWebUrl, isPaused, type TabMessage, type WorkerMessage } from "./config";
import { asinFromUrl, DEMO_PRODUCTS, parseCheckout, parseProductPage, toAssessRequest, type ParsedCheckout } from "./parser";

const KEY_PREFIX = "st-ext:";
const SCENARIO_IDX_KEY = `${KEY_PREFIX}scenario-idx`;
const FRAME_ID = "st-nudge-frame";
const SCRIM_ID = "st-nudge-scrim";

interface ScenarioSummary {
  id: string;
  title: string;
  merchant: string;
  totalPence: number;
}

let frame: HTMLIFrameElement | null = null;
let frameOrigin = "";
let inFlight = false;
let scenariosCache: ScenarioSummary[] | null = null;
/** basketHashes already judged on this page load (deliberately not sessionStorage). */
const seen = new Set<string>();

// ---------- session storage (per tab session) ----------

function ssGet(key: string): string | null {
  try {
    return sessionStorage.getItem(key);
  } catch {
    return null;
  }
}
function ssSet(key: string, v: string) {
  try {
    sessionStorage.setItem(key, v);
  } catch {
    /* storage blocked: we may nudge twice, which is fine */
  }
}

// ---------- API ----------

async function getScenarios(): Promise<ScenarioSummary[]> {
  if (scenariosCache) return scenariosCache;
  const list = await api<ScenarioSummary[]>("/api/scenarios");
  scenariosCache = Array.isArray(list) ? list : [];
  return scenariosCache;
}

async function assessParsed(req: AssessRequest): Promise<Assessment> {
  let body: AssessRequest = req;
  try {
    const scenarios = await getScenarios();
    const match = scenarios.find((s) => Math.abs(s.totalPence - req.totalPence) <= 1);
    if (match) body = { ...req, scenarioId: match.id };
  } catch (e) {
    console.warn("[st] could not load scenarios; assessing the parsed basket only", e);
  }
  return api<Assessment>("/api/assess", "POST", body);
}

// ---------- the nudge iframe ----------

/** Greys and blurs the whole shop page behind the card. */
function showScrim() {
  if (document.getElementById(SCRIM_ID)) return;
  const d = document.createElement("div");
  d.id = SCRIM_ID;
  const s = d.style;
  s.setProperty("position", "fixed", "important");
  s.setProperty("inset", "0", "important");
  s.setProperty("z-index", "2147483646", "important");
  s.setProperty("background", "rgba(12, 12, 14, 0.55)", "important");
  s.setProperty("backdrop-filter", "blur(6px)", "important");
  s.setProperty("-webkit-backdrop-filter", "blur(6px)", "important");
  s.setProperty("opacity", "0");
  s.setProperty("transition", "opacity 240ms ease");
  (document.body ?? document.documentElement).appendChild(d);
  requestAnimationFrame(() => d.style.setProperty("opacity", "1"));
}

function removeScrim(fade: boolean) {
  const d = document.getElementById(SCRIM_ID);
  if (!d) return;
  if (!fade) {
    d.remove();
    return;
  }
  d.style.setProperty("opacity", "0");
  setTimeout(() => d.remove(), 240);
}

function removeFrame(fade: boolean) {
  const f = frame;
  frame = null;
  removeScrim(fade);
  if (!f) return;
  if (!fade) {
    f.remove();
    return;
  }
  f.style.opacity = "0";
  setTimeout(() => f.remove(), 200);
}

/** Points the nudge iframe at `path` on WEB_URL, injecting it if it isn't on the page. */
async function showFrame(path: string) {
  const base = await getWebUrl();
  const src = `${base}${path}`;
  if (frame && frame.isConnected) {
    frame.src = src; // same window, so resize/close messages keep matching
    return;
  }
  removeFrame(false);
  document.getElementById(FRAME_ID)?.remove();

  const f = document.createElement("iframe");
  f.id = FRAME_ID;
  f.title = "Checkout money agent";
  f.src = src;
  f.setAttribute("allowtransparency", "true");
  const s = f.style;
  s.setProperty("position", "fixed", "important");
  s.setProperty("top", "16px", "important");
  s.setProperty("right", "16px", "important");
  s.setProperty("width", "400px", "important");
  s.setProperty("max-width", "calc(100vw - 32px)", "important");
  s.setProperty("height", "120px", "important");
  s.setProperty("z-index", "2147483647", "important");
  s.setProperty("border", "none", "important");
  s.setProperty("border-radius", "16px", "important");
  s.setProperty("box-shadow", "0 12px 40px rgba(20, 20, 30, 0.18), 0 2px 8px rgba(20, 20, 30, 0.1)", "important");
  s.setProperty("background", "transparent", "important");
  s.setProperty("color-scheme", "normal");
  s.setProperty("opacity", "1");
  s.setProperty("transition", "opacity 200ms ease, height 220ms cubic-bezier(0.2, 0.8, 0.2, 1)");

  frame = f;
  frameOrigin = new URL(base).origin;
  showScrim();
  (document.body ?? document.documentElement).appendChild(f);
}

window.addEventListener("message", (event: MessageEvent) => {
  const data = event.data as Partial<HostMessage> | undefined;
  if (data?.source !== "st-nudge") return;
  if (!frame || event.source !== frame.contentWindow) return;
  if (frameOrigin && event.origin !== frameOrigin) return;

  if (data.type === "resize" && typeof data.height === "number") {
    const max = window.innerHeight - 32;
    const h = Math.max(72, Math.min(max, Math.ceil(data.height)));
    frame.style.setProperty("height", `${h}px`, "important");
    // a short frame is the "looks fine" toast: no need to grey the page for that
    if (h <= 80) removeScrim(true);
    else showScrim();
  } else if (data.type === "close") {
    removeFrame(true);
  } else if (data.type === "open") {
    void openDashboard(data.path);
  }
});

async function openDashboard(path?: string) {
  const base = await getWebUrl();
  const p = path ? (path.startsWith("/") ? path : `/${path}`) : "/home";
  const msg: WorkerMessage = { type: "st-open", url: `${base}${p}` };
  try {
    await chrome.runtime.sendMessage(msg);
  } catch {
    window.open(msg.url, "_blank", "noopener");
  }
}

const pendingPath = (merchant: string, totalPence: number) =>
  `/nudge?pending=1&merchant=${encodeURIComponent(merchant || "Amazon")}&total=${Math.round(totalPence)}`;

/** Shows the thinking state straight away, then the assessment (or the error line). */
async function assessAndShow(totalPence: number, merchant: string, assess: () => Promise<Assessment>): Promise<boolean> {
  await showFrame(pendingPath(merchant, totalPence));
  try {
    const a = await assess();
    if (!a?.id) throw new Error("assessment without an id");
    await showFrame(`/nudge?assessmentId=${encodeURIComponent(a.id)}`);
    return true;
  } catch (e) {
    console.warn("[st] assess failed", e);
    await showFrame("/nudge?error=1");
    return false;
  }
}

// ---------- automatic judging ----------

// ---------- product pages: judge on "Add to Basket" / "Buy Now", not on arrival ----------

const STASH_KEY = "st-added-product";
const STASH_TTL_MS = 90_000;

function isProductPage(): boolean {
  return !!asinFromUrl(location.href);
}

function stashProduct(): ParsedCheckout | null {
  const parsed = parseProductPage(document, location.href);
  if (!parsed) return null;
  try {
    sessionStorage.setItem(STASH_KEY, JSON.stringify({ parsed, at: Date.now() }));
  } catch {
    /* storage unavailable: the same-page path still shows the card */
  }
  return parsed;
}

async function judgeProduct(parsed: ParsedCheckout): Promise<boolean> {
  const req = toAssessRequest(parsed);
  if (!req) return false;
  req.url = location.href;
  seen.add(req.basketHash);
  return assessAndShow(req.totalPence, req.merchant, () => assessParsed(req));
}

/** Amazon's "added to basket" page often reloads itself once or twice; the captured product
 *  must survive that, so it is only retired 25 s after it has actually been shown. */
const SHOWN_GRACE_MS = 25_000;

/** On a basket/checkout page: if a product was just added, judge that product first. */
async function judgeStashed(): Promise<boolean> {
  let raw: string | null = null;
  try {
    raw = sessionStorage.getItem(STASH_KEY);
  } catch {
    return false;
  }
  if (!raw) return false;
  let stash: { parsed: ParsedCheckout; at: number; shownAt?: number };
  try {
    stash = JSON.parse(raw) as { parsed: ParsedCheckout; at: number; shownAt?: number };
  } catch {
    return false;
  }
  const now = Date.now();
  const expired = now - stash.at > STASH_TTL_MS || (stash.shownAt != null && now - stash.shownAt > SHOWN_GRACE_MS);
  if (expired) {
    try {
      sessionStorage.removeItem(STASH_KEY);
    } catch {
      /* ignore */
    }
    return false;
  }
  console.info("[st] judging the product that was just added to the basket");
  const ok = await judgeProduct(stash.parsed);
  if (ok) {
    try {
      sessionStorage.setItem(STASH_KEY, JSON.stringify({ ...stash, shownAt: stash.shownAt ?? now }));
    } catch {
      /* ignore */
    }
  }
  return ok;
}

const ADD_RE = /add-to-cart|add-to-basket|addtocart|buy-now|buynow|one-click|oneclick|submit\.add|atc/i;
const ADD_TEXT_RE = /^(add to basket|add to cart|buy now|add to your basket)$/i;

function isAddToBasketControl(ev: Event): boolean {
  const path = (typeof ev.composedPath === "function" ? ev.composedPath() : []) as Element[];
  const chain = path.length ? path : [ev.target as Element];
  for (const node of chain) {
    if (!(node instanceof Element)) continue;
    const el = node as HTMLElement;
    const idName = `${el.id ?? ""} ${el.getAttribute("name") ?? ""} ${el.getAttribute("data-action") ?? ""} ${el.getAttribute("aria-labelledby") ?? ""} ${el.className ?? ""}`;
    if (ADD_RE.test(idName)) return true;
    const text = ((el as HTMLInputElement).value || el.getAttribute("aria-label") || el.textContent || "").trim();
    if (text.length < 40 && ADD_TEXT_RE.test(text)) return true;
    if (el.matches?.("#buybox, #desktop_buybox, #addToCart, form#addToCart, #buyBoxAccordion, #rightCol")) break;
  }
  return false;
}

let productJudged = false;
function onAddToBasket(source: string) {
  if (!isProductPage() || productJudged) return;
  const parsed = stashProduct();
  if (!parsed) return;
  productJudged = true;
  console.info(`[st] add-to-basket detected (${source}); the card follows to the next page or shows here`);
  // Amazon normally navigates to the "Added to basket" page, where judgeStashed() picks this up.
  // If it stays on this page (in-page confirmation), show the card here after a moment.
  setTimeout(() => {
    if (document.visibilityState !== "hidden" && isProductPage()) void judgeProduct(parsed);
  }, 1200);
}

for (const type of ["pointerdown", "click"] as const) {
  document.addEventListener(
    type,
    (ev) => {
      if (!isProductPage()) return;
      if (isAddToBasketControl(ev)) onAddToBasket(type);
    },
    true,
  );
}

// Belt and braces: Amazon's in-page "Added to basket" confirmation, or the basket count going up.
const cartCountAtLoad = parseInt(document.querySelector("#nav-cart-count")?.textContent ?? "0", 10) || 0;
function checkAddedToBasketSignals() {
  if (!isProductPage() || productJudged) return;
  const conf = document.querySelector("#attach-added-to-cart-message, #sw-atc-details-single-container, #NATC_SMART_WAGON_CONF_MSG_SUCCESS, #huc-v2-order-row-confirm-text, [data-feature-name='attachSiNoCoverage']");
  if (conf && /added to (your )?basket|added to cart/i.test(conf.textContent ?? "")) return onAddToBasket("confirmation");
  const count = parseInt(document.querySelector("#nav-cart-count")?.textContent ?? "0", 10) || 0;
  if (count > cartCountAtLoad) return onAddToBasket("basket-count");
}

async function judgeParsed(force: boolean): Promise<boolean> {
  if (isProductPage() && !force) return false; // product pages wait for the add-to-basket click
  const parsed = parseCheckout(document, location.href);
  console.info("[st] parsed page", { isCheckout: parsed.isCheckout, button: parsed.hasOrderButton, summary: parsed.hasSummary, totalPence: parsed.totalPence, items: parsed.items.length, cues: parsed.cues.map((c) => c.key) });
  if (!parsed.isCheckout) return false;
  const req = toAssessRequest(parsed);
  if (!req) return false;
  if (!force && seen.has(req.basketHash)) return true;

  // Stays seen even if assess fails: the error line asks for Alt+Shift+N rather than
  // flickering between pending and error on every DOM tick.
  seen.add(req.basketHash);
  await assessAndShow(req.totalPence, req.merchant, () => assessParsed(req));
  return true;
}

/** Hard-coded demo path: the basket page was reached FROM one of the demo product pages.
 *  document.referrer carries the product URL, so the ASIN tells us exactly what was added. */
let referrerHandled = false;
async function judgeFromReferrer(): Promise<boolean> {
  if (referrerHandled || isProductPage()) return false;
  const ref = document.referrer || "";
  const asin = asinFromUrl(ref);
  if (!asin || !DEMO_PRODUCTS[asin]) return false;
  referrerHandled = true;
  const parsed = productForAsin(asin);
  if (!parsed) return false;
  console.info("[st] basket page reached from a demo product page; judging", parsed.items[0]?.name);
  try {
    sessionStorage.setItem(STASH_KEY, JSON.stringify({ parsed, at: Date.now() }));
  } catch {
    /* ignore */
  }
  return judgeProduct(parsed);
}

async function tick() {
  if (inFlight) return;
  if (await isPaused()) return;
  if (isProductPage()) checkAddedToBasketSignals();
  inFlight = true;
  try {
    if (!isProductPage() && (await judgeStashed())) return;
    if (await judgeFromReferrer()) return;
    await judgeParsed(false);
  } finally {
    inFlight = false;
  }
}

let timer: ReturnType<typeof setTimeout> | undefined;
function schedule(ms = 700) {
  clearTimeout(timer);
  timer = setTimeout(() => void tick(), ms);
}

// ---------- Alt+Shift+N ----------

async function judgeNow() {
  if (await isPaused()) return;
  if (inFlight) return;
  inFlight = true;
  try {
    if (await judgeParsed(true)) return;
    // No basket on this page: cycle the fixture scenarios.
    const scenarios = await getScenarios();
    if (!scenarios.length) return;
    const idx = parseInt(ssGet(SCENARIO_IDX_KEY) ?? "0", 10) || 0;
    const s = scenarios[idx % scenarios.length];
    ssSet(SCENARIO_IDX_KEY, String((idx + 1) % scenarios.length));
    const req: AssessRequest = {
      scenarioId: s.id,
      source: "extension",
      merchant: s.merchant,
      items: [],
      deliveryPence: 0,
      totalPence: s.totalPence,
      cues: [],
      capturedAt: new Date().toISOString(),
      basketHash: "shortcut",
    };
    await assessAndShow(s.totalPence, s.merchant, () => api<Assessment>("/api/assess", "POST", req));
  } catch (e) {
    console.warn("[st] judge-now failed", e);
  } finally {
    inFlight = false;
  }
}

/** A product captured from the network trigger: the demo table or, failing that, the page. */
function productForAsin(asin: string | null): ParsedCheckout | null {
  const fromPage = parseProductPage(document, location.href);
  if (fromPage) return fromPage;
  if (!asin) return null;
  const known = DEMO_PRODUCTS[asin];
  if (!known) return null;
  return {
    isCheckout: true,
    hasOrderButton: true,
    hasSummary: true,
    merchant: "Amazon",
    url: location.href,
    items: [{ name: known.name, pricePence: known.pricePence, qty: 1 }],
    deliveryPence: 0,
    totalPence: known.pricePence,
    cues: [],
    basketHash: `amazon|${asin}|${known.pricePence}`,
  };
}

let networkHandled = false;
async function onNetworkAdded(asin: string | null, source: string) {
  if (networkHandled) return;
  const parsed = productForAsin(asin);
  if (!parsed) return;
  networkHandled = true;
  productJudged = true;
  console.info(`[st] add-to-basket seen on the network (${source}); judging`, parsed.items[0]?.name);
  try {
    sessionStorage.setItem(STASH_KEY, JSON.stringify({ parsed, at: Date.now() }));
  } catch {
    /* ignore */
  }
  await judgeProduct(parsed);
  try {
    await chrome.storage.local.remove(["addedAsin", "addedAt", "addedTab"]);
  } catch {
    /* ignore */
  }
}

async function checkNetworkAddedOnLoad() {
  try {
    const { addedAsin, addedAt } = await chrome.storage.local.get(["addedAsin", "addedAt"]);
    if (typeof addedAt === "number" && Date.now() - addedAt < 60_000) {
      await onNetworkAdded(typeof addedAsin === "string" ? addedAsin : null, "storage");
    }
  } catch {
    /* ignore */
  }
}

chrome.runtime.onMessage.addListener((msg: TabMessage) => {
  if (msg?.type === "st-judge-now") { console.info("[st] judge-now received"); void judgeNow(); }
  if (msg?.type === "st-added") void onNetworkAdded(msg.asin, "message");
  return false;
});

// ---------- start ----------
console.info("[st] SecondThought content script loaded on", location.href);
void checkNetworkAddedOnLoad();

// Wake the server's model client so the first real assessment isn't a cold start.
api("/api/health?warm=1").catch(() => {
  /* fire and forget */
});

const observer = new MutationObserver((records) => {
  // ignore our own iframe going in and out
  if (records.every((r) => [...r.addedNodes, ...r.removedNodes].some((n) => n === frame || (n as Element).id === FRAME_ID))) return;
  schedule();
});
observer.observe(document.documentElement, { childList: true, subtree: true, characterData: true });
schedule(300);
