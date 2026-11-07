import { handle, json, uncached } from "@/lib/api";
import { warmUp } from "@/lib/brain/claude";
import { brainLive } from "@/lib/brain/mode";
import { demoNowIso } from "@/lib/store";

export async function GET(req: Request) {
  await uncached();
  return handle(async () => {
    // ?warm=1 in live mode: open the API connection in the background (once per process, not awaited)
    if (brainLive() && new URL(req.url).searchParams.get("warm") === "1") warmUp();
    return json({ ok: true, mode: brainLive() ? "live" : "fixture", demoNow: demoNowIso() });
  });
}
