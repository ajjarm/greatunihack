import { error, handle, isStr, json, readBody, uncached, type Params } from "@/lib/api";
import { applyFeedback } from "@/lib/logic";
import { findPurchase } from "@/lib/store";
import type { Feedback } from "@/lib/types";

const FEEDBACK: Feedback[] = ["happy", "regretted", "unsure"];

export async function PATCH(req: Request, { params }: Params<"id">) {
  await uncached();
  return handle(async () => {
    const { id } = await params;
    const purchase = findPurchase(id);
    if (!purchase) return error(`Unknown purchase: ${id}`, 404);
    const body = await readBody(req);
    const feedback = body.feedback as Feedback;
    if (!FEEDBACK.includes(feedback)) return error("feedback must be happy, regretted or unsure", 400);
    const reason = isStr(body.reason) ? body.reason : undefined;
    const calibration = applyFeedback(purchase, feedback, reason);
    return json({ purchase, calibration });
  });
}
