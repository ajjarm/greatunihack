import { handle, json, uncached } from "@/lib/api";
import { getStore } from "@/lib/store";

export async function GET() {
  await uncached();
  return handle(async () => json({ ok: true, mode: "fixture", demoNow: getStore().persona.demoNow }));
}
