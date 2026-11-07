# Chrome extension (Ajjar's lane)

Manifest V3, TypeScript bundled with esbuild. It steps in at the Amazon UK checkout:
reads the basket, calls `POST ${WEB_URL}/api/assess`, and shows
`${WEB_URL}/nudge?assessmentId=…` as a fixed iframe in the top-right corner.
See `docs/SPEC.md` 4.1 and `docs/INTERFACES.md` sections 5 and 6.

## Build

```bash
cd apps/extension
npm install
npm run build      # writes dist/ (committed, so teammates can Load unpacked right after clone)
npm test           # parser test against apps/web/public/test-checkout.html (jsdom)
npm run typecheck  # tsc --noEmit, types come from apps/web/src/lib/types.ts
npm run watch      # rebuilds src/ on change; reload the extension in chrome://extensions after
```

Commit `dist/` whenever you change `src/` or `static/`, so it never drifts from source.

## Load it in Chrome

1. `chrome://extensions` → turn on **Developer mode** (top right).
2. **Load unpacked** → choose `apps/extension/dist`.
3. Pin it from the puzzle-piece menu so the popup is one click away.
4. After a rebuild, press the reload arrow on the extension's card, then reload the tab.

## WEB_URL

Defaults to `http://localhost:3000` (`npm run dev` in `apps/web`). Change it in the popup
under **Settings** (stored in `chrome.storage.local`). The manifest only has host permission
for `http://localhost:3000/*` and `https://www.amazon.co.uk/*`; if you point WEB_URL
somewhere else, add that origin to `host_permissions` in `static/manifest.json` and to the
test page match in `content_scripts`, then rebuild, or API calls from Amazon pages will fail.

## What it does

- **Content script** runs on `https://www.amazon.co.uk/gp/buy/*`, `/checkout/*` and
  `http://localhost:3000/test-checkout.html`. It confirms a real checkout (a "Place your
  order" / "Buy now" / "Place order" control plus an order summary with £ prices), then
  parses items (name, price, qty), delivery, the "Order total" line and pressure cues
  (scarcity, countdown, social proof, sale, free-delivery threshold, BNPL). Parser:
  `src/parser.ts`.
- **Fixture first:** before posting, it fetches `GET /api/scenarios`; if a scenario total is
  within ±1p of the parsed total, the request carries that `scenarioId`, so the demo shows
  the scripted assessment even before the real Brain is on. No total parsed → nothing
  happens automatically (the shortcut still works).
- **One nudge per basket per tab session** (`sessionStorage`, keys `st-ext:*`). A changed
  total is a new basket hash, so it judges again.
- **Iframe bridge:** listens for `{source:"st-nudge", type}` from the iframe: `resize` sets
  the height (72px up to viewport − 32px), `close` fades it out over 200ms, `open` opens
  `${WEB_URL}${path ?? "/home"}` in a new tab via the service worker.
- **Pause:** the popup's "Pause for 1 hour" stores `pausedUntil`; the content script does
  nothing (including the shortcut) until then. The same button resumes.
- **Service worker:** the keyboard command, opening tabs, and an API fetch proxy. Content
  scripts on amazon.co.uk can't call localhost directly (CORS), so they go through the
  worker; on the test page (same origin) they fetch directly.

## Shortcut: Alt+Shift+N ("judge this screen now")

Option+Shift+N on a Mac. If the page has a parseable checkout basket, it judges it now,
ignoring the once-per-session rule. Otherwise it cycles the fixture scenarios in order
(`GET /api/scenarios`, position kept in `sessionStorage`) and opens the nudge for the next
one. It only works on pages where the content script runs (the URLs above). If the key
does nothing, check `chrome://extensions/shortcuts`: Chrome drops a suggested key that
clashes with another extension.

## Test with the test page (stage safety net)

1. `npm run dev` in `apps/web`, then open http://localhost:3000/test-checkout.html.
2. The default basket (Nike Air Max 90 Trainers £85.00, Carhartt Hoodie £45.00, delivery
   £0.00, Order total £130.00, "Only 2 left in stock") matches `scn_1_impulse`; the nudge
   should slide in top right within about a second.
3. The **Test basket** bar (bottom left) switches to the scn_2 (£13.99), scn_3 (£89.00) and
   scn_5 (£39.99, "Lightning deal ends in 2h 10m") baskets; each switch judges again.
   `?basket=2|3|5` in the URL preselects one.
4. **Reset nudges** forgets which baskets were already judged in this tab; click a basket
   button again to re-judge it. Alt+Shift+N always re-judges.

## Test on a real amazon.co.uk basket

1. Sign in to amazon.co.uk, add something to the basket, **Proceed to checkout** until you
   reach the page with the **Place your order** button. **Never click it.**
2. The nudge should appear. If the total matches a scenario (e.g. a £130.00 basket) you get
   that scenario; otherwise the API builds an assessment from the parsed basket.
3. If nothing appears: open DevTools on the page and look for `[st]` messages in the
   console; press Alt+Shift+N to force it; check the popup isn't paused and the dev server
   is up. Amazon's markup changes often, so item names are best effort; the total is what
   the fixture match relies on.

## Files

```
static/manifest.json   MV3 manifest (copied to dist/)
static/popup.html      popup markup and styles (tokens-style CSS variables, neutral values)
src/parser.ts          checkout detection and basket parsing (pure DOM, tested in jsdom)
src/content.ts         content script: judge, iframe, bridge, shortcut handler
src/api.ts             content-script API client (direct or via the worker)
src/background.ts      service worker: command, open tab, fetch proxy
src/popup.ts           popup: safe to spend, next income, next bill, pause, dashboard, WEB_URL
src/config.ts          storage helpers and message types
test/parser.test.mjs   node --test + jsdom against apps/web/public/test-checkout.html
```
