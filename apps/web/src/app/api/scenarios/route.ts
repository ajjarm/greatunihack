import { handle, json, uncached } from "@/lib/api";
import { getStore } from "@/lib/store";

export async function GET() {
  await uncached();
  return handle(async () =>
    json(
      getStore().scenarios.map((s) => ({
        id: s.id,
        title: s.title,
        merchant: s.request.merchant,
        totalPence: s.request.totalPence,
      })),
    ),
  );
}
