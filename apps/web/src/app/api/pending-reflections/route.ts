import { handle, json, uncached } from "@/lib/api";
import { pendingReflections } from "@/lib/logic";
import { getStore } from "@/lib/store";

export async function GET() {
  await uncached();
  return handle(async () =>
    json(pendingReflections(getStore()).sort((a, b) => (a.reflectionDueAt! < b.reflectionDueAt! ? -1 : 1))),
  );
}
