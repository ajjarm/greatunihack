import { Suspense } from "react";
import { CheckoutPreview } from "@/components/nudge/CheckoutPreview";

export const metadata = { title: "Nudge preview: checkout" };

/**
 * Dev/demo only: /nudge/preview?scenario=scn_1_impulse
 * A generic desktop checkout with the nudge injected the way the extension does it
 * (POST /api/assess, then a fixed top-right 400px iframe of /nudge?assessmentId=…).
 */
export default function NudgePreviewPage() {
  return (
    <Suspense fallback={null}>
      <CheckoutPreview />
    </Suspense>
  );
}
