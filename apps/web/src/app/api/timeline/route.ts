import { handle, json, uncached } from "@/lib/api";
import { nextBill, nextIncome, safeToSpend } from "@/lib/logic";
import { getStore } from "@/lib/store";
import type { TimelineResponse } from "@/lib/types";

export async function GET() {
  await uncached();
  return handle(async () => {
    const store = getStore();
    const res: TimelineResponse = {
      balancePence: store.persona.balancePence,
      safeToSpendPence: safeToSpend(store),
      nextIncome: nextIncome(store.persona),
      nextBill: nextBill(store.persona),
      points: store.timeline,
    };
    return json(res);
  });
}
