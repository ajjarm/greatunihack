import { handle, json, uncached } from "@/lib/api";
import { clamp, spentThisWeek } from "@/lib/logic";
import { getStore } from "@/lib/store";
import type { Insights } from "@/lib/types";

export async function GET() {
  await uncached();
  return handle(async () => {
    const store = getStore();
    const file = store.insights;

    // calibration: live multipliers and tuned percentages; overall drifts with the mean change since seed
    const seedById = new Map(store.calibrationSeed.map((c) => [c.category, c]));
    const drift = store.calibration.map((c) => c.tunedPct - (seedById.get(c.category)?.tunedPct ?? c.tunedPct));
    const meanDrift = drift.length ? drift.reduce((a, b) => a + b, 0) / drift.length : 0;
    const fileDelta = new Map(file.calibration.byCategory.map((c) => [c.category, c.deltaPct]));
    const listed = new Set(file.calibration.byCategory.map((c) => c.category));
    const byCategory = store.calibration
      .filter((c) => listed.has(c.category) || c.tunedPct !== seedById.get(c.category)?.tunedPct)
      .map((c) => ({
        category: c.category,
        pct: c.tunedPct,
        multiplier: c.multiplier,
        deltaPct: (fileDelta.get(c.category) ?? 0) + (c.tunedPct - (seedById.get(c.category)?.tunedPct ?? c.tunedPct)),
      }));

    const insights: Insights = {
      ...file,
      calibration: { overallPct: clamp(Math.round(file.calibration.overallPct + meanDrift), 0, 100), byCategory },
      limits: store.persona.limits.map((l) => ({
        category: l.category,
        weeklyLimitPence: l.weeklyLimitPence,
        spentThisWeekPence: spentThisWeek(store, l.category),
      })),
      timeline: file.timeline.length ? file.timeline : store.timeline,
    };
    return json(insights);
  });
}
