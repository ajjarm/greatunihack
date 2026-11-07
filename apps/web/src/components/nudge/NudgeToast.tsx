"use client";
import type { Assessment } from "@/lib/types";
import { money } from "./format";

/** verdict === "go_ahead": one green line, 72px tall, auto-closed by the parent after 3s. */
export function NudgeToast({ assessment, onClose }: { assessment: Assessment; onClose: () => void }) {
  return (
    <div className="nudge-toast flex items-center gap-3 px-4" role="status" aria-live="polite">
      <span className="nudge-toast-icon w-7 h-7 shrink-0 flex items-center justify-center text-sm" aria-hidden>
        ✓
      </span>
      <div className="flex-1 min-w-0">
        <p className="text-sm font-semibold truncate">{assessment.headline}</p>
        <p className="text-xs nudge-muted truncate">
          {money(assessment.totalPence)} at {assessment.merchant} · {assessment.regretRisk}% regret risk
        </p>
      </div>
      <button type="button" onClick={onClose} className="nudge-btn nudge-btn-ghost px-2 py-1" aria-label="Close">
        ✕
      </button>
    </div>
  );
}
