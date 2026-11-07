import { error, handle, json, uncached, type Params } from "@/lib/api";
import { getAssessment } from "@/lib/store";

export async function GET(_req: Request, { params }: Params<"id">) {
  await uncached();
  return handle(async () => {
    const { id } = await params;
    const a = getAssessment(id);
    if (!a) return error(`Unknown assessment: ${id}`, 404);
    return json(a);
  });
}
