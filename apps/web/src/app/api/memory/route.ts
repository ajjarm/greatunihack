import { error, handle, json, readBody, uncached } from "@/lib/api";
import { getStore } from "@/lib/store";
import type { Persona } from "@/lib/types";

const KEYS: (keyof Persona)[] = [
  "name", "demoDate", "demoNow", "hourlyRatePence", "balancePence", "incomes", "outgoings", "limits", "rules", "goal",
];

export async function GET() {
  await uncached();
  return handle(async () => json(getStore().persona));
}

export async function PUT(req: Request) {
  await uncached();
  return handle(async () => {
    const body = await readBody(req);
    const store = getStore();
    const patch: Partial<Persona> = {};
    for (const key of KEYS) {
      if (!(key in body)) continue;
      const value = body[key];
      const current = store.persona[key];
      if (Array.isArray(current) !== Array.isArray(value) || typeof current !== typeof value || value === null) {
        return error(`${key} has the wrong shape`, 400);
      }
      (patch as Record<string, unknown>)[key] = value;
    }
    store.persona = { ...store.persona, ...patch };
    return json(store.persona);
  });
}
