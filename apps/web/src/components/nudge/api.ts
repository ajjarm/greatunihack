/** Client-side calls the nudge makes. Everything goes through /api (docs/INTERFACES.md section 5). */
import type { Assessment, Purchase, WaitingItem } from "@/lib/types";

async function call<T>(path: string, method: string, body?: unknown): Promise<T> {
  const res = await fetch(path, {
    method,
    cache: "no-store",
    headers: body === undefined ? undefined : { "Content-Type": "application/json" },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error((data as { error?: string }).error ?? `Request failed (${res.status})`);
  return data as T;
}

export function assessScenario(scenarioId: string) {
  return call<Assessment>("/api/assess", "POST", {
    scenarioId,
    source: "demo",
    merchant: "",
    items: [],
    deliveryPence: 0,
    totalPence: 0,
    cues: [],
    capturedAt: new Date().toISOString(),
    basketHash: "demo",
  });
}

export const getAssessment = (id: string) => call<Assessment>(`/api/assessments/${encodeURIComponent(id)}`, "GET");

export const postReason = (id: string, text: string) =>
  call<Assessment>(`/api/assessments/${encodeURIComponent(id)}/reason`, "POST", { text });

export const patchEssential = (id: string, itemIndex: number, essential: boolean) =>
  call<Assessment>(`/api/assessments/${encodeURIComponent(id)}/essential`, "PATCH", { itemIndex, essential });

export const postNegotiate = (id: string, optionId: string) =>
  call<Assessment>(`/api/assessments/${encodeURIComponent(id)}/negotiate`, "POST", { optionId });

export type DecisionIn = "wait" | "buy_anyway" | "dismiss";
export const patchDecision = (id: string, decision: DecisionIn) =>
  call<{ assessment: Assessment; waitingItem?: WaitingItem; purchase?: Purchase }>(
    `/api/assessments/${encodeURIComponent(id)}/decision`,
    "PATCH",
    { decision },
  );
