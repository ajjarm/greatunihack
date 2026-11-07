import { error, handle, isStr, json, readBody, uncached } from "@/lib/api";
import { isCategory, newId, pounds } from "@/lib/logic";
import { getStore } from "@/lib/store";
import { CATEGORIES, type Category } from "@/lib/types";

/** Very small pattern parser. The real parser lands in phase 2. */

const CATEGORY_WORDS: [RegExp, Category][] = [
  [/\b(eating out|takeaway|takeaways|deliveroo|uber eats|restaurant|food out)\b/i, "eating_out"],
  [/\b(grocer|tesco|aldi|lidl|supermarket|shopping)\b/i, "groceries"],
  [/\b(clothes|clothing|trainers|shoes|hoodie|jeans|asos)\b/i, "clothes"],
  [/\b(tech|laptop|headphones|gadget)\b/i, "tech"],
  [/\b(accessor|phone case|earbuds)\b/i, "accessories"],
  [/\b(book|books|reader|textbook)\b/i, "books"],
  [/\b(transport|train|bus|uber|taxi)\b/i, "transport"],
  [/\b(health|gym|prescription|medicine|pharmacy)\b/i, "health"],
  [/\b(subscription|spotify|netflix|phone bill|phone)\b/i, "subscriptions"],
  [/\b(fun|game|games|steam|cinema|night out)\b/i, "fun"],
  [/\b(gift|gifts|present)\b/i, "gifts"],
  [/\b(household|rent|bills|utilities|electric)\b/i, "household"],
];

function guessCategory(text: string): Category | undefined {
  const direct = text.trim().toLowerCase().replace(/\s+/g, "_");
  if (isCategory(direct)) return direct;
  for (const [re, cat] of CATEGORY_WORDS) if (re.test(text)) return cat;
  return undefined;
}

function ordinal(n: number): string {
  const s = ["th", "st", "nd", "rd"];
  const v = n % 100;
  return `${n}${s[(v - 20) % 10] ?? s[v] ?? s[0]}`;
}

function pence(amount: string): number {
  return Math.round(parseFloat(amount) * 100);
}

export async function POST(req: Request) {
  await uncached();
  return handle(async () => {
    const body = await readBody(req);
    if (!isStr(body.message)) return error("message is required", 400);
    const message = body.message.trim();
    const store = getStore();
    const persona = store.persona;
    const changes: string[] = [];
    let reply = "";

    // "rent £650 on the 1st" -> fixed outgoing
    const outgoing = message.match(/^(?:my\s+)?(.+?)\s+(?:is\s+)?£\s?(\d+(?:\.\d{1,2})?)\s+(?:on|every)\s+(?:the\s+)?(\d{1,2})(?:st|nd|rd|th)?\b/i);
    // "limit clothes £60" / "limit clothes to £60 a week"
    const limit = message.match(/^(?:set\s+)?(?:a\s+)?(?:weekly\s+)?limit\s+(?:on\s+|for\s+)?(.+?)\s+(?:to\s+|at\s+|of\s+)?£\s?(\d+(?:\.\d{1,2})?)/i);
    // "no trainers until exams are over"
    const avoid = message.match(/^no\s+(.+?)\s+until\s+(.+?)\.?$/i);
    // "course books are always fine"
    const fine = message.match(/^(.+?)\s+(?:is|are)\s+always\s+fine\.?$/i);

    if (outgoing) {
      const [, name, amount, day] = outgoing;
      const dayOfMonth = Number(day);
      if (dayOfMonth >= 1 && dayOfMonth <= 31) {
        const amountPence = pence(amount);
        const label = name.trim().replace(/^\w/, (c) => c.toUpperCase());
        const category = guessCategory(name) ?? "household";
        const existing = persona.outgoings.find((o) => o.name.toLowerCase() === label.toLowerCase());
        if (existing) {
          existing.amountPence = amountPence;
          existing.dayOfMonth = dayOfMonth;
          changes.push(`Updated ${label}: ${pounds(amountPence)} on the ${ordinal(dayOfMonth)}`);
        } else {
          persona.outgoings.push({ id: newId("out"), name: label, amountPence, dayOfMonth, category });
          changes.push(`Added ${label}: ${pounds(amountPence)} on the ${ordinal(dayOfMonth)}`);
        }
        reply = `Got it. ${label} is ${pounds(amountPence)} on the ${ordinal(dayOfMonth)} of each month.`;
      }
    } else if (limit) {
      const [, what, amount] = limit;
      const category = guessCategory(what);
      if (!category) {
        reply = `I don't know a category called "${what}". Try one of: ${CATEGORIES.join(", ")}.`;
      } else {
        const weeklyLimitPence = pence(amount);
        const existing = persona.limits.find((l) => l.category === category);
        if (existing) existing.weeklyLimitPence = weeklyLimitPence;
        else persona.limits.push({ category, weeklyLimitPence });
        changes.push(`${existing ? "Updated" : "Added"} limit: ${category} ${pounds(weeklyLimitPence)} a week`);
        reply = `Done. ${pounds(weeklyLimitPence)} a week on ${category.replace("_", " ")}.`;
      }
    } else if (avoid) {
      const [, what, until] = avoid;
      const category = guessCategory(what);
      persona.rules.push({ id: newId("rule"), text: message, ...(category ? { category } : {}), direction: "avoid", until: until.trim() });
      changes.push(`Added rule: ${message}`);
      reply = `Noted. No ${what} until ${until.trim()}. I'll bring it up if it comes up.`;
    } else if (fine) {
      const [, what] = fine;
      const category = guessCategory(what);
      persona.rules.push({ id: newId("rule"), text: message, ...(category ? { category } : {}), direction: "always_fine" });
      changes.push(`Added rule: ${message}`);
      reply = `Noted. ${what.replace(/^\w/, (c) => c.toUpperCase())} are always fine. I won't nudge you on those.`;
    }

    if (!reply) reply = "Noted. (The real parser lands in phase 2.)";
    return json({ reply, changes });
  });
}
