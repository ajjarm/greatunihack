/**
 * Deterministic signals the Brain scores from: the cash timeline, local-time windows,
 * category history, duplicate matching, rule matching, cue sensitivity and typical spend.
 * Pure functions over the store; no model calls.
 */
import { CATEGORY_LABELS, type Category, type CueKey, type Persona, type Purchase, type Rule, type TimelinePoint } from "../types";
import { MS_DAY, type StoreState } from "../store";

// ---------- local time ----------

export interface LocalMoment {
  iso: string;
  date: string; // YYYY-MM-DD, wall clock
  hour: number;
  minute: number;
  weekday: number; // 0 = Sunday
  ms: number;
}

/** Wall-clock parts straight from the ISO string, so "+01:00" stamps keep their local hour. */
export function localMoment(iso: string): LocalMoment {
  const m = /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})/.exec(iso);
  const ms = Date.parse(iso);
  if (!m) {
    const d = new Date(Number.isNaN(ms) ? 0 : ms);
    return { iso, date: d.toISOString().slice(0, 10), hour: d.getUTCHours(), minute: d.getUTCMinutes(), weekday: d.getUTCDay(), ms };
  }
  const [, y, mo, d, h, mi] = m;
  const weekday = new Date(Date.UTC(Number(y), Number(mo) - 1, Number(d))).getUTCDay();
  return { iso, date: `${y}-${mo}-${d}`, hour: Number(h), minute: Number(mi), weekday, ms };
}

export function clockText(t: LocalMoment): string {
  const h12 = t.hour % 12 === 0 ? 12 : t.hour % 12;
  const suffix = t.hour < 12 ? "am" : "pm";
  return t.minute === 0 ? `${h12}${suffix}` : `${h12}:${String(t.minute).padStart(2, "0")}${suffix}`;
}

const WEEKDAYS = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];
const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

export function weekdayName(isoDate: string): string {
  return WEEKDAYS[new Date(isoDate + "T00:00:00Z").getUTCDay()];
}

/** "2 Oct" */
export function shortDate(isoDateOrTime: string): string {
  const [y, m, d] = isoDateOrTime.slice(0, 10).split("-").map(Number);
  if (!y || !m || !d) return isoDateOrTime.slice(0, 10);
  return `${d} ${MONTHS[m - 1]}`;
}

export const catLabel = (c: Category): string => CATEGORY_LABELS[c].toLowerCase();

// ---------- cash timeline (SPEC 5.1) ----------

function addDays(isoDate: string, n: number): string {
  return new Date(Date.parse(isoDate + "T00:00:00Z") + n * MS_DAY).toISOString().slice(0, 10);
}

/** Day-by-day projection from balance, incomes and outgoings; events land on their day. */
export function projectTimeline(persona: Persona, days = 60): TimelinePoint[] {
  const points: TimelinePoint[] = [];
  let balance = persona.balancePence;
  for (let i = 0; i <= days; i++) {
    const date = addDays(persona.demoDate, i);
    const events: TimelinePoint["events"] = [];
    if (i > 0) {
      const dom = Number(date.slice(8, 10));
      for (const inc of persona.incomes) {
        const s = inc.schedule;
        let hit = false;
        if (s.type === "once") hit = s.date === date;
        else if (s.type === "monthly") hit = s.dayOfMonth === dom;
        else {
          const diff = Math.round((Date.parse(date) - Date.parse(s.nextDate || inc.nextDate)) / MS_DAY);
          hit = diff >= 0 && diff % 14 === 0;
        }
        if (hit) {
          events.push({ type: "income", name: inc.name, amountPence: inc.amountPence });
          balance += inc.amountPence;
        }
      }
      for (const o of persona.outgoings) {
        if (o.dayOfMonth === dom) {
          events.push({ type: "bill", name: o.name, amountPence: o.amountPence });
          balance -= o.amountPence;
        }
      }
    }
    points.push({ date, projectedPence: balance, events });
  }
  return points;
}

/**
 * The seeded timeline.json carries real shift amounts the persona cannot express, so it
 * is used while it still agrees with the persona; once the balance or date changes the
 * projection is rebuilt from the persona.
 */
export function baseTimeline(store: StoreState): TimelinePoint[] {
  const first = store.timeline[0];
  if (first && first.date === store.persona.demoDate && first.projectedPence === store.persona.balancePence) {
    return store.timeline.map((p) => ({ date: p.date, projectedPence: p.projectedPence, events: p.events }));
  }
  return projectTimeline(store.persona);
}

/** Previous pay dates for each income, newest first, for the "after payday" window. */
export function pastIncomeDates(persona: Persona, beforeDate: string, lookbackDays = 120): string[] {
  const out: string[] = [];
  const floor = addDays(beforeDate, -lookbackDays);
  for (const inc of persona.incomes) {
    const s = inc.schedule;
    if (s.type === "once") {
      if (s.date <= beforeDate && s.date >= floor) out.push(s.date);
    } else if (s.type === "fortnightly") {
      let d = s.nextDate || inc.nextDate;
      while (d > beforeDate) d = addDays(d, -14);
      while (d >= floor) {
        out.push(d);
        d = addDays(d, -14);
      }
    } else {
      const [y, m] = beforeDate.split("-").map(Number);
      for (let k = 0; k < 5; k++) {
        const dt = new Date(Date.UTC(y, m - 1 - k, s.dayOfMonth)).toISOString().slice(0, 10);
        if (dt <= beforeDate && dt >= floor) out.push(dt);
      }
    }
  }
  return out.sort().reverse();
}

// ---------- reviewed history ----------

export const reviewed = (p: Purchase): boolean => p.feedback === "happy" || p.feedback === "regretted";

export interface Tally {
  reviewed: number;
  regretted: number;
  regrets: Purchase[];
  happy: Purchase[];
}

export function tally(list: Purchase[]): Tally {
  const r = list.filter(reviewed);
  const regrets = r.filter((p) => p.feedback === "regretted");
  return { reviewed: r.length, regretted: regrets.length, regrets, happy: r.filter((p) => p.feedback === "happy") };
}

// ---------- risky windows ----------

export type WindowKey = "late_night" | "friday_late" | "after_payday";

export interface WindowDef {
  key: WindowKey;
  label: string;
  test: (t: LocalMoment) => boolean;
}

export function windowDefs(persona: Persona, nowDate: string): WindowDef[] {
  const paydays = pastIncomeDates(persona, nowDate);
  return [
    { key: "late_night", label: "Late at night (11pm to 4am)", test: (t) => t.hour >= 23 || t.hour < 4 },
    {
      key: "friday_late",
      label: "Friday after 10pm",
      test: (t) => t.weekday === 5 && t.hour >= 22,
    },
    {
      key: "after_payday",
      label: "The 48 hours after payday",
      test: (t) => paydays.some((d) => t.ms >= Date.parse(d + "T00:00:00Z") && t.ms < Date.parse(d + "T00:00:00Z") + 2 * MS_DAY),
    },
  ];
}

export interface WindowHit {
  def: WindowDef;
  all: Tally;
  inCategory: Tally;
}

/** Windows the moment falls in that the user's own reviews mark as risky (3+ reviews, 50%+ regretted). */
export function riskyWindowsNow(store: StoreState, now: LocalMoment, category: Category): WindowHit[] {
  const hits: WindowHit[] = [];
  for (const def of windowDefs(store.persona, now.date)) {
    if (!def.test(now)) continue;
    const inWindow = store.purchases.filter((p) => Date.parse(p.purchasedAt) < now.ms && def.test(localMoment(p.purchasedAt)));
    const all = tally(inWindow);
    if (all.reviewed < 3 || all.regretted / all.reviewed < 0.5) continue;
    hits.push({ def, all, inCategory: tally(inWindow.filter((p) => p.category === category)) });
  }
  return hits;
}

// ---------- cue sensitivity ----------

export function cueTally(store: StoreState, key: CueKey): Tally {
  return tally(store.purchases.filter((p) => p.cues.includes(key)));
}

// ---------- typical spend ----------

export function typicalSpend(store: StoreState, category: Category): number | null {
  const amounts = store.purchases.filter((p) => p.category === category).map((p) => p.amountPence).sort((a, b) => a - b);
  if (amounts.length === 0) return null;
  const mid = Math.floor(amounts.length / 2);
  return amounts.length % 2 ? amounts[mid] : Math.round((amounts[mid - 1] + amounts[mid]) / 2);
}

// ---------- names, duplicates and rules ----------

const STOP = new Set([
  "a", "an", "the", "and", "or", "of", "for", "with", "in", "on", "to", "by", "my", "your", "pack", "set", "new",
  "black", "white", "grey", "gray", "navy", "blue", "red", "green", "pink", "beige", "brown", "clear", "mens", "womens",
  "men", "women", "size", "small", "medium", "large", "xl", "uk", "edition", "week", "x",
]);

export function nameTokens(name: string): string[] {
  return name
    .toLowerCase()
    .replace(/[^a-z0-9\s-]/g, " ")
    .split(/[\s-]+/)
    .filter((t) => t.length > 1 && !STOP.has(t) && !/\d/.test(t))
    .map((t) => (t.length > 3 && t.endsWith("s") && !t.endsWith("ss") ? t.slice(0, -1) : t));
}

/** Product kinds where owning one usually means you do not need another. */
const SINGLE_KINDS: Record<string, string[]> = {
  "phone case": ["phone case", "iphone case", "case"],
  headphones: ["headphone", "headset"],
  earbuds: ["earbud", "airpod", "earphone"],
  charger: ["charger", "charging"],
  smartwatch: ["smartwatch", "watch"],
  console: ["console"],
  speaker: ["speaker"],
};

function kindOf(name: string): string | null {
  const lower = name.toLowerCase();
  for (const [kind, words] of Object.entries(SINGLE_KINDS)) {
    if (words.some((w) => new RegExp(`\\b${w}`, "i").test(lower))) return kind;
  }
  return null;
}

/** Categories you rebuy as a matter of course, so a repeat is not a duplicate. */
const CONSUMABLE: Category[] = ["groceries", "eating_out", "transport", "health", "subscriptions", "books"];

export interface DuplicateMatch {
  strong: Purchase[]; // same thing again
  weak: Purchase[]; // same kind of gadget
}

export function findDuplicates(store: StoreState, name: string, category: Category, nowMs: number): DuplicateMatch {
  if (CONSUMABLE.includes(category)) return { strong: [], weak: [] };
  const tokens = nameTokens(name);
  const kind = kindOf(name);
  const since = nowMs - 180 * MS_DAY;
  const strong: Purchase[] = [];
  const weak: Purchase[] = [];
  for (const p of store.purchases) {
    const t = Date.parse(p.purchasedAt);
    if (p.category !== category || t >= nowMs || t < since) continue;
    const other = nameTokens(p.item);
    const shared = tokens.filter((x) => other.includes(x)).length;
    const overlap = shared / Math.max(1, tokens.length, other.length);
    const sameBrand = tokens[0] !== undefined && tokens[0] === other[0];
    if (overlap >= 0.5 || sameBrand) strong.push(p);
    else if (kind && kindOf(p.item) === kind) weak.push(p);
  }
  const newest = (a: Purchase, b: Purchase) => Date.parse(b.purchasedAt) - Date.parse(a.purchasedAt);
  return { strong: strong.sort(newest), weak: weak.sort(newest) };
}

const RULE_SYNONYMS: Record<string, string[]> = {
  trainer: ["trainer", "sneaker", "nike", "adidas", "air max", "dunk", "jordan", "air force", "new balance", "converse", "vans", "asics", "puma", "yeezy", "running shoe"],
  takeaway: ["takeaway", "deliveroo", "uber eats", "just eat", "pizza", "kebab", "burger", "chinese", "indian", "noodle"],
  book: ["book", "reader", "textbook", "edition", "reading"],
  course: ["course", "module", "lecture", "seminar", "reader", "textbook"],
  game: ["game", "ps5", "xbox", "switch", "steam", "nintendo"],
  clothe: ["hoodie", "shirt", "tee", "trouser", "jacket", "jeans", "dress", "coat"],
};

const RULE_STOP = new Set(["no", "not", "until", "are", "is", "be", "over", "always", "fine", "stop", "ordering", "on", "the", "a", "any", "more", "buy", "buying", "exams", "exam"]);

/** Fallback rule matching: category agrees and a rule keyword (or synonym) appears in the item name. */
export function rulesMatching(rules: Rule[], name: string, category: Category): Rule[] {
  const lower = name.toLowerCase();
  return rules.filter((r) => {
    if (r.category && r.category !== category) return false;
    const words = r.text
      .toLowerCase()
      .replace(/[^a-z\s]/g, " ")
      .split(/\s+/)
      .filter((w) => w.length > 2 && !RULE_STOP.has(w))
      .map((w) => (w.endsWith("s") ? w.slice(0, -1) : w));
    if (words.length === 0) return Boolean(r.category);
    return words.some((w) => (RULE_SYNONYMS[w] ?? [w]).some((syn) => lower.includes(syn)));
  });
}

/** "the trainers", "the hoodie": a short handle for option texts. */
export function shortNameOf(name: string): string {
  const lower = name.toLowerCase();
  const kinds: [RegExp, string][] = [
    [/air max|dunk|trainer|sneaker|jordan|air force/, "trainers"],
    [/hoodie|hoody/, "hoodie"],
    [/phone case|case\b/, "case"],
    [/headphone/, "headphones"],
    [/earbud|airpod/, "earbuds"],
    [/ps5|xbox|switch|game|silksong/, "game"],
    [/reader|textbook|\bbook\b/, "book"],
  ];
  for (const [re, s] of kinds) if (re.test(lower)) return s;
  const head = name.split(/[,:(]/)[0].trim();
  return head.split(/\s+/).slice(0, 3).join(" ").toLowerCase();
}
