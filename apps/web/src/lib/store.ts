/**
 * In-memory store seeded from data/*.json on first access. Shared contract; change via a handoff so all lanes stay consistent.
 *
 * Fixture mode: every route reads and mutates this object. It lives on globalThis so
 * `next dev` hot reloads do not reseed it on every request. Mutations last for the
 * process lifetime, which is what the demo needs. "Now" is always persona.demoNow.
 */
import fs from "node:fs";
import path from "node:path";
import type {
  Assessment,
  AssessmentSummary,
  CalibrationRef,
  Home,
  Insights,
  Persona,
  Purchase,
  Report,
  Scenario,
  TimelinePoint,
  WaitingItem,
} from "./types";

export interface StoreState {
  dataDir: string;
  persona: Persona;
  purchases: Purchase[];
  history: AssessmentSummary[];
  scenarios: Scenario[];
  home: Home;
  insights: Insights;
  timeline: TimelinePoint[];
  waiting: WaitingItem[];
  report: Report;
  calibration: CalibrationRef[];
  /** calibration as seeded, so insights can report drift */
  calibrationSeed: CalibrationRef[];
  /** assessments created this session, by id */
  assessments: Map<string, Assessment>;
  /** assessment id -> scenario id, for variant lookups */
  assessmentScenario: Map<string, string>;
  /** bank-feed externalId -> purchase id */
  externalIds: Map<string, string>;
}

const GLOBAL_KEY = "__regretStore__";
type GlobalWithStore = typeof globalThis & { [GLOBAL_KEY]?: StoreState };

/** The app runs from apps/web; data lives at the repo root. Walk up to find it. */
export function resolveDataDir(): string {
  const candidates = [path.resolve(process.cwd(), "../../data")];
  let dir = process.cwd();
  for (let i = 0; i < 6; i++) {
    candidates.push(path.join(dir, "data"));
    const parent = path.dirname(dir);
    if (parent === dir) break;
    dir = parent;
  }
  for (const c of candidates) {
    if (fs.existsSync(path.join(c, "persona.json"))) return c;
  }
  throw new Error(
    `Could not find data/persona.json. Looked in: ${candidates.join(", ")}. Run the app from apps/web.`,
  );
}

function readJson<T>(dir: string, name: string): T {
  const file = path.join(dir, name);
  return JSON.parse(fs.readFileSync(file, "utf8")) as T;
}

function seed(): StoreState {
  const dataDir = resolveDataDir();
  const calibration = readJson<CalibrationRef[]>(dataDir, "calibration.json");
  return {
    dataDir,
    persona: readJson<Persona>(dataDir, "persona.json"),
    purchases: readJson<Purchase[]>(dataDir, "purchases.json"),
    history: readJson<AssessmentSummary[]>(dataDir, "assessments-history.json"),
    scenarios: readJson<Scenario[]>(dataDir, "scenarios.json"),
    home: readJson<Home>(dataDir, "home.json"),
    insights: readJson<Insights>(dataDir, "insights.json"),
    timeline: readJson<TimelinePoint[]>(dataDir, "timeline.json"),
    waiting: readJson<WaitingItem[]>(dataDir, "waiting.json"),
    report: readJson<Report>(dataDir, "report.json"),
    calibration,
    calibrationSeed: calibration.map((c) => ({ ...c })),
    assessments: new Map(),
    assessmentScenario: new Map(),
    externalIds: new Map(),
  };
}

export function getStore(): StoreState {
  const g = globalThis as GlobalWithStore;
  if (!g[GLOBAL_KEY]) g[GLOBAL_KEY] = seed();
  return g[GLOBAL_KEY];
}

/** Throw away all mutations and reseed from disk. Not exposed as a route; handy in tests. */
export function resetStore(): StoreState {
  const g = globalThis as GlobalWithStore;
  g[GLOBAL_KEY] = seed();
  return g[GLOBAL_KEY];
}

// ---------- time helpers (demoNow is "now") ----------

export const MS_MINUTE = 60_000;
export const MS_HOUR = 3_600_000;
export const MS_DAY = 86_400_000;

export function demoNowMs(store: StoreState = getStore()): number {
  return Date.parse(store.persona.demoNow);
}

/** ISO 8601 with an explicit +00:00 offset (demo times are Europe/London in November). */
export function toIso(ms: number): string {
  return new Date(ms).toISOString().replace(/\.\d{3}Z$/, "+00:00");
}

export function isoDateOf(ms: number): string {
  return new Date(ms).toISOString().slice(0, 10);
}

export function fastTimers(): boolean {
  return process.env.DEMO_FAST_TIMERS === "1";
}

// ---------- small typed accessors ----------

export function findScenario(id: string): Scenario | undefined {
  return getStore().scenarios.find((s) => s.id === id);
}

export function getAssessment(id: string): Assessment | undefined {
  return getStore().assessments.get(id);
}

export function putAssessment(a: Assessment, scenarioId?: string): Assessment {
  const store = getStore();
  store.assessments.set(a.id, a);
  if (scenarioId) store.assessmentScenario.set(a.id, scenarioId);
  return a;
}

export function scenarioOf(assessmentId: string): Scenario | undefined {
  const sid = getStore().assessmentScenario.get(assessmentId);
  return sid ? findScenario(sid) : undefined;
}

export function findPurchase(id: string): Purchase | undefined {
  return getStore().purchases.find((p) => p.id === id);
}

export function findWaiting(id: string): WaitingItem | undefined {
  return getStore().waiting.find((w) => w.id === id);
}

export function calibrationFor(category: string): CalibrationRef {
  const store = getStore();
  const found = store.calibration.find((c) => c.category === category);
  if (found) return found;
  const fresh: CalibrationRef = { category: category as CalibrationRef["category"], multiplier: 1, tunedPct: 70 };
  store.calibration.push(fresh);
  return fresh;
}

export function summaryOf(a: Assessment, outcome?: AssessmentSummary["outcome"]): AssessmentSummary {
  return {
    id: a.id,
    createdAt: a.createdAt,
    merchant: a.merchant,
    totalPence: a.totalPence,
    verdict: a.verdict,
    regretRisk: a.regretRisk,
    headline: a.headline,
    decision: a.decision,
    outcome: outcome ?? null,
  };
}

/** Insert or replace a summary in history, keeping newest first. */
export function upsertHistory(summary: AssessmentSummary): void {
  const store = getStore();
  const i = store.history.findIndex((h) => h.id === summary.id);
  if (i >= 0) store.history[i] = summary;
  else store.history.unshift(summary);
  store.history.sort((a, b) => (a.createdAt < b.createdAt ? 1 : a.createdAt > b.createdAt ? -1 : 0));
}
