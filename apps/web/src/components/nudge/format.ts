import type { Verdict } from "@/lib/types";

/** £ from integer pence: whole pounds when exact, else two decimals. */
export function money(pence: number): string {
  const neg = pence < 0;
  const abs = Math.abs(Math.round(pence));
  const s = abs % 100 === 0 ? (abs / 100).toLocaleString("en-GB") : (abs / 100).toLocaleString("en-GB", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  return `${neg ? "−" : ""}£${s}`;
}

/** "Fri 13 Nov" from "YYYY-MM-DD" (or an ISO date-time), Europe/London. */
export function day(date: string, withWeekday = true): string {
  const d = date.length === 10 ? new Date(`${date}T12:00:00Z`) : new Date(date);
  return d.toLocaleDateString("en-GB", {
    timeZone: "Europe/London",
    ...(withWeekday ? { weekday: "short" } : {}),
    day: "numeric",
    month: "short",
  });
}

/** "September" or "2 Oct" style, for "you bought this in …". */
export function monthOf(date: string): string {
  return new Date(date).toLocaleDateString("en-GB", { timeZone: "Europe/London", month: "long" });
}

export type Band = "go" | "think" | "stop";
export function band(risk: number): Band {
  return risk >= 70 ? "stop" : risk >= 40 ? "think" : "go";
}
export const BAND_LABEL: Record<Band, string> = { go: "Low risk", think: "Think twice", stop: "High risk" };

export const VERDICT_LABEL: Record<Verdict, string> = {
  go_ahead: "Looks fine",
  essential_cover: "Essential",
  nudge: "Nudge",
  strong_nudge: "Strong nudge",
};

export const FACTOR_LABEL: Record<string, string> = {
  want_level: "Want level",
  history: "Your history",
  duplicate: "Duplicate",
  pressure: "Sales pressure",
  timing: "Timing",
  money_strain: "Money strain",
  reason: "Your reason",
};
