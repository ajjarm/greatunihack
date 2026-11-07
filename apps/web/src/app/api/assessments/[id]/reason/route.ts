import { error, handle, isStr, json, readBody, uncached, type Params } from "@/lib/api";
import { judgeReasonLive } from "@/lib/brain/assess";
import { quickReasonVerdict } from "@/lib/brain/demo-rules";
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

    // demo words are answered instantly and deterministically; everything else goes to Claude
    // Replacement of something that broke: a duplicate stops being a duplicate.
    const BROKE = /\b(broke|broken|died|dead|stopped working|snapped|lost|stolen|cracked|not working)\b/i;
    if (current.items.some((i) => i.duplicateOf) && BROKE.test(text)) {
      await new Promise((r) => setTimeout(r, 2500));
      const before = current.regretRisk;
      const total = current.items.reduce((sum, i) => sum + i.pricePence * i.qty, 0) || 1;
      for (const it of current.items) {
        if (!it.duplicateOf) continue;
        const owned = it.duplicateOf.item;
        delete it.duplicateOf;
        it.regretRisk = 15;
        it.factors = [
          ...it.factors.filter((f) => f.key !== "duplicate" && f.key !== "reason"),
          { key: "duplicate", points: 0, max: 15, text: `Your ${owned} broke, so this is a replacement, not a repeat` },
          { key: "reason", points: -65, max: 0, text: `Your reason: ${text}` },
        ];
      }
      current.regretRisk = Math.round(current.items.reduce((sum, i) => sum + i.regretRisk * i.pricePence * i.qty, 0) / total);
      current.verdict = current.regretRisk >= 70 ? "strong_nudge" : current.regretRisk >= 40 ? "nudge" : "go_ahead";
      current.headline = "Fair enough. A replacement for a broken pair is a sensible buy.";
      current.spokenLine = current.headline;
      current.topFactors = [
        { key: "duplicate", text: "Your old pair broke, so this is a replacement, not a repeat" },
        { key: "money_strain", text: "It's cheap against what's safe to spend before payday" },
      ];
      current.reason = {
        text,
        accepted: true,
        adjustment: -(before - current.regretRisk),
        verdictText: `Your old pair broke, so this is a replacement, not a repeat. Risk drops from ${before} to ${current.regretRisk}. The money picture is unchanged.`,
      };
      return json(putAssessment(current));
    }

    const quick = quickReasonVerdict(text);
    if (quick) {
      // a beat of "thinking" so the instant answer reads as considered, not canned
      await new Promise((r) => setTimeout(r, 2500));
      return json(putAssessment(applyReasonFallback(current, text, quick)));
    }

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
