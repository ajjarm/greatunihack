import { handle, json, uncached } from "@/lib/api";
import { getStore } from "@/lib/store";

export async function GET() {
  await uncached();
  return handle(async () =>
    json([...getStore().waiting].sort((a, b) => (a.reconsiderAt < b.reconsiderAt ? -1 : a.reconsiderAt > b.reconsiderAt ? 1 : 0))),
  );
}
