import { error, handle, isInt, isStr, json, readBody, uncached } from "@/lib/api";
import { isCategory, newId } from "@/lib/logic";
import { getStore } from "@/lib/store";
import type { Purchase, TransactionIn } from "@/lib/types";

function parse(raw: unknown): TransactionIn | string {
  if (!raw || typeof raw !== "object") return "each transaction must be an object";
  const t = raw as Record<string, unknown>;
  if (!isStr(t.externalId)) return "externalId is required";
  if (!isStr(t.date) || Number.isNaN(Date.parse(t.date))) return `transaction ${t.externalId}: date must be ISO 8601`;
  if (!isStr(t.merchant)) return `transaction ${t.externalId}: merchant is required`;
  if (!isInt(t.amountPence)) return `transaction ${t.externalId}: amountPence must be an integer`;
  if (t.category !== undefined && !isCategory(t.category)) return `transaction ${t.externalId}: unknown category`;
  return {
    externalId: t.externalId,
    date: t.date,
    merchant: t.merchant,
    description: isStr(t.description) ? t.description : t.merchant,
    amountPence: t.amountPence,
    ...(isCategory(t.category) ? { category: t.category } : {}),
  };
}

export async function POST(req: Request) {
  await uncached();
  return handle(async () => {
    const body = await readBody(req);
    if (!Array.isArray(body.transactions)) return error("transactions must be an array", 400);
    const store = getStore();
    const linkedIds = new Set(store.externalIds.values());
    const touched: Purchase[] = [];
    let created = 0;

    for (const raw of body.transactions) {
      const tx = parse(raw);
      if (typeof tx === "string") return error(tx, 400);
      if (store.externalIds.has(tx.externalId)) continue;

      // a watcher "buy anyway" intent with the same merchant and amount (±1p) is the same purchase
      const intent = store.purchases.find(
        (p) =>
          p.source === "watcher" &&
          p.assessmentId &&
          !linkedIds.has(p.id) &&
          p.merchant.toLowerCase() === tx.merchant.toLowerCase() &&
          Math.abs(p.amountPence - tx.amountPence) <= 1,
      );
      if (intent) {
        store.externalIds.set(tx.externalId, intent.id);
        linkedIds.add(intent.id);
        touched.push(intent);
        continue;
      }

      const purchase: Purchase = {
        id: newId("pur"),
        merchant: tx.merchant,
        item: tx.description,
        category: tx.category ?? "other",
        amountPence: tx.amountPence,
        purchasedAt: tx.date,
        source: "feed",
        essential: false,
        cues: [],
        feedback: null,
      };
      store.purchases.unshift(purchase);
      store.externalIds.set(tx.externalId, purchase.id);
      linkedIds.add(purchase.id);
      touched.push(purchase);
      created++;
    }
    return json({ created, purchases: touched });
  });
}
