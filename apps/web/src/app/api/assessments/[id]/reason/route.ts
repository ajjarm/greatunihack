import { error, handle, isStr, json, readBody, uncached, type Params } from "@/lib/api";
import { judgeReasonLive } from "@/lib/brain/assess";
import { brainLive } from "@/lib/brain/mode";
import { applyReasonFallback } from "@/lib/logic";
import { getAssessment, getStore, putAssessment, scenarioOf } from "@/lib/store";
import type { Assessment } from "@/lib/types";

export async function POST(req: Request, { params }: Params<"id">) {
  await uncached();
  return handle(async () => {
    const { id } = await params;
    const current = getAssessment(id);
    if (!current) return error(`Unknown assessment: ${id}`, 404);
    const body = await readBody(req);
    if (!isStr(body.text)) return error("text is required", 400);
    const text = body.text.trim();
    if (!text) return error("text is required", 400);

    // live Brain first: Claude judges the actual words; the canned variant is only a fixture-mode shortcut
    if (brainLive()) {
      const judged = await judgeReasonLive(getStore(), current, text);
      if (judged) return json(putAssessment(judged));
    }
    const variant = scenarioOf(id)?.variants?.reason;
    if (variant && current.decision === "none" && current.items.length === variant.response.items.length) {
      const next = JSON.parse(JSON.stringify(variant.response)) as Assessment;
      next.id = current.id;
      next.createdAt = current.createdAt;
      next.decision = current.decision;
      next.reason = { ...(next.reason ?? { accepted: true, adjustment: -30, verdictText: next.headline }), text };
      return json(putAssessment(next));
    }
    return json(putAssessment(applyReasonFallback(current, text)));
  });
}
