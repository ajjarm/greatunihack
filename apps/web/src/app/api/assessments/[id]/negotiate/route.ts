import { error, handle, isStr, json, readBody, uncached, type Params } from "@/lib/api";
import { recomputeNegotiation } from "@/lib/brain/assess";
import { brainLive } from "@/lib/brain/mode";
import { applyNegotiationFallback, newId } from "@/lib/logic";
import { MS_HOUR, demoNowMs, getAssessment, getStore, putAssessment, scenarioOf, toIso } from "@/lib/store";
import type { Assessment, NegotiationOption } from "@/lib/types";

/** A dropped or delayed item is not forgotten: it goes on the waiting list with its own countdown. */
function saveForLater(current: Assessment, option: NegotiationOption): void {
  const item = current.items.find((it) => it.index === option.itemIndex) ?? current.items[option.itemIndex];
  if (!item) return;
  const store = getStore();
  if (store.waiting.some((w) => w.assessmentId === current.id && w.itemName === item.name && w.status === "waiting")) return;
  const now = demoNowMs(store);
  const delayed = option.action === "delay" && option.delayUntil ? Date.parse(`${option.delayUntil}T09:00:00Z`) : NaN;
  store.waiting.unshift({
    id: newId("wait"),
    assessmentId: current.id,
    itemName: item.name,
    pricePence: item.pricePence * item.qty,
    merchant: current.merchant,
    ...(current.url ? { url: current.url } : {}),
    savedAt: toIso(now),
    reconsiderAt: toIso(Number.isFinite(delayed) && delayed > now ? delayed : now + 24 * MS_HOUR),
    status: "waiting",
  });
}

export async function POST(req: Request, { params }: Params<"id">) {
  await uncached();
  return handle(async () => {
    const { id } = await params;
    const current = getAssessment(id);
    if (!current) return error(`Unknown assessment: ${id}`, 404);
    const body = await readBody(req);
    if (!isStr(body.optionId)) return error("optionId is required", 400);
    const option = current.negotiation.find((n) => n.id === body.optionId);
    if (!option) return error(`Unknown optionId: ${body.optionId}`, 404);
    // snapshot before any re-judge can mutate the items
    const before = structuredClone(current);

    // live Brain: assessments it created are re-judged with the option applied
    if (brainLive()) {
      const live = recomputeNegotiation(getStore(), current, option);
      if (live) {
        saveForLater(before, option);
        return json(putAssessment(live));
      }
    }

    const variant = scenarioOf(id)?.variants?.negotiated;
    if (variant && variant.optionId === option.id && current.decision === "none") {
      const next = JSON.parse(JSON.stringify(variant.response)) as Assessment;
      next.id = current.id;
      next.createdAt = current.createdAt;
      next.decision = "negotiated";
      if (current.reason) next.reason = current.reason;
      saveForLater(before, option);
      return json(putAssessment(next));
    }
    const next = applyNegotiationFallback(getStore(), current, option);
    saveForLater(before, option);
    return json(putAssessment(next));
  });
}
