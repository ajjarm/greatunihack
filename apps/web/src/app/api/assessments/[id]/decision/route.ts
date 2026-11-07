import { error, handle, json, readBody, uncached, type Params } from "@/lib/api";
import { newId } from "@/lib/logic";
import {
  MS_DAY,
  MS_HOUR,
  demoNowMs,
  fastTimers,
  getAssessment,
  getStore,
  putAssessment,
  summaryOf,
  toIso,
  upsertHistory,
} from "@/lib/store";
import type { Purchase, WaitingItem } from "@/lib/types";

const DECISIONS = ["wait", "buy_anyway", "dismiss"] as const;
type DecisionIn = (typeof DECISIONS)[number];

export async function PATCH(req: Request, { params }: Params<"id">) {
  await uncached();
  return handle(async () => {
    const { id } = await params;
    const a = getAssessment(id);
    if (!a) return error(`Unknown assessment: ${id}`, 404);
    const body = await readBody(req);
    const decision = body.decision as DecisionIn;
    if (!DECISIONS.includes(decision)) return error("decision must be wait, buy_anyway or dismiss", 400);

    const store = getStore();
    const now = demoNowMs(store);
    const fast = fastTimers();
    a.decision = decision;

    let waitingItem: WaitingItem | undefined;
    let purchase: Purchase | undefined;
    const purchases: Purchase[] = [];

    if (decision === "wait") {
      const riskiest = [...a.items].sort((x, y) => y.regretRisk - x.regretRisk)[0];
      if (riskiest) {
        waitingItem = {
          id: newId("wait"),
          assessmentId: a.id,
          itemName: riskiest.name,
          pricePence: riskiest.pricePence * riskiest.qty,
          merchant: a.merchant,
          ...(a.url ? { url: a.url } : {}),
          savedAt: toIso(now),
          reconsiderAt: toIso(now + 24 * MS_HOUR),
          status: "waiting",
        };
        store.waiting.unshift(waitingItem);
      }
    }

    if (decision === "buy_anyway") {
      const cueKeys = a.cues.map((c) => c.key);
      const reflectionDueAt = toIso(now + (fast ? 60_000 : a.reflectionDays * MS_DAY));
      for (const it of a.items) {
        const p: Purchase = {
          id: newId("pur"),
          merchant: a.merchant,
          item: it.name,
          category: it.category,
          amountPence: it.pricePence * it.qty,
          purchasedAt: toIso(now),
          source: "watcher",
          essential: it.essential === true,
          cues: cueKeys,
          predictedRegret: it.regretRisk,
          assessmentId: a.id,
          feedback: null,
          reflectionDueAt,
        };
        purchases.push(p);
      }
      store.purchases.unshift(...purchases);
      purchase = [...purchases].sort((x, y) => (y.predictedRegret ?? 0) - (x.predictedRegret ?? 0))[0];
    }

    // every decided assessment shows up in history; buy_anyway is the one the contract names
    upsertHistory(summaryOf(a));
    putAssessment(a);

    return json({
      assessment: a,
      ...(waitingItem ? { waitingItem } : {}),
      ...(purchase ? { purchase, purchases } : {}),
    });
  });
}
