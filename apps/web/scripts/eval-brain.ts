/**
 * npm run eval:brain — runs the five scenario requests from data/scenarios.json through the
 * live Brain (assessLive) directly, no server, and prints fixture vs live side by side.
 *
 *   npm run eval:brain              # uses ANTHROPIC_API_KEY from .env.local
 *   npm run eval:brain -- --no-key  # forces every Claude call onto its code fallback
 *   npm run eval:brain -- --json    # also dumps the full live assessments
 */
import fs from "node:fs";
import path from "node:path";

const args = new Set(process.argv.slice(2));
const envFile = path.resolve(process.cwd(), ".env.local");
if (fs.existsSync(envFile)) process.loadEnvFile(envFile);
process.env.BRAIN_MODE = "live";
if (args.has("--no-key")) delete process.env.ANTHROPIC_API_KEY;

async function main() {
  const { getStore } = await import("../src/lib/store");
  const { assessLive, liveContext } = await import("../src/lib/brain/assess");
  const store = getStore();

  console.log(`Brain eval: model calls ${process.env.ANTHROPIC_API_KEY ? "ON" : "OFF (fallbacks only)"}\n`);
  const dumps: unknown[] = [];
  for (const s of store.scenarios) {
    const req = { ...s.request };
    delete req.scenarioId;
    const t0 = Date.now();
    const a = await assessLive(req, store);
    const ms = Date.now() - t0;
    const ctx = liveContext(a.id);
    const f = s.response;
    console.log(`${s.id}  (${ms} ms; necessity ${ctx?.sources.necessity}, words ${ctx?.sources.narrative})`);
    console.log(`  fixture  ${f.verdict.padEnd(15)} risk ${String(f.regretRisk).padStart(3)}  aff ${String(f.affordability).padStart(3)}  reflect ${f.reflectionDays}d`);
    console.log(`  live     ${a.verdict.padEnd(15)} risk ${String(a.regretRisk).padStart(3)}  aff ${String(a.affordability).padStart(3)}  reflect ${a.reflectionDays}d`);
    console.log(`  headline "${a.headline}"`);
    for (const it of a.items) {
      const fx = f.items[it.index];
      const pts = it.factors.map((x) => `${x.key.replace("money_strain", "money").replace("want_level", "want")}:${x.points}`).join(" ");
      const extra = [it.essentialPrompt ? "PROMPT" : "", it.duplicateOf ? `dup=${it.duplicateOf.purchaseId}` : "", it.limitedHistory ? "limitedHistory" : ""].filter(Boolean).join(" ");
      console.log(
        `   - ${it.name.slice(0, 44).padEnd(44)} ${it.necessityTag.padEnd(6)} nec ${String(it.necessity).padStart(3)}  risk ${String(it.regretRisk).padStart(3)} (fixture ${fx ? fx.regretRisk : "-"})  [${pts}] ${extra}`,
      );
    }
    for (const tf of a.topFactors) console.log(`   * ${tf.key}: ${tf.text}`);
    for (const c of a.cues) console.log(`   ! cue ${c.key}: ${c.note}`);
    for (const n of a.negotiation) console.log(`   > ${n.id}: ${n.text} -> ${n.resultRegretRisk} ${n.resultVerdict}`);
    if (ctx?.sources.notes.length) console.log(`   (fallback notes: ${ctx.sources.notes.join("; ")})`);
    console.log("");
    dumps.push(a);
  }
  if (args.has("--json")) console.log(JSON.stringify(dumps, null, 2));
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
