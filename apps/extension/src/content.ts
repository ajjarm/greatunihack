/**
 * Content script: Amazon checkout pages and the local test page.
 *
 * Flow: confirm it's a checkout → parse the basket → GET /api/scenarios and attach a
 * scenarioId when a fixture total matches (±1p) → POST /api/assess → inject the nudge
 * iframe. One nudge per basketHash per tab session (sessionStorage); a changed total
 * makes a new hash, so it judges again. Does nothing while paused.
 */
import type { AssessRequest, Assessment, HostMessage } from "../../web/src/lib/types";
import { api } from "./api";
import { getWebUrl, isPaused, type TabMessage, type WorkerMessage } from "./config";
import { parseCheckout, toAssessRequest } from "./parser";

const KEY_PREFIX = "st-ext:";
const SEEN_KEY = (hash: string) => `${KEY_PREFIX}seen:${hash}`;
const SCENARIO_IDX_KEY = `${KEY_PREFIX}scenario-idx`;
const FRAME_ID = "st-nudge-frame";

interface ScenarioSummary {
  id: string;
  title: string;
  merchant: string;
  totalPence: number;
}

let frame: HTMLIFrameElement | null = null;
let frameOrigin = "";
let inFlight = false;
let retryAfter = 0;
let scenariosCache: ScenarioSummary[] | null = null;

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
function ssDel(key: string) {
  try {
    sessionStorage.removeItem(key);
  } catch {
    /* ignore */
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

function removeFrame(fade: boolean) {
  const f = frame;
  frame = null;
  if (!f) return;
  if (!fade) {
    f.remove();
    return;
  }
  f.style.opacity = "0";
  setTimeout(() => f.remove(), 200);
}

async function showNudge(assessmentId: string) {
  const base = await getWebUrl();
  removeFrame(false);
  document.getElementById(FRAME_ID)?.remove();

  const f = document.createElement("iframe");
  f.id = FRAME_ID;
  f.title = "Checkout money agent";
  f.src = `${base}/nudge?assessmentId=${encodeURIComponent(assessmentId)}`;
  f.setAttribute("allowtransparency", "true");
  const s = f.style;
  s.setProperty("position", "fixed", "important");
  s.setProperty("top", "16px", "important");
  s.setProperty("right", "16px", "important");
  s.setProperty("width", "400px", "important");
  s.setProperty("max-width", "calc(100vw - 32px)", "important");
  s.setProperty("height", "160px", "important");
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

// ---------- automatic judging ----------

async function judgeParsed(force: boolean): Promise<boolean> {
  const parsed = parseCheckout(document, location.href);
  if (!parsed.isCheckout) return false;
  const req = toAssessRequest(parsed);
  if (!req) return false;
  if (!force && ssGet(SEEN_KEY(req.basketHash))) return true;

  ssSet(SEEN_KEY(req.basketHash), String(Date.now()));
  try {
    const a = await assessParsed(req);
    if (!a?.id) throw new Error("assessment without an id");
    await showNudge(a.id);
  } catch (e) {
    ssDel(SEEN_KEY(req.basketHash));
    retryAfter = Date.now() + 5000;
    console.warn("[st] assess failed", e);
  }
  return true;
}

async function tick() {
  if (inFlight || Date.now() < retryAfter) return;
  if (await isPaused()) return;
  inFlight = true;
  try {
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
    const a = await api<Assessment>("/api/assess", "POST", req);
    if (a?.id) await showNudge(a.id);
  } catch (e) {
    console.warn("[st] judge-now failed", e);
  } finally {
    inFlight = false;
  }
}

chrome.runtime.onMessage.addListener((msg: TabMessage) => {
  if (msg?.type === "st-judge-now") void judgeNow();
  return false;
});

// ---------- start ----------

const observer = new MutationObserver((records) => {
  // ignore our own iframe going in and out
  if (records.every((r) => [...r.addedNodes, ...r.removedNodes].some((n) => n === frame || (n as Element).id === FRAME_ID))) return;
  schedule();
});
observer.observe(document.documentElement, { childList: true, subtree: true, characterData: true });
schedule(300);
