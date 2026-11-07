import { Suspense } from "react";
import { NudgeClient } from "@/components/nudge/NudgeClient";

export const metadata = { title: "Nudge" };

/**
 * /nudge?assessmentId=<id>  renders a stored assessment.
 * /nudge?scenario=<id>      creates one from a fixture first (dev and demo).
 * Injected by the extension as a 400px iframe; also works in a plain tab.
 */
export default function NudgePage() {
  return (
    <main className="w-full max-w-[400px] mx-auto">
      <Suspense fallback={null}>
        <NudgeClient />
      </Suspense>
    </main>
  );
}
