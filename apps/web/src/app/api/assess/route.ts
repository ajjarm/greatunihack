import { error, handle, isInt, isStr, json, readBody, uncached } from "@/lib/api";
import { buildGenericAssessment, cloneAssessment, newId } from "@/lib/logic";
import { findScenario, getStore, putAssessment } from "@/lib/store";
import { CUE_KEYS, type AssessRequest, type BasketItem, type CueInput } from "@/lib/types";

const SOURCES = ["watcher", "extension", "manual", "shortcut", "demo"] as const;

function parseRequest(body: Record<string, unknown>): AssessRequest | string {
  const source = SOURCES.includes(body.source as (typeof SOURCES)[number]) ? (body.source as AssessRequest["source"]) : "manual";
  if (!isStr(body.merchant)) return "merchant is required";
  if (!isInt(body.totalPence) || body.totalPence < 0) return "totalPence must be a non-negative integer";
  const rawItems = Array.isArray(body.items) ? body.items : [];
  const items: BasketItem[] = [];
  for (const raw of rawItems) {
    if (!raw || typeof raw !== "object") return "items must be objects";
    const it = raw as Record<string, unknown>;
    if (!isStr(it.name)) return "each item needs a name";
    if (!isInt(it.pricePence)) return "each item needs an integer pricePence";
    items.push({
      name: it.name,
      pricePence: it.pricePence,
      qty: isInt(it.qty) && it.qty > 0 ? it.qty : 1,
      ...(isStr(it.category) ? { category: it.category as BasketItem["category"] } : {}),
    });
  }
  const cues: CueInput[] = [];
  for (const raw of Array.isArray(body.cues) ? body.cues : []) {
    if (!raw || typeof raw !== "object") continue;
    const c = raw as Record<string, unknown>;
    if ((CUE_KEYS as readonly string[]).includes(String(c.key))) {
      cues.push({ key: c.key as CueInput["key"], text: isStr(c.text) ? c.text : String(c.key) });
    }
  }
  return {
    source,
    merchant: body.merchant,
    ...(isStr(body.url) ? { url: body.url } : {}),
    items,
    deliveryPence: isInt(body.deliveryPence) ? body.deliveryPence : 0,
    totalPence: body.totalPence,
    cues,
    capturedAt: isStr(body.capturedAt) ? body.capturedAt : getStore().persona.demoNow,
    basketHash: isStr(body.basketHash) ? body.basketHash : "",
    ...(isStr(body.scenarioId) ? { scenarioId: body.scenarioId } : {}),
  };
}

export async function POST(req: Request) {
  await uncached();
  return handle(async () => {
    const body = await readBody(req);
    const store = getStore();
    const id = newId("asm");

    // 1. scenarioId wins
    if (isStr(body.scenarioId)) {
      const scenario = findScenario(body.scenarioId);
      if (!scenario) return error(`Unknown scenarioId: ${body.scenarioId}`, 404);
      const a = cloneAssessment(scenario.response, id, store.persona.demoNow);
      return json(putAssessment(a, scenario.id));
    }

    const parsed = parseRequest(body);
    if (typeof parsed === "string") return error(parsed, 400);

    // 2. exact basketHash
    const byHash = parsed.basketHash ? store.scenarios.find((s) => s.request.basketHash === parsed.basketHash) : undefined;
    // 3. merchant + totalPence within ±1 pence
    const byMerchant = store.scenarios.find(
      (s) =>
        s.request.merchant.toLowerCase() === parsed.merchant.toLowerCase() &&
        Math.abs(s.request.totalPence - parsed.totalPence) <= 1,
    );
    const match = byHash ?? byMerchant;
    if (match) {
      const a = cloneAssessment(match.response, id, store.persona.demoNow);
      return json(putAssessment(a, match.id));
    }

    // 4. generic go_ahead from the request
    return json(putAssessment(buildGenericAssessment(store, parsed, id)));
  });
}
