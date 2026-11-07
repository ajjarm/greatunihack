import { error, handle, isInt, json, readBody, uncached, type Params } from "@/lib/api";
import { applyEssentialFallback } from "@/lib/logic";
import { getAssessment, putAssessment, scenarioOf } from "@/lib/store";
import type { Assessment } from "@/lib/types";

export async function PATCH(req: Request, { params }: Params<"id">) {
  await uncached();
  return handle(async () => {
    const { id } = await params;
    const current = getAssessment(id);
    if (!current) return error(`Unknown assessment: ${id}`, 404);
    const body = await readBody(req);
    if (!isInt(body.itemIndex)) return error("itemIndex must be an integer", 400);
    if (typeof body.essential !== "boolean") return error("essential must be a boolean", 400);
    const itemIndex = body.itemIndex;
    if (!current.items[itemIndex]) return error(`No item at index ${itemIndex}`, 400);

    const variant = scenarioOf(id)?.variants?.essentialYes;
    if (body.essential && variant && variant.itemIndex === itemIndex && current.decision === "none") {
      const next = JSON.parse(JSON.stringify(variant.response)) as Assessment;
      next.id = current.id;
      next.createdAt = current.createdAt;
      next.decision = current.decision;
      if (current.reason) next.reason = current.reason;
      if (next.items[itemIndex]) next.items[itemIndex].essential = true;
      return json(putAssessment(next));
    }
    return json(putAssessment(applyEssentialFallback(current, itemIndex, body.essential)));
  });
}
