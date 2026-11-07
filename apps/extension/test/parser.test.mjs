// Runs the real parser (src/parser.ts, bundled in memory with esbuild) against the
// stage test page apps/web/public/test-checkout.html in jsdom.
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import * as esbuild from "esbuild";
import { JSDOM } from "jsdom";

const here = dirname(fileURLToPath(import.meta.url));
const pagePath = join(here, "../../web/public/test-checkout.html");
const PAGE_URL = "http://localhost:3000/test-checkout.html";

const bundle = await esbuild.build({
  entryPoints: [join(here, "../src/parser.ts")],
  bundle: true,
  format: "esm",
  platform: "neutral",
  write: false,
});
const { parseCheckout, toAssessRequest, parsePence } = await import(
  `data:text/javascript;base64,${Buffer.from(bundle.outputFiles[0].text).toString("base64")}`
);

const html = readFileSync(pagePath, "utf8");

test("parsePence handles £ formats", () => {
  assert.equal(parsePence("£130.00"), 13000);
  assert.equal(parsePence("£85"), 8500);
  assert.equal(parsePence("Order total: £1,234.56"), 123456);
  assert.equal(parsePence("no price"), null);
});

test("static test page parses as scn_1 basket: total 13000, two items, scarcity cue", () => {
  const dom = new JSDOM(html, { url: PAGE_URL }); // scripts off: the static HTML only
  const p = parseCheckout(dom.window.document, PAGE_URL);
  console.log(JSON.stringify(p, null, 2));
  assert.equal(p.isCheckout, true);
  assert.equal(p.totalPence, 13000);
  assert.equal(p.deliveryPence, 0);
  assert.equal(p.items.length, 2);
  assert.deepEqual(
    p.items.map((i) => [i.name, i.pricePence, i.qty]),
    [
      ["Nike Air Max 90 Trainers", 8500, 1],
      ["Carhartt Hoodie", 4500, 1],
    ],
  );
  assert.deepEqual(p.cues, [{ key: "scarcity", text: "Only 2 left in stock" }]);
  assert.equal(p.basketHash, "Amazon|nike air max 90 trainers:8500|carhartt hoodie:4500|13000");

  const req = toAssessRequest(p, "2026-11-08T23:40:00+00:00");
  assert.equal(req.source, "extension");
  assert.equal(req.merchant, "Amazon");
  assert.equal(req.url, PAGE_URL);
  assert.equal(req.totalPence, 13000);
  assert.equal(req.capturedAt, "2026-11-08T23:40:00+00:00");
});

test("basket switcher swaps to the scn_2, scn_3 and scn_5 totals", () => {
  const dom = new JSDOM(html, { url: PAGE_URL, runScripts: "dangerously" });
  const doc = dom.window.document;
  const expected = {
    2: { total: 1399, items: 2, cues: [] },
    3: { total: 8900, items: 2, cues: [] },
    5: { total: 3999, items: 1, cues: ["countdown"] },
    1: { total: 13000, items: 2, cues: ["scarcity"] },
  };
  for (const [key, want] of Object.entries(expected)) {
    doc.querySelector(`[data-basket="${key}"]`).click();
    const p = parseCheckout(doc, PAGE_URL);
    assert.equal(p.isCheckout, true, `basket ${key} is a checkout`);
    assert.equal(p.totalPence, want.total, `basket ${key} total`);
    assert.equal(p.items.length, want.items, `basket ${key} items`);
    assert.equal(p.items.reduce((s, i) => s + i.pricePence * i.qty, 0) + p.deliveryPence, want.total, `basket ${key} items add up`);
    assert.deepEqual(p.cues.map((c) => c.key), want.cues, `basket ${key} cues`);
  }
});

test("a page without an order button or total is not a checkout", () => {
  const dom = new JSDOM("<!doctype html><body><h1>Your basket</h1><p>Nike Air Max 90 £85.00</p></body>", { url: PAGE_URL });
  const p = parseCheckout(dom.window.document, PAGE_URL);
  assert.equal(p.isCheckout, false);
  assert.equal(p.totalPence, null);
  assert.equal(toAssessRequest(p), null);
});

test("Amazon-style markup: nested a-price spans, table rows, FREE postage, cues", () => {
  const amazonish = `<!doctype html><body>
    <div id="spc-orders"><div class="a-row">
      <span class="a-text-bold">Champion Reverse Weave Hoodie, Grey, M</span>
      <span class="a-color-price"><span class="a-price"><span class="a-offscreen">£45.00</span><span aria-hidden="true"><span class="a-price-symbol">£</span><span class="a-price-whole">45<span class="a-price-decimal">.</span></span><span class="a-price-fraction">00</span></span></span></span>
      <div>Quantity: 2</div><div>12 people are viewing this right now</div>
    </div></div>
    <div id="subtotals"><span id="submitOrderButtonId-announce">Place your order</span>
      <table><tr><td>Items:</td><td>£90.00</td></tr><tr><td>Postage &amp; Packing:</td><td>FREE</td></tr>
      <tr><td>Order Total:</td><td>£90.00</td></tr></table>
      <div>Pay in 3 instalments of £30.00 with Klarna</div>
    </div></body>`;
  const dom = new JSDOM(amazonish, { url: "https://www.amazon.co.uk/gp/buy/spc/handlers/display.html" });
  const p = parseCheckout(dom.window.document, dom.window.location.href);
  assert.equal(p.isCheckout, true);
  assert.equal(p.totalPence, 9000);
  assert.equal(p.deliveryPence, 0);
  assert.deepEqual(p.items, [{ name: "Champion Reverse Weave Hoodie, Grey, M", pricePence: 4500, qty: 2 }]);
  assert.deepEqual(p.cues.map((c) => c.key).sort(), ["bnpl", "social_proof"]);
});
