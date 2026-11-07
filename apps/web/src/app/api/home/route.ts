import { handle, json, uncached } from "@/lib/api";
import { daysBetween, nextBill, nextIncome, pendingReflections, safeToSpend } from "@/lib/logic";
import { getStore, summaryOf } from "@/lib/store";
import type { AssessmentSummary, Home } from "@/lib/types";

export async function GET() {
  await uncached();
  return handle(async () => {
    const store = getStore();
    const persona = store.persona;
    const income = nextIncome(persona);

    // history plus anything created this session, newest first, deduped by id, max 6
    const byId = new Map<string, AssessmentSummary>();
    for (const h of store.history) byId.set(h.id, h);
    for (const a of store.assessments.values()) {
      const existing = byId.get(a.id);
      byId.set(a.id, { ...summaryOf(a, existing?.outcome ?? null) });
    }
    const recent = [...byId.values()]
      .sort((a, b) => (a.createdAt < b.createdAt ? 1 : a.createdAt > b.createdAt ? -1 : 0))
      .slice(0, 6);

    const home: Home = {
      ...store.home,
      demoNow: persona.demoNow,
      balancePence: persona.balancePence,
      safeToSpendPence: safeToSpend(store),
      daysToNextIncome: Math.max(0, daysBetween(persona.demoDate, income.date)),
      nextIncome: income,
      nextBill: nextBill(persona),
      recentAssessments: recent,
      pendingReflections: pendingReflections(store).length,
    };
    return json(home);
  });
}
