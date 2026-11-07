/**
 * Shared types: the contract between the API (Ajjar), the nudge (Rayan), the dashboard
 * (Aarav) and the fixture data (Zack). Explained in docs/INTERFACES.md.
 * OWNED BY AJJAR. Request changes with ./scripts/ask.sh ajjar "interface: ...".
 */

export type Pence = number; // always an integer
export type ISODate = string; // "YYYY-MM-DD"
export type ISODateTime = string; // full ISO 8601 with offset

export const CATEGORIES = [
  "groceries",
  "eating_out",
  "clothes",
  "tech",
  "accessories",
  "books",
  "transport",
  "health",
  "subscriptions",
  "fun",
  "gifts",
  "household",
  "other",
] as const;
export type Category = (typeof CATEGORIES)[number];

export const CATEGORY_LABELS: Record<Category, string> = {
  groceries: "Groceries",
  eating_out: "Eating out",
  clothes: "Clothes",
  tech: "Tech",
  accessories: "Accessories",
  books: "Books",
  transport: "Transport",
  health: "Health",
  subscriptions: "Subscriptions",
  fun: "Fun",
  gifts: "Gifts",
  household: "Household",
  other: "Other",
};

export const CUE_KEYS = [
  "scarcity",
  "countdown",
  "social_proof",
  "sale",
  "free_delivery_threshold",
  "bnpl",
  "preticked_addon",
] as const;
export type CueKey = (typeof CUE_KEYS)[number];

// ---------- Persona / memory ----------

export type IncomeSchedule =
  | { type: "once"; date: ISODate }
  | { type: "monthly"; dayOfMonth: number }
  | { type: "fortnightly"; weekday: number; nextDate: ISODate };

export interface IncomeSource {
  id: string;
  name: string;
  amountPence: Pence;
  schedule: IncomeSchedule;
  nextDate: ISODate;
}

export interface FixedOutgoing {
  id: string;
  name: string;
  amountPence: Pence;
  dayOfMonth: number;
  category: Category;
}

export interface Limit {
  category: Category;
  weeklyLimitPence: Pence;
}

export interface Rule {
  id: string;
  text: string;
  category?: Category;
  direction: "avoid" | "always_fine";
  until?: string;
}

export interface Goal {
  name: string;
  targetPence: Pence;
  savedPence: Pence;
}

export interface Persona {
  name: string;
  demoDate: ISODate;
  demoNow: ISODateTime;
  hourlyRatePence: Pence;
  balancePence: Pence;
  incomes: IncomeSource[];
  outgoings: FixedOutgoing[];
  limits: Limit[];
  rules: Rule[];
  goal: Goal;
}

// ---------- Purchases ----------

export type Feedback = "happy" | "regretted" | "unsure";

export interface Purchase {
  id: string;
  merchant: string;
  item: string;
  category: Category;
  amountPence: Pence;
  purchasedAt: ISODateTime;
  source: "feed" | "watcher" | "manual";
  essential: boolean;
  cues: CueKey[];
  predictedRegret?: number;
  assessmentId?: string;
  feedback: Feedback | null;
  feedbackReason?: string;
  feedbackAt?: ISODateTime;
  reflectionDueAt?: ISODateTime;
}

// ---------- Assessment (what the nudge renders) ----------

export type AssessSource = "watcher" | "extension" | "manual" | "shortcut" | "demo";
export type Verdict = "go_ahead" | "essential_cover" | "nudge" | "strong_nudge";
export type NecessityTag = "need" | "useful" | "want";
export type Confidence = "low" | "medium" | "high";
export type FactorKey =
  | "want_level"
  | "history"
  | "duplicate"
  | "pressure"
  | "timing"
  | "money_strain"
  | "reason";
export type Decision = "none" | "wait" | "buy_anyway" | "dismiss" | "negotiated";

export interface BasketItem {
  name: string;
  pricePence: Pence;
  qty: number;
  category?: Category;
}

export interface CueInput {
  key: CueKey;
  text: string;
}

export interface AssessRequest {
  source: AssessSource;
  merchant: string;
  url?: string;
  items: BasketItem[];
  deliveryPence: Pence;
  totalPence: Pence;
  cues: CueInput[];
  capturedAt: ISODateTime;
  basketHash: string;
  scenarioId?: string;
}

export interface Factor {
  key: FactorKey;
  points: number;
  max: number;
  text: string;
  evidence?: string;
}

export interface DuplicateRef {
  purchaseId: string;
  item: string;
  purchasedAt: ISODateTime;
}

export interface AssessedItem {
  index: number;
  name: string;
  pricePence: Pence;
  qty: number;
  category: Category;
  necessity: number; // 0-100
  necessityTag: NecessityTag;
  necessityConfidence: Confidence;
  essentialPrompt: boolean; // ask "is this essential?" up front
  essential: boolean | null; // user's answer
  regretRisk: number; // 0-100
  factors: Factor[];
  duplicateOf?: DuplicateRef;
  limitedHistory: boolean;
}

export interface MoneyEvent {
  name: string;
  date: ISODate;
  amountPence: Pence;
}

export interface LimitImpact {
  category: Category;
  weeklyLimitPence: Pence;
  spentThisWeekPence: Pence;
  remainingAfterPence: Pence; // can be negative
  overByPence: Pence; // 0 when not over
}

export interface Impact {
  safeToSpendBeforePence: Pence;
  safeToSpendAfterPence: Pence;
  daysToNextIncome: number;
  nextIncome: MoneyEvent;
  nextBill: MoneyEvent & { coveredAfter: boolean };
  limit?: LimitImpact;
  workingHours: number;
  goalSharePct: number;
  overdraftUntil: ISODate | null;
}

export interface Cue {
  key: CueKey;
  text: string;
  note: string;
}

export interface NegotiationOption {
  id: string;
  action: "drop" | "delay";
  itemIndex: number;
  text: string;
  resultRegretRisk: number;
  resultSafeToSpendAfterPence: Pence;
  resultVerdict: Verdict;
  delayUntil?: ISODate;
}

export interface TimelineEvent {
  type: "income" | "bill" | "purchase";
  name: string;
  amountPence: Pence;
}

export interface TimelinePoint {
  date: ISODate;
  projectedPence: Pence;
  projectedAfterPence?: Pence; // with the current basket subtracted
  events: TimelineEvent[];
}

export interface CalibrationRef {
  category: Category;
  multiplier: number; // 0.5 - 1.5
  tunedPct: number; // 0-100
}

export interface ReasonVerdict {
  text: string;
  accepted: boolean;
  adjustment: number; // negative lowers risk
  verdictText: string;
}

export interface Assessment {
  id: string;
  createdAt: ISODateTime;
  source: AssessSource;
  merchant: string;
  url?: string;
  totalPence: Pence;
  verdict: Verdict;
  headline: string;
  spokenLine: string;
  regretRisk: number;
  affordability: number;
  items: AssessedItem[];
  impact: Impact;
  topFactors: { key: FactorKey; text: string }[];
  cues: Cue[];
  negotiation: NegotiationOption[];
  reflectionDays: number;
  reasoning: string;
  timeline: TimelinePoint[];
  calibration: CalibrationRef;
  reason?: ReasonVerdict;
  decision: Decision;
}

export interface AssessmentSummary {
  id: string;
  createdAt: ISODateTime;
  merchant: string;
  totalPence: Pence;
  verdict: Verdict;
  regretRisk: number;
  headline: string;
  decision: Decision;
  outcome?: Feedback | null;
}

// ---------- Dashboard ----------

export type Band = "green" | "amber" | "red";

export interface SpendScore {
  value: number;
  band: Band;
  trend: "up" | "flat" | "down";
  explanation: string;
  history: { weekStart: ISODate; value: number }[];
}

export interface Home {
  demoNow: ISODateTime;
  spendScore: SpendScore;
  balancePence: Pence;
  safeToSpendPence: Pence;
  daysToNextIncome: number;
  nextIncome: MoneyEvent;
  nextBill: MoneyEvent;
  insight: string;
  recentAssessments: AssessmentSummary[];
  pendingReflections: number;
}

export interface InsightSentence {
  key: string;
  text: string;
  evidence: string;
}

export interface Insights {
  sentences: InsightSentence[];
  regretByCategory: { category: Category; reviewed: number; regretted: number; ratePct: number }[];
  riskyWindows: { label: string; ratePct: number; evidence: string }[];
  pressure: { withCueRatePct: number; withoutCueRatePct: number; sentence: string };
  duplicates: { item: string; count: number; purchaseIds: string[] }[];
  avoidedPence: Pence;
  avoidedCouldBe: { label: string; text: string }[];
  calibration: {
    overallPct: number;
    byCategory: { category: Category; pct: number; multiplier: number; deltaPct: number }[];
  };
  limits: { category: Category; weeklyLimitPence: Pence; spentThisWeekPence: Pence }[];
  timeline: TimelinePoint[];
}

export interface WaitingItem {
  id: string;
  assessmentId: string;
  itemName: string;
  pricePence: Pence;
  merchant: string;
  url?: string;
  savedAt: ISODateTime;
  reconsiderAt: ISODateTime;
  status: "waiting" | "bought" | "removed" | "extended";
}

export interface Report {
  weekStart: ISODate;
  nudgesShown: number;
  heeded: number;
  overridden: number;
  overriddenHappy: number;
  overriddenRegretted: number;
  limitsKept: number;
  limitsExceeded: number;
  avoidedPence: Pence;
  spendScore: number;
  sentences: string[];
}

export interface TimelineResponse {
  balancePence: Pence;
  safeToSpendPence: Pence;
  nextIncome: MoneyEvent;
  nextBill: MoneyEvent;
  points: TimelinePoint[];
}

export interface TransactionIn {
  externalId: string;
  date: ISODateTime;
  merchant: string;
  description: string;
  amountPence: Pence;
  category?: Category;
}

// ---------- Fixtures ----------

export interface Scenario {
  id: string;
  title: string;
  trigger: { merchant: string; keywords: string[]; urlPattern?: string };
  request: AssessRequest;
  response: Assessment;
  variants?: {
    reason?: { input: string; response: Assessment };
    negotiated?: { optionId: string; response: Assessment };
    essentialYes?: { itemIndex: number; response: Assessment };
  };
}

// ---------- Electron bridge (present only inside the Watcher window) ----------

export interface WatcherBridge {
  close(): void;
  resize(height: number): void;
  openDashboard(path?: string): void;
}

declare global {
  interface Window {
    watcher?: WatcherBridge;
  }
}
