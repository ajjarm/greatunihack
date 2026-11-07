# INTERFACES — the contract between lanes

**This is the shared contract every lane builds on.** Anyone can propose a change; the
integrator (Ajjar) merges it so all three UIs stay consistent. Propose with:
`./scripts/ask.sh ajjar "interface: ..."`. Every agent reads this before writing code.
The TypeScript source of truth is `apps/web/src/lib/types.ts`; this file explains it.

## 1. Repo layout and ownership

```text
apps/web/                         Next.js 15, App Router, TypeScript, Tailwind. ONE app: API + nudge page + dashboard.
  src/lib/types.ts                Shared types. AJJAR.
  src/lib/store.ts                In-memory store seeded from data/*.json. AJJAR.
  src/lib/brain/**                Real scoring logic (phase 2). AJJAR.
  src/app/api/**                  All API routes. AJJAR.
  src/app/layout.tsx              Root layout, minimal. AJJAR.
  src/app/globals.css             Imports tokens.css + Tailwind. AJJAR.
  src/styles/tokens.css           Design tokens as CSS variables. AJJAR (design lane).
  src/app/nudge/**                The nudge page. RAYAN.
  src/components/nudge/**         Nudge components. RAYAN.
  src/app/(dashboard)/**          Dashboard routes and its own layout. AARAV.
  src/components/dashboard/**     Dashboard components. AARAV.
  package.json, package-lock.json AJJAR. Need a dependency? ask.sh ajjar "add dep: x".
apps/extension/                   Chrome extension (Amazon checkout → API → nudge iframe). AJJAR.
apps/web/src/lib/host.ts          postMessage helpers the nudge page uses. AJJAR.
data/                             Fixture data (JSON). ZACK.
n8n/                              Exported workflows. RAYAN (phase 2).
docs/DESIGN.md                    Design system, written by Ajjar from the Claude Design file.
```

Rules that prevent clashes:

1. You write only inside your directories. Never edit another lane's files, even to fix
   an obvious bug: file a handoff issue instead.
2. UI lanes never import from `data/` and never read fixture files directly. They call
   the API. The API serves fixtures today and real logic later; the UI does not change.
3. UI lanes never hard-code colours, fonts, radii or shadows. Use the CSS variables in
   `tokens.css` (see section 8). When `docs/DESIGN.md` lands, Ajjar updates the tokens
   and your screens restyle themselves; you then apply any component-level notes.
4. No new shared components. If both UIs need the same thing, each lane keeps its own
   copy for now. Ajjar may consolidate at the end.
5. Branch names: `ajjar/<thing>`, `rayan/nudge`, `aarav/dashboard`, `zack/data`.
   Land with `./scripts/land.sh` every 45 minutes. Only Ajjar resolves conflicts in
   shared files.
6. Money is integer pence everywhere. Dates are ISO strings. Times are Europe/London.
   The "current time" for the demo is `persona.demoNow`, not the wall clock; the API
   exposes it and UIs use it for "days until" maths.

## 2. Categories

```
groceries | eating_out | clothes | tech | accessories | books | transport | health |
subscriptions | fun | gifts | household | other
```

Display labels: Groceries, Eating out, Clothes, Tech, Accessories, Books, Transport,
Health, Subscriptions, Fun, Gifts, Household, Other.

## 3. Pressure cue keys

```
scarcity ("only 2 left") | countdown | social_proof ("14 people viewing") | sale |
free_delivery_threshold ("add £6 for free delivery") | bnpl ("4 payments of £12") |
preticked_addon
```

## 4. Core objects (summary; full definitions in types.ts)

**Persona** — `demoDate`, `demoNow`, `name`, `hourlyRatePence`, `balancePence`,
`incomes[]` (name, amountPence, schedule, nextDate), `outgoings[]` (name, amountPence,
dayOfMonth, category), `limits[]` (category, weeklyLimitPence), `rules[]` (text,
category?, direction `avoid|always_fine`, until?), `goal` (name, targetPence,
savedPence).

**Purchase** — `id`, `merchant`, `item`, `category`, `amountPence`, `purchasedAt`,
`source` (`feed|extension|manual`), `essential`, `cues[]`, `predictedRegret?`,
`assessmentId?`, `feedback` (`happy|regretted|unsure|null`), `feedbackReason?`,
`feedbackAt?`, `reflectionDueAt?`.

**Assessment** — the thing the nudge renders. Fields:

| Field | Meaning |
|---|---|
| `id`, `createdAt`, `source`, `merchant`, `totalPence` | identity |
| `verdict` | `go_ahead` (toast only) · `essential_cover` (need; buy it, here's how) · `nudge` (40–69) · `strong_nudge` (70+) |
| `headline` | one friendly line, e.g. "Hold on, this looks like an impulse buy." |
| `spokenLine` | one sentence for captions (voice is out for now; keep the field) |
| `regretRisk` | 0–100 for the basket |
| `affordability` | 0–100 |
| `items[]` | `AssessedItem`: index, name, pricePence, qty, category, necessity 0–100, necessityTag `need|useful|want`, necessityConfidence, `essentialPrompt` (true = ask "is this essential?" up front), `essential` (user's answer, null until given), regretRisk, `factors[]`, `duplicateOf?`, `limitedHistory` |
| `impact` | safeToSpendBeforePence, safeToSpendAfterPence, daysToNextIncome, nextIncome {name,date,amountPence}, nextBill {name,date,amountPence,coveredAfter}, limit? {category, weeklyLimitPence, spentThisWeekPence, remainingAfterPence, overByPence}, workingHours, goalSharePct, overdraftUntil (date or null) |
| `topFactors[]` | at most three `{key, text}` for the card |
| `cues[]` | `{key, text, note}`; `note` is the plain-English "this is a sales cue" line |
| `negotiation[]` | `NegotiationOption`: id, action `drop|delay`, itemIndex, text, resultRegretRisk, resultSafeToSpendAfterPence, resultVerdict, delayUntil? |
| `reflectionDays` | AI-chosen days before asking "glad you bought it?" (1–60) |
| `reasoning` | the Brain's paragraph for show-more |
| `timeline[]` | `TimelinePoint`: date, projectedPence, projectedAfterPence, events[] |
| `calibration` | `{category, multiplier, tunedPct}` |
| `reason?` | after the justification chat: `{text, accepted, adjustment, verdictText}` |
| `decision` | `none|wait|buy_anyway|dismiss|negotiated` |

**Factor** — `{key, points, max, text, evidence?}` with keys
`want_level (max 25) | history (20) | duplicate (15) | pressure (10) | timing (10) |
money_strain (15) | reason (adjustment, can be negative)`.

**Home** — spendScore `{value, band green|amber|red, trend, explanation, history[]}`,
balancePence, safeToSpendPence, daysToNextIncome, nextIncome, nextBill, insight (one
sentence), recentAssessments[] (summaries).

**Insights** — sentences[] `{key, text, evidence}`, regretByCategory[], riskyWindows[],
pressure `{withCueRatePct, withoutCueRatePct, sentence}`, duplicates[], avoidedPence,
avoidedCouldBe[] `{label, text}`, calibration `{overallPct, byCategory[]}`, limits[]
(with spentThisWeekPence), timeline[].

**WaitingItem** — id, assessmentId, itemName, pricePence, merchant, url?, savedAt,
reconsiderAt, status `waiting|bought|removed|extended`.

**Report** — weekStart, nudgesShown, heeded, overridden, overriddenHappy,
overriddenRegretted, limitsKept, limitsExceeded, avoidedPence, spendScore, sentences[].

## 5. API

All under `/api`. JSON in, JSON out. Errors: `{ "error": "message" }` with a 4xx/5xx.
In fixture mode (default until phase 2) the routes read and mutate the in-memory store
seeded from `data/`. Mutations persist for the process lifetime, so the demo shows
state changing.

| Method | Path | Body | Returns | Used by |
|---|---|---|---|---|
| GET | `/api/health` | | `{ok, mode: "fixture"|"live", demoNow}` | all |
| GET | `/api/scenarios` | | `[{id, title, merchant, totalPence}]` | nudge dev, extension |
| POST | `/api/assess` | `AssessRequest` (`scenarioId` optional: when present, the matching fixture is used) | `Assessment` | extension, nudge dev |
| GET | `/api/assessments/:id` | | `Assessment` | nudge |
| POST | `/api/assessments/:id/reason` | `{text}` | `Assessment` (updated, with `reason`) | nudge |
| PATCH | `/api/assessments/:id/essential` | `{itemIndex, essential: boolean}` | `Assessment` (re-judged) | nudge |
| POST | `/api/assessments/:id/negotiate` | `{optionId}` | `Assessment` (re-judged with the option applied) | nudge |
| PATCH | `/api/assessments/:id/decision` | `{decision: wait|buy_anyway|dismiss}` | `{assessment, waitingItem?, purchase?}` | nudge |
| GET | `/api/home` | | `Home` | dashboard |
| GET | `/api/purchases` | `?category=&feedback=` | `Purchase[]` newest first | dashboard |
| PATCH | `/api/purchases/:id/feedback` | `{feedback, reason?}` | `{purchase, calibration}` | dashboard, n8n |
| GET | `/api/waiting` | | `WaitingItem[]` | dashboard |
| PATCH | `/api/waiting/:id` | `{decision: buy|wait|remove}` | `WaitingItem` | dashboard, n8n |
| GET | `/api/insights` | | `Insights` | dashboard |
| GET | `/api/timeline` | | `{balancePence, safeToSpendPence, nextIncome, nextBill, points: TimelinePoint[]}` | dashboard |
| GET | `/api/report` | `?week=current` | `Report` | dashboard, n8n |
| GET | `/api/memory` | | `Persona` | dashboard |
| PUT | `/api/memory` | `Persona` (partial ok) | `Persona` | dashboard |
| POST | `/api/memory/chat` | `{message}` | `{reply, changes: string[]}` | dashboard |
| POST | `/api/transactions` | `{transactions: [{externalId, date, merchant, description, amountPence, category?}]}` | `{created, purchases}` | n8n |
| GET | `/api/pending-reflections` | | `Purchase[]` whose reflection is due and unanswered | dashboard, n8n |

`AssessRequest`:

```json
{
  "source": "extension",
  "merchant": "Amazon",
  "url": "https://www.amazon.co.uk/gp/buy/...",
  "items": [{"name": "Nike Air Max 90", "pricePence": 8500, "qty": 1, "category": "clothes"}],
  "deliveryPence": 0,
  "totalPence": 13000,
  "cues": [{"key": "scarcity", "text": "Only 2 left in stock"}],
  "capturedAt": "2026-11-08T23:40:00+00:00",
  "basketHash": "amazon|nike air max 90:8500|hoodie:4500|13000",
  "scenarioId": "scn_1_impulse"
}
```

Fixture matching in `POST /api/assess`: `scenarioId` wins; else exact `basketHash`;
else merchant + totalPence within ±1; else a generic `go_ahead` assessment is built from
the request (phase 1) or computed for real (phase 2).

## 6. The nudge page and the host bridge

The nudge is a Next.js page: `/nudge?assessmentId=<id>` renders that assessment;
`/nudge?scenario=<scenarioId>` (dev convenience) first calls `POST /api/assess` with
that `scenarioId`, then renders. The Chrome extension injects this page into the Amazon
checkout as an `<iframe>` fixed to the top-right, 400px wide, height whatever the page
asks for.

The page talks to its host with `window.postMessage` (works in the iframe; harmless in
a plain tab). Use the helper in `apps/web/src/lib/host.ts` (Ajjar) rather than calling
postMessage yourself:

```ts
// apps/web/src/lib/host.ts
hostResize(height: number)   // posts {source:"st-nudge", type:"resize", height}
hostClose()                  // posts {source:"st-nudge", type:"close"}
hostOpenDashboard(path?)     // posts {source:"st-nudge", type:"open", path}
```

Rules: call `hostResize(document.body.scrollHeight)` after every render; call
`hostClose()` after a decision. In a plain browser tab these are no-ops, so the page
must still behave sensibly (buttons call the API; after a decision show a quiet "done"
state).

Toast variant: when `verdict === "go_ahead"`, render the small green toast layout and
call `hostResize(72)`; auto-close after 3 seconds.

The extension's content script (Ajjar, `apps/extension`) listens for these messages
and resizes or removes the iframe; it never reaches into the page.

## 7. Scenario fixtures (data/scenarios.json)

```json
[
  {
    "id": "scn_1_impulse",
    "title": "Late-night trainers under a scarcity banner",
    "trigger": {"merchant": "Amazon", "keywords": ["Place your order"], "urlPattern": "amazon.co.uk/gp/buy"},
    "request": { "...AssessRequest" },
    "response": { "...Assessment" },
    "variants": {
      "reason": {"input": "they're for my sister's birthday", "response": { "...Assessment" }},
      "negotiated": {"optionId": "neg_drop_1", "response": { "...Assessment" }},
      "essentialYes": {"itemIndex": 0, "response": { "...Assessment" }}
    }
  }
]
```

The five scenarios are listed in `docs/MOCK-DATA-GUIDE.md`. Variants are optional per
scenario; the API falls back to simple deterministic edits when a variant is missing
(reason accepted → risk −30; negotiated drop → remove item, recompute totals; essential
yes → verdict `essential_cover`).

## 8. Design tokens (apps/web/src/styles/tokens.css)

Use these and only these. Values and component recipes: `docs/DESIGN.md`.

```css
--color-bg, --color-surface, --color-surface-2, --color-text, --color-text-muted,
--color-text-dim, --color-border, --color-fill, --color-fill-2,
--color-accent, --color-accent-bg, --color-on-accent, --color-go, --color-go-bg,
--color-think, --color-think-bg, --color-stop, --color-stop-bg,
--glass-tint, --glass-tint-strong, --glass-blur, --glass-sheen, --glass-edge, --glass-rim,
--color-popover, --color-scrim,
--radius-sm, --radius-md, --radius-lg, --radius-pill, --shadow-card, --shadow-float,
--font-sans, --font-mono, --fs-display, --fs-number, --fs-h1, --fs-headline, --fs-h2,
--fs-body, --fs-label, --space-1 ... --space-9,
--motion-press (120ms), --motion-fast (150ms), --motion-base (240ms),
--motion-slow (340ms), --motion-exit (160ms), --ease-out, --ease-in-out,
--z-card, --z-popover, --z-nav, --z-toast
```

Tailwind is available for layout (flex, grid, spacing), but colours, radii, shadows
and fonts come from the variables (`bg-[var(--color-surface)]` or a small CSS class).
Respect `prefers-reduced-motion`.

## 9. Branch, land, ask

```bash
git checkout -b rayan/nudge            # once
./scripts/checkpoint.sh "nudge: layout" # every 20 min
./scripts/land.sh                       # every 45 min
./scripts/ask.sh ajjar "interface: need X on Assessment" "why"
./scripts/inbox.sh                      # at session start
```
