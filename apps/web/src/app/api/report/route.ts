import { handle, json, uncached } from "@/lib/api";
import { getStore } from "@/lib/store";

export async function GET() {
  await uncached();
  // ?week=current is the only week in fixture mode
  return handle(async () => json(getStore().report));
}
