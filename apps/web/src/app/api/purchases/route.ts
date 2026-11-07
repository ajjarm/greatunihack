import { error, handle, json, uncached } from "@/lib/api";
import { isCategory } from "@/lib/logic";
import { getStore } from "@/lib/store";

const FEEDBACK = ["happy", "regretted", "unsure", "null", "none"];

export async function GET(req: Request) {
  await uncached();
  return handle(async () => {
    const url = new URL(req.url);
    const category = url.searchParams.get("category");
    const feedback = url.searchParams.get("feedback");
    if (category && !isCategory(category)) return error(`Unknown category: ${category}`, 400);
    if (feedback && !FEEDBACK.includes(feedback)) return error(`feedback must be one of ${FEEDBACK.join(", ")}`, 400);

    let list = [...getStore().purchases];
    if (category) list = list.filter((p) => p.category === category);
    if (feedback === "null" || feedback === "none") list = list.filter((p) => p.feedback === null);
    else if (feedback) list = list.filter((p) => p.feedback === feedback);
    list.sort((a, b) => (a.purchasedAt < b.purchasedAt ? 1 : a.purchasedAt > b.purchasedAt ? -1 : 0));
    return json(list);
  });
}
