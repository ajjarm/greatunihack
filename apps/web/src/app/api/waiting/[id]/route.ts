import { error, handle, json, readBody, uncached, type Params } from "@/lib/api";
import { newId } from "@/lib/logic";
import { MS_HOUR, MS_MINUTE, demoNowMs, fastTimers, findWaiting, getAssessment, getStore, toIso } from "@/lib/store";
import type { Purchase } from "@/lib/types";

const DECISIONS = ["buy", "wait", "remove"] as const;

export async function PATCH(req: Request, { params }: Params<"id">) {
  await uncached();
  return handle(async () => {
    const { id } = await params;
    const item = findWaiting(id);
    if (!item) return error(`Unknown waiting item: ${id}`, 404);
    const body = await readBody(req);
    const decision = body.decision as (typeof DECISIONS)[number];
    if (!DECISIONS.includes(decision)) return error("decision must be buy, wait or remove", 400);

    const store = getStore();
    const now = demoNowMs(store);
    if (decision === "buy") {
      item.status = "bought";
      const source = getAssessment(item.assessmentId);
      const assessed = source?.items.find((i) => i.name === item.itemName);
      const purchase: Purchase = {
        id: newId("pur"),
        merchant: item.merchant,
        item: item.itemName,
        category: assessed?.category ?? "other",
        amountPence: item.pricePence,
        purchasedAt: toIso(now),
        source: "manual",
        essential: assessed?.essential === true,
        cues: [],
        ...(assessed ? { predictedRegret: assessed.regretRisk } : {}),
        assessmentId: item.assessmentId,
        feedback: null,
        reflectionDueAt: toIso(now + (fastTimers() ? 60_000 : (source?.reflectionDays ?? 7) * 24 * MS_HOUR)),
      };
      store.purchases.unshift(purchase);
    } else if (decision === "wait") {
      item.status = "extended";
      item.reconsiderAt = toIso(Math.max(now, Date.parse(item.reconsiderAt)) + (fastTimers() ? 2 * MS_MINUTE : 24 * MS_HOUR));
    } else {
      item.status = "removed";
    }
    return json(item);
  });
}
