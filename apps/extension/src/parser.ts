/**
 * Best-effort checkout parser. Pure DOM in, plain data out, so it runs in the content
 * script and in Node (jsdom) tests. No layout is assumed: when the DOM has no layout
 * (jsdom), visibility checks pass and text comes from textContent.
 *
 * What it reads: the order button, the order summary (items, delivery, order total) and
 * visible pressure text. Nothing else.
 */
import type { AssessRequest, BasketItem, CueInput, CueKey } from "../../web/src/lib/types";

export interface ParsedCheckout {
  /** Order button AND an order summary with £ prices are present. */
  isCheckout: boolean;
  hasOrderButton: boolean;
  hasSummary: boolean;
  merchant: string;
  url: string;
  items: BasketItem[];
  deliveryPence: number;
  /** null when no "Order total" line could be read. */
  totalPence: number | null;
  cues: CueInput[];
  /** null when totalPence is null. */
  basketHash: string | null;
}

export const MERCHANT = "Amazon";

const PRICE_SRC = "£\\s?(\\d{1,3}(?:,\\d{3})+|\\d+)(?:\\.(\\d{2}))?";
const PRICE_RE = new RegExp(PRICE_SRC);
const PRICE_RE_G = new RegExp(PRICE_SRC, "g");
const PRICE_ONLY_RE = new RegExp(`^${PRICE_SRC}$`);

const BUTTON_RE = /place your order|buy now|place order|proceed to checkout|go to checkout/i;
const TOTAL_LABEL_RE = /^(order total|grand total|total to pay)\b/i;
const TOTAL_INLINE_RE = new RegExp(`^(?:order total|grand total|total to pay)[^£]{0,30}?(${PRICE_SRC})`, "i");
// Basket pages (Amazon /cart) have no order total; the subtotal is the basket total there.
const SUBTOTAL_INLINE_RE = new RegExp(`^(?:subtotal|sub-total|basket total|cart total)[^£]{0,40}?(${PRICE_SRC})`, "i");
const DELIVERY_LABEL_RE = /^(postage(\s*(&|and)\s*packing)?|p\s*&\s*p|delivery|shipping)(\s*(fee|charge|cost))?\s*:?$/i;
const DELIVERY_FREE_RE = /^(postage(\s*(&|and)\s*packing)?|p\s*&\s*p|delivery|shipping)\s*:?\s*free\b/i;
const SUMMARY_LABEL_RE =
  /^(items?(\s*\(\d+\))?|item\(s\)|subtotal|sub-total|total before vat|estimated vat|vat|total|promotions?( applied)?|discount|gift cards?|you saved?|savings|import fees deposit)\s*(subtotal)?\s*:?$/i;
const TITLE_JUNK_RE =
  /^(qty|quantity|delivery|arriving|dispatch|sold by|gift|change|remove|delete|save for later|free|in stock|eligible|prime|order summary|items?\s*:?$|postage|order total|subtotal|total|£)/i;
const QTY_RE = /\b(?:qty|quantity)\s*:?\s*(\d{1,3})\b/i;
const SKIP_TAGS = new Set(["SCRIPT", "STYLE", "NOSCRIPT", "TEMPLATE", "HEAD", "IFRAME", "SVG", "OPTION"]);

export const CUE_PATTERNS: { key: CueKey; re: RegExp }[] = [
  { key: "scarcity", re: /only \d+ left/i },
  { key: "countdown", re: /ends in|deal ends|lightning deal/i },
  { key: "social_proof", re: /people (are )?viewing|bought in past/i },
  { key: "sale", re: /save \d+%|% off/i },
  { key: "free_delivery_threshold", re: /add .* for free delivery/i },
  { key: "bnpl", re: /\d+ payments of|instalments|klarna|pay in 3/i },
];

// ---------- small helpers ----------

export function norm(s: string | null | undefined): string {
  return (s ?? "").replace(/\s+/g, " ").trim();
}

/** "£1,234.56" → 123456, "£85" → 8500. First price in the string. */
export function parsePence(text: string): number | null {
  const m = PRICE_RE.exec(text);
  if (!m) return null;
  const pounds = parseInt(m[1].replace(/,/g, ""), 10);
  const pence = m[2] ? parseInt(m[2], 10) : 0;
  return pounds * 100 + pence;
}

function textOf(el: Element): string {
  return norm(el.textContent);
}

function isVisible(el: Element): boolean {
  const fn = (el as Element & { checkVisibility?: () => boolean }).checkVisibility;
  if (typeof fn !== "function") return true;
  try {
    return fn.call(el);
  } catch {
    return true;
  }
}

function hasOwnText(el: Element): boolean {
  for (const n of Array.from(el.childNodes)) {
    if (n.nodeType === 3 && norm(n.nodeValue).length > 0) return true;
  }
  return false;
}

function allElements(doc: Document): Element[] {
  if (!doc.body) return [];
  return Array.from(doc.body.querySelectorAll("*")).filter((el) => !SKIP_TAGS.has(el.tagName.toUpperCase()) && !el.closest("script,style,noscript,template,svg"));
}

function isCueText(t: string): boolean {
  return CUE_PATTERNS.some((c) => c.re.test(t));
}

/** Visible text as lines. Browser: innerText. No layout: text of each element that owns text. */
export function visibleLines(doc: Document): string[] {
  const body = doc.body as HTMLElement | null;
  if (!body) return [];
  const it = (body as { innerText?: unknown }).innerText;
  if (typeof it === "string" && it.trim().length > 0) {
    return it.split(/\n+/).map(norm).filter(Boolean);
  }
  const lines: string[] = [];
  for (const el of allElements(doc)) {
    if (!hasOwnText(el) || !isVisible(el)) continue;
    const t = textOf(el);
    if (t && t.length <= 300) lines.push(t);
  }
  return lines;
}

function snippet(line: string, re: RegExp): string {
  if (line.length <= 140) return line;
  const sentences = line.split(/(?<=[.!?])\s+/);
  const hit = sentences.find((s) => re.test(s)) ?? line;
  if (hit.length <= 140) return hit;
  const m = re.exec(hit);
  const start = Math.max(0, (m?.index ?? 0) - 40);
  return norm(hit.slice(start, start + 140));
}

// ---------- pieces ----------

function findOrderButton(doc: Document): Element | null {
  const els = doc.querySelectorAll('button, input[type="submit"], input[type="button"], a, [role="button"], span');
  for (const el of Array.from(els)) {
    const label =
      el.tagName === "INPUT" ? norm((el as HTMLInputElement).value) || norm(el.getAttribute("aria-label")) : textOf(el) || norm(el.getAttribute("aria-label"));
    if (label && label.length <= 60 && BUTTON_RE.test(label) && isVisible(el)) return el;
  }
  return null;
}

interface PriceEl {
  el: Element;
  pence: number;
  label: string;
  kind: "total" | "delivery" | "summary" | "item";
}

/** The nearest ancestor that has text besides prices; that text is the row's label. */
function rowLabel(el: Element): string {
  let row: Element = el;
  for (let i = 0; i < 4 && row.parentElement; i++) {
    row = row.parentElement;
    const label = norm(textOf(row).replace(PRICE_RE_G, " "));
    if (label) return label;
  }
  return "";
}

function classify(label: string): PriceEl["kind"] {
  if (TOTAL_LABEL_RE.test(label) && label.length <= 40) return "total";
  if (DELIVERY_LABEL_RE.test(label)) return "delivery";
  if (SUMMARY_LABEL_RE.test(label)) return "summary";
  if (/:$/.test(label) && label.length < 30) return "summary";
  return "item";
}

function priceElements(doc: Document, els: Element[]): PriceEl[] {
  const out: PriceEl[] = [];
  for (const el of els) {
    const t = textOf(el);
    if (t.length > 24 || !PRICE_ONLY_RE.test(t)) continue;
    // keep the outermost price-only element (Amazon nests £ / whole / fraction spans)
    if (el.parentElement && PRICE_ONLY_RE.test(textOf(el.parentElement))) continue;
    if (!isVisible(el)) continue;
    const pence = parsePence(t);
    if (pence == null) continue;
    const label = rowLabel(el);
    out.push({ el, pence, label, kind: classify(label) });
  }
  return out;
}

function titleScore(el: Element): number {
  const attrs = `${el.className || ""} ${el.id || ""} ${el.parentElement?.className || ""}`;
  let s = 0;
  if (/title|name|product/i.test(String(attrs))) s += 3;
  const tag = el.tagName.toUpperCase();
  if (tag === "A" || tag === "B" || tag === "STRONG" || /\bh[1-6]\b/i.test(tag) || /a-text-bold/.test(String(attrs))) s += 2;
  return s + Math.min(textOf(el).length, 120) / 100;
}

function readQty(scope: Element): number {
  const sel = scope.querySelector('select[name*="quantity" i], select[id*="quantity" i], input[name*="quantity" i]') as HTMLSelectElement | HTMLInputElement | null;
  const fromField = sel ? parseInt(sel.value, 10) : NaN;
  if (Number.isFinite(fromField) && fromField > 0) return fromField;
  // per element, so "Qty: 2" next to "12 people viewing" never reads as 212
  for (const el of [scope, ...Array.from(scope.querySelectorAll("*"))]) {
    if (!hasOwnText(el)) continue;
    const m = QTY_RE.exec(textOf(el));
    const q = m ? parseInt(m[1], 10) : 0;
    if (q > 0) return q;
  }
  return 1;
}

function itemFromPrice(p: PriceEl, all: PriceEl[], button: Element | null): BasketItem | null {
  let scope: Element | null = p.el.parentElement;
  for (let depth = 0; scope && depth < 6; depth++, scope = scope.parentElement) {
    const s = scope;
    // gone too wide: this ancestor holds another, different price
    if (all.some((o) => o !== p && o.pence !== p.pence && s.contains(o.el))) return null;
    const candidates = Array.from(s.querySelectorAll("*")).filter((el) => {
      if (SKIP_TAGS.has(el.tagName.toUpperCase()) || !hasOwnText(el)) return false;
      if (button && (el === button || button.contains(el) || el.contains(button))) return false;
      const t = textOf(el);
      return (
        t.length >= 3 && t.length <= 200 && /[a-z]/i.test(t) && !PRICE_RE.test(t) && !TITLE_JUNK_RE.test(t) && !QTY_RE.test(t) && !isCueText(t) && isVisible(el)
      );
    });
    if (candidates.length) {
      candidates.sort((a, b) => titleScore(b) - titleScore(a));
      return { name: textOf(candidates[0]), pricePence: p.pence, qty: readQty(s) };
    }
  }
  return null;
}

/** Fallback: lines with a £ price and a label on the same line or the line before. */
function itemsFromLines(lines: string[]): BasketItem[] {
  const items: BasketItem[] = [];
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    if (!/£\d+(\.\d\d)?/.test(line) || line.length > 160) continue;
    let label = norm(line.replace(PRICE_RE_G, " "));
    if (!label && i > 0) label = lines[i - 1];
    label = label.replace(/\s*:$/, "");
    if (!label || label.length < 3 || label.length > 160 || !/[a-z]/i.test(label)) continue;
    if (classify(label) !== "item" || classify(`${label}:`) === "total" || TITLE_JUNK_RE.test(label) || isCueText(label) || BUTTON_RE.test(label)) continue;
    const pence = parsePence(line);
    if (pence == null) continue;
    items.push({ name: label, pricePence: pence, qty: 1 });
  }
  return items;
}

function findTotal(prices: PriceEl[], els: Element[]): number | null {
  const fromRow = prices.find((p) => p.kind === "total");
  if (fromRow) return fromRow.pence;
  for (const el of els) {
    const t = textOf(el);
    if (t.length > 80) continue;
    const m = TOTAL_INLINE_RE.exec(t);
    if (m && isVisible(el)) return parsePence(m[1]);
  }
  for (const el of els) {
    const t = textOf(el);
    if (t.length > 80) continue;
    const m = SUBTOTAL_INLINE_RE.exec(t);
    if (m && isVisible(el)) return parsePence(m[1]);
  }
  return null;
}

function findDelivery(prices: PriceEl[], els: Element[]): number {
  const fromRow = prices.find((p) => p.kind === "delivery");
  if (fromRow) return fromRow.pence;
  for (const el of els) {
    const t = textOf(el);
    if (t.length <= 60 && DELIVERY_FREE_RE.test(t)) return 0;
  }
  return 0;
}

function hasSummaryRegion(els: Element[]): boolean {
  for (const el of els) {
    if (!hasOwnText(el)) continue;
    const t = textOf(el);
    if (t.length > 60 || !/order summary/i.test(t)) continue;
    let a: Element | null = el;
    for (let i = 0; a && i < 4; i++, a = a.parentElement) {
      if (PRICE_RE.test(textOf(a))) return true;
    }
  }
  return false;
}

function findCues(lines: string[]): CueInput[] {
  const cues: CueInput[] = [];
  for (const { key, re } of CUE_PATTERNS) {
    const line = lines.find((l) => re.test(l));
    if (line) cues.push({ key, text: snippet(line, re) });
  }
  return cues;
}

export function computeBasketHash(merchant: string, items: BasketItem[], totalPence: number): string {
  return `${merchant}|${items.map((i) => `${i.name.toLowerCase()}:${i.pricePence}`).join("|")}|${totalPence}`;
}

// ---------- entry points ----------

export function parseCheckout(doc: Document, url: string): ParsedCheckout {
  const els = allElements(doc);
  const button = findOrderButton(doc);
  const prices = priceElements(doc, els);
  const totalPence = findTotal(prices, els);
  const deliveryPence = findDelivery(prices, els);
  const hasSummary = totalPence != null || hasSummaryRegion(els);

  const seen = new Set<string>();
  let items: BasketItem[] = [];
  for (const p of prices) {
    if (p.kind !== "item") continue;
    const it = itemFromPrice(p, prices, button);
    if (!it) continue;
    const key = `${it.name.toLowerCase()}:${it.pricePence}`;
    if (seen.has(key)) continue;
    seen.add(key);
    items.push(it);
  }
  const lines = visibleLines(doc);
  if (items.length === 0) items = itemsFromLines(lines);

  return {
    isCheckout: !!button && hasSummary,
    hasOrderButton: !!button,
    hasSummary,
    merchant: MERCHANT,
    url,
    items,
    deliveryPence,
    totalPence,
    cues: findCues(lines),
    basketHash: totalPence == null ? null : computeBasketHash(MERCHANT, items, totalPence),
  };
}

export function toAssessRequest(p: ParsedCheckout, capturedAt = new Date().toISOString()): AssessRequest | null {
  if (p.totalPence == null || p.basketHash == null) return null;
  return {
    source: "extension",
    merchant: p.merchant,
    url: p.url,
    items: p.items,
    deliveryPence: p.deliveryPence,
    totalPence: p.totalPence,
    cues: p.cues,
    capturedAt,
    basketHash: p.basketHash,
  };
}
