import { handle, json, uncached } from "@/lib/api";
import { scoreLive } from "@/lib/brain/mode";
import { spendScoreLive } from "@/lib/brain/score";
import { daysBetween, nextIncome, safeToSpend } from "@/lib/logic";
import { getStore } from "@/lib/store";
import type { Report } from "@/lib/types";

export async function GET() {
  await uncached();
  // ?week=current is the only week in fixture mode
  return handle(async () => {
    const store = getStore();
    if (!scoreLive()) return json(store.report);
    const r = store.report;
    const history = store.home.spendScore.history;
    const prev = history.filter((h) => h.weekStart < r.weekStart).at(-1)?.value ?? null;
    const score = await spendScoreLive({
      weekStart: r.weekStart,
      nudgesShown: r.nudgesShown,
      heeded: r.heeded,
      overridden: r.overridden,
      overriddenHappy: r.overriddenHappy,
      overriddenRegretted: r.overriddenRegretted,
      limitsKept: r.limitsKept,
      limitsExceeded: r.limitsExceeded,
      avoidedPence: r.avoidedPence,
      safeToSpendPence: safeToSpend(store),
      daysToNextIncome: Math.max(0, daysBetween(store.persona.demoDate, nextIncome(store.persona).date)),
      previousScore: prev,
    });
    const report: Report = { ...r, spendScore: score.value };
    return json(report);
  });
}
