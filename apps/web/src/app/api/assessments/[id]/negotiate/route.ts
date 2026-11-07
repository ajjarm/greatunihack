import { error, handle, isStr, json, readBody, uncached, type Params } from "@/lib/api";
import { applyNegotiationFallback } from "@/lib/logic";
import { getAssessment, getStore, putAssessment, scenarioOf } from "@/lib/store";
import type { Assessment } from "@/lib/types";

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

    const variant = scenarioOf(id)?.variants?.negotiated;
    if (variant && variant.optionId === option.id && current.decision === "none") {
      const next = JSON.parse(JSON.stringify(variant.response)) as Assessment;
      next.id = current.id;
      next.createdAt = current.createdAt;
      next.decision = "negotiated";
      if (current.reason) next.reason = current.reason;
      return json(putAssessment(next));
    }
    return json(putAssessment(applyNegotiationFallback(getStore(), current, option)));
  });
}
