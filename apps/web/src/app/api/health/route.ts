import { handle, json, uncached } from "@/lib/api";
import { brainLive } from "@/lib/brain/mode";
import { getStore } from "@/lib/store";

export async function GET() {
  await uncached();
  return handle(async () => json({ ok: true, mode: brainLive() ? "live" : "fixture", demoNow: getStore().persona.demoNow }));
}
