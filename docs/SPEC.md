# SPEC — [name TBD], a money agent that steps in at checkout

**Status: final for build day, 8 Nov 2026.** Demo-first. Sections 8 and 9 are the
per-person instructions. `docs/INTERFACES.md` is the contract; where this file and that
file disagree, INTERFACES wins. The name is undecided; the placeholder lives in one
file (`apps/web/src/lib/brand.ts`, Ajjar).

Capture surface decided 7 Nov evening: **a Chrome extension scoped to Amazon**, not a
screen-watching Mac app. Reason: a screen watcher makes some people (and possibly
judges) uncomfortable; the extension has a narrow permission and keeps every other
feature. Demo is Amazon only.

---

## 1. The product in one paragraph

A money agent for students that lives in your browser. It knows when your money
arrives (loan drops, shifts) and when it leaves (rent, phone, gym), and it sees every
purchase you make through a bank-style transaction feed. The moment you reach a
checkout, it steps in: a predicted regret score, the real impact on your money between
now and your next income, the factors you should weigh, and a "show more" for the
detail. It never blocks. You can tell it why you're buying, and it judges whether that
reason holds. It learns from what you buy and how you feel about it later, and shows
you how well it has learned you.

**User:** university students who shop online (wording open; "especially useful if you
have ADHD or find impulse control hard" is the one permitted line, no medical claims).

**The one sentence:** Unlike budgeting apps that tell you what you spent last month, it
steps in at the checkout, knows what your rent and payday do to this purchase, and
tells you what to drop instead of saying no.

**Why it's original (say this to BNY):** checkout-pause tools exist (Pocketlens,
REGRET, Worth It). None of them: compute impact against your real income dates and
bills; negotiate the basket instead of pause-or-continue; read pressure cues off the
page and feed them back as insight; let you argue your case and re-judge; show their
calibration to you. We add those five.

**Privacy line:** the extension only has permission for amazon.co.uk, only runs on
checkout pages, and only sends item names, prices and visible banner text to our API.
Nothing else is read or stored.

## 2. Principles (every lane)

- Never blocks. "Continue" is always one click away.
- Explains everything: which rule, which past purchase, which cue, which number.
- Estimates are labelled ("regret risk, experimental"; "avoided spending, estimated").
- No shame. Friendly, short, specific. Colour always paired with a text label.
  Keyboard reachable. Escape closes. No red flashing. No exclamation marks in copy.
- The user wins arguments: one tap overrides any AI judgement, and it's remembered.
- Money is integer pence, GBP, Europe/London. "Now" is `persona.demoNow`.

## 3. Demo-first strategy

Everything the judge sees is built against **fixture data first**. The API serves
fixtures from `data/` from minute zero, so the nudge and dashboard call real endpoints
from the start and never change when the logic becomes real. The extension starts by
triggering fixture scenarios on the Amazon checkout page, then reads the real basket.
Fixtures become real behaviour one endpoint at a time in phase 2. If time runs out,
whatever is still on fixtures stays on fixtures and we say so.

| Phase | Clock | What is true at the end |
|---|---|---|
| 0 Setup | 0:00–0:30 | Everyone has cloned, run `npm install` and `npm run dev` in `apps/web`, seen `/api/health` and `/nudge?scenario=scn_1_impulse` return data. Branches created. Organisers' questions asked (submission format, deadline, hacking window). |
| 1 Fixtures | 0:30–3:00 | Nudge renders all five scenarios beautifully. Dashboard's five tabs render from the API. Extension injects the nudge on the Amazon checkout page (fixture scenario first, then the real basket). Zack's data v1 at 1:30, final at 2:30. First full run-through at 2:00. |
| 2 Real | 3:00–5:00 | `/api/assess` computes for real (timeline, necessity, affordability, factors 1–7, reason). Reflection loop changes calibration. Dashboard reads live values. Backup video recorded at 4:00. |
| 3 Freeze | 5:00–6:00 | No new code except a crash on the demo path. Two timed rehearsals. Submit. |

## 4. Surfaces

### 4.1 The Chrome extension — Ajjar

Manifest V3. Host permission: `https://www.amazon.co.uk/*` only. A content script
runs on checkout URLs (`/gp/buy/*`, `/checkout/*`) and confirms it is really the
checkout: a "Place your order" (or "Buy now") button plus an order summary are present.
It reads the item names, prices and quantities from the order summary, delivery and
total, and any visible pressure text ("Only 2 left in stock", "Lightning deal ends in",
"people viewing"), builds an `AssessRequest`, calls `POST ${WEB_URL}/api/assess`, and
injects `${WEB_URL}/nudge?assessmentId=…` as a fixed top-right iframe, 400px wide,
height set by the page's `resize` message. One nudge per basket hash per tab session;
a changed total re-judges. Keyboard shortcut `Alt+Shift+N` forces an assessment of the
current page; in phase 1 it cycles the fixture scenarios. Extension popup (toolbar
icon): safe-to-spend, days to next income, limits remaining, pause for an hour, open
dashboard. `WEB_URL` defaults to `http://localhost:3000`.

Phase 1: trigger on the Amazon checkout URL and show scenario fixtures (match by
basket total where possible). Phase 2: parse the real basket from the page and let the
real Brain score it.

### 4.2 The Nudge (web page inside the extension's iframe) — Rayan

`/nudge?assessmentId=<id>` renders an `Assessment`; `/nudge?scenario=<id>` creates one
from a fixture first (dev and demo convenience). Layout, top to bottom:

1. Headline (`assessment.headline`), friendly.
2. Regret risk, big: `regretRisk`% with a small "experimental" label. Colour by band:
   go (0–39), think (40–69), stop (70+). Text label always next to colour.
3. Impact block, three lines with large figures from `impact`: safe to spend after this
   until `nextIncome.date`; `nextBill` and whether `coveredAfter`; limit line when
   `impact.limit` exists (remaining, or "£35 over your clothes limit this week" when
   `overByPence > 0`). Plus `workingHours` ("14 hours at your job") and `goalSharePct`.
4. Factors: `topFactors` as up to three plain sentences.
5. Items: each `items[i]` with name, price, `necessityTag` chip (need / useful / want,
   tap to change → `PATCH essential`), its own `regretRisk`, and `duplicateOf` as a
   line ("you bought this in September") when present.
6. Essential prompt: for any item with `essentialPrompt === true`, show "Looks like
   this might be essential. Is it?" Yes / No above the factors. Yes → `PATCH essential`.
7. Cues: each `cues[]` entry as text plus its `note`.
8. Negotiation: `negotiation[]` options as rows with an Apply button →
   `POST negotiate`; the card re-renders with the returned assessment, numbers
   animating from old to new.
9. "Why are you buying it?" single-line input → `POST reason`; show `reason.verdictText`
   and the new risk; impact unchanged by design.
10. Buttons: I'll wait · Buying anyway · Dismiss → `PATCH decision`, then `hostClose()`.
11. Show more: expands `reasoning`, every item's `factors[]` with points out of max, the
    `timeline` as a small chart with income and bill markers and the after-basket line,
    and `calibration` ("81% tuned to you on clothes").
12. Toast variant when `verdict === "go_ahead"`: one green line, 72px tall, auto-closes
    after 3 seconds.

Host communication only through `apps/web/src/lib/host.ts` (`hostResize`, `hostClose`,
`hostOpenDashboard`); see INTERFACES section 6. Call `hostResize(document.body.scrollHeight)`
after every render. Motion: slide in from the right over `--motion-slow` with
`--ease-out`; thinking pulse while fetching; numbers count between values over
`--motion-base`; respect reduced motion. Keyboard: Tab order top to bottom, Escape =
Dismiss.

### 4.3 The Dashboard (web app, laptop and phone) — Aarav

Routes in a `(dashboard)` route group with its own layout: bottom tab bar under 768px,
left nav above. Five tabs:

- `/home` ← `GET /api/home`: Spend Score dial with band colour and trend, explanation
  on tap; balance; safe to spend until next income; days to next income; next bill;
  the insight sentence; recent assessments list; a banner when `pendingReflections > 0`
  linking to Purchases.
- `/purchases` ← `GET /api/purchases`: list newest first, grouped by day; each row shows
  merchant, item, amount, category chip, predicted regret if any, and a feedback control
  (happy / regretted / unsure, optional reason) → `PATCH feedback`; rows with a due
  reflection show "How do you feel about this now?" first. Filter by category and by
  feedback.
- `/waiting` ← `GET /api/waiting`: cards with countdown to `reconsiderAt`; buttons buy /
  wait / remove → `PATCH waiting/:id`.
- `/insights` ← `GET /api/insights` and `GET /api/timeline`: the sentences as cards;
  regret by category bars; risky windows; the pressure sentence with the two
  percentages; duplicates; limits with bars (spent / weekly); avoided spending
  (labelled estimated) with the "could be" lines; calibration overall and per category
  with delta; the cash timeline chart with markers; a live "agent log" panel listing
  recent assessments for the pitch.
- `/profile` ← `GET/PUT /api/memory`, `POST /api/memory/chat`: the settings chat (a
  message list and an input; replies show `changes[]` as chips); the structured view of
  incomes, outgoings, limits, rules, goal; quiet hours toggle (UI only).

Visual: big numbers, small labels, cards, one accent. Phone first.

### 4.4 Phone and voice

Out of scope for build day except the dashboard opened full-screen on a phone.
ElevenLabs is dropped; `spokenLine` stays in the data so captions can show it.

## 5. The Brain (phase 2) — Ajjar

### 5.1 Cash timeline

From balance, incomes and outgoings: a day-by-day projected balance for 60 days.
Safe-to-spend until next income = lowest projected balance between now and the next
income date after all bills in that window. Impact = the same run with the basket
subtracted.

### 5.2 Necessity (0–100) and the essential flag

Claude rates each item with a confidence: urgent essential 85–100 (medicine,
course-required, transport to a shift or interview, staple groceries); essential but
can wait 60–80; useful want 40–60; pure want 10–30. Rules shift it; a stored essential
flag or past "needed it" in the category shifts it up. If necessity ≥ 60 or confidence
is low on a plausibly essential item, `essentialPrompt = true`. The user's answer wins
and is remembered for similar items.

### 5.3 Affordability (0–100)

Run the timeline with the basket. Buffer = lowest projected balance before next income;
days = days until it. Buffer ≥ £15 × days → 80–100; between £5 × days and £15 × days →
40–79; between 0 and £5 × days → 10–39; below 0 → 0 and `overdraftUntil` set. Up to 15
off as the weekly category limit runs out. Overdraft never counts as money.

### 5.4 Regret risk per item (0–100), factors 1–7

| Factor | Max | Feeds it |
|---|---|---|
| want_level | 25 | inverse of necessity after rules and the essential answer |
| history | 20 | regret rate in the category from reviewed purchases (unsure excluded); under 3 reviews → omitted, `limitedHistory = true`, never rescaled |
| duplicate | 15 | semantic match of name and category against purchases and past assessments |
| pressure | 10 | cues present, each adds; described, never accused |
| timing | 10 | 23:00–04:00, within 48h after an income, 3+ purchases today, basket-to-checkout under 2 minutes, a known risky window |
| money_strain | 15 | low affordability, over a limit, unusually large for the category versus the user's typical |
| reason | −30…0 | the justification chat: gift, replacement, course, health, work-related reasons lower it; "it's on sale" does nothing; money impact never changes |

Basket risk = price-weighted mean of item risks. Multiply by the category calibration
multiplier, clamp 0–100.

### 5.5 Verdict

- `essential === true` or necessity ≥ 60 → `essential_cover`; if affordability < 40 the
  headline carries the cover-it plan (move money from a limit with room, delay another
  spend, or an honest overdraft line).
- else risk 0–39 and affordability ≥ 40 → `go_ahead` (toast).
- else risk 40–69 or affordability < 40 → `nudge`.
- risk 70–100 → `strong_nudge`: negotiation first, waiting list suggested, reflection
  prompt scheduled if bought anyway.

Facts and predictions stay separate: the over-limit line, overdraft line and
safe-to-spend come from arithmetic and show whenever the arithmetic says so.

### 5.6 Negotiation, reflection, calibration, Spend Score

Negotiation: rank items by risk; propose drop or delay (to next income date) until the
verdict turns green or the limit holds. Reflection: Claude picks `reflectionDays` per
basket (food 1, clothes 3, electronics 7, subscriptions 30, courses 60; bounded 1–60;
60 seconds under `DEMO_FAST_TIMERS`). Any purchase can be rated any time; items the AI
put at 70+ and bought anyway get the prompt automatically. Calibration per category:
multiplier starts 1.0, happy −0.1, regretted +0.1, clamp 0.5–1.5; tuned % = share of the
last 20 predictions that matched outcomes. Spend Score (weekly, 0–100): Claude judges it
from the facts (nudges shown/heeded/overridden, later outcomes, limits, cash position)
under fixed guidelines (never down for spending alone; up for heeded high-risk nudges,
limits kept, overrides later happy with a reason; down for overrides later regretted and
limits exceeded); green 75+, amber 50–74, red below; deterministic fallback if the model
fails.

### 5.7 Transaction feed

Purchases enter from a bank-style feed (`POST /api/transactions`), mocked as a Google
Sheet pushed by n8n, in the shape of Open Banking data. A "buying anyway" intent is
confirmed as a purchase when a matching transaction arrives (merchant and amount). We
say "mock feed in the shape of Open Banking; a real connection is one connector".

## 6. Data — Zack

See `docs/MOCK-DATA-GUIDE.md`. The data is the demo's brain until phase 2. v1 at
1:30, final at 2:30, `npm run check:data` must pass.

## 7. Design — Ajjar (parallel to the extension)

Ajjar produces the design file (both screens) in Claude Design, then writes
`docs/DESIGN.md` (tokens, type scale, spacing, component notes for the nudge and the
dashboard) and updates `apps/web/src/styles/tokens.css`. Because the UI lanes use only
the token variables, the restyle is mostly automatic; each lane then applies the
component-level notes in DESIGN.md to its own directory. Until then, lanes build with
the neutral defaults and never hard-code a colour.

## 8. Working rules (the anti-clash section)

1. **Directories are owned** (INTERFACES.md section 1). Never edit another lane's files.
   A bug in someone else's lane → `./scripts/ask.sh <who> "bug: …"` with the repro.
2. **The API is the only thing UIs talk to.** No imports from `data/`, no reading
   fixtures, no shared components between lanes.
3. **Shared files are Ajjar's:** package.json, lockfile, root layout, globals.css,
   tokens.css, types.ts, host.ts, INTERFACES.md. Dependency requests: `ask.sh ajjar
   "add dep: x because y"`; Ajjar lands it within minutes; everyone picks it up on the
   next `land.sh`.
4. **Branches:** `ajjar/<thing>`, `rayan/nudge`, `aarav/dashboard`, `zack/data`.
   `checkpoint.sh` every 20 minutes. `land.sh` every 45 minutes. Conflicts in shared
   files go to Ajjar.
5. **Agents read before they write.** Every session starts with `./scripts/sync.sh`,
   then AGENTS.md, INTERFACES.md, types.ts and your own plan file in `plan/active/`.
6. **Types are law.** If your UI needs a field that isn't on the type, you ask for it;
   you don't invent it locally.
7. **Dev server:** one per person, `npm run dev` in `apps/web`, default port 3000. The
   extension reads `WEB_URL` (default http://localhost:3000).
8. **Fast timers:** run the API with `DEMO_FAST_TIMERS=1` for the demo so reflections
   and waiting-list timers fire in seconds.
9. **No secrets in git.** `.env.local` in `apps/web`; keys listed in `.env.example`.
10. **Land one lane at a time.** If `land.sh` reports a conflict in a file you don't
    own, stop and ask Ajjar.

## 9. Per-person instructions

Each person's plan file in `plan/active/` has the agent prompt to paste. Summary:

| Person | Tool | Lane | Directories | Branch | Done when |
|---|---|---|---|---|---|
| Ajjar | Claude Ultra | Extension, Brain, design, integrator | apps/extension, apps/web/src/lib, src/app/api, shared files, docs/DESIGN.md | ajjar/* | Extension injects the nudge on the Amazon checkout for the five scenarios, then on a real basket; phase-2 assess returns real verdicts; design tokens applied |
| Rayan | Claude Pro | The nudge page | apps/web/src/app/nudge, src/components/nudge | rayan/nudge | All five scenarios render and animate; negotiate, reason, essential, decision all call the API and update; toast variant; works in an iframe and in a tab; keyboard and Escape |
| Aarav | Codex | The dashboard | apps/web/src/app/(dashboard), src/components/dashboard | aarav/dashboard | Five tabs from the API; phone layout; feedback changes calibration on Insights; chat on Profile shows changes |
| Zack | any | Data, then pitch | data/ (then docs/PITCH.md, README, video) | zack/data | check:data passes; patterns in the guide present; v1 1:30, final 2:30; then script, slides, backup video at 4:00 |

If Claude Pro hits its limit, Rayan moves to QA and rehearsals and Ajjar's session
takes the rest of the nudge as one more subagent. Plan for it.

## 10. Demo (two minutes, all on Amazon)

1. 23:40, Amazon checkout, hoodie and trainers, "Only 2 left". Nudge slides in: "Hold
   on, this looks like an impulse buy." 78%. (25s)
2. Impact and factors; the "2 left" named as a cue; Apply "drop the trainers", numbers
   animate to green. (20s)
3. Paracetamol, two days before rent: "Looks essential. Is it?" Yes. "Buy it, skip one
   takeaway this week and you're covered." (15s)
4. Headphones plus phone case: "you own two". Type "the case is a gift": risk drops,
   money impact unchanged. Buying anyway. (20s)
5. Show more: factors with points, the timeline, the matched rule. Then the reflection
   prompt appears on the dashboard, tap "regretted it", calibration ticks. (20s)
6. A lightning-deal game under a countdown: the cue named, the Friday-night window
   named, "wait 5 days" suggested. Then the dashboard on a phone. The one sentence. (20s)

Backup: the recorded video of the same six beats.

## 11. Cut order and out of scope

Cut first → last: scenario 5 polish; the Profile chat parser (keep the structured
view); the timeline chart in show-more (keep the numbers); waiting-list countdowns
(keep the list); real basket parsing in the extension (fixture scenarios on the
checkout URL still work).

Never cut: the nudge on scenarios 1–3, the dashboard Home and Purchases, show-more,
the reflection changing calibration, the backup video.

Out of scope on the day: screen watching, voice, iPhone native, other shops, real bank
connection, refunds, authentication, multiple users, non-GBP, photo-based duplicate
matching, mood tracking, rewards mechanics.

## 12. Open items

Name. Target-user wording. Anthropic API key with credit (needed at 3:00, not before).
Hosting only if the dashboard must be reachable from a phone during judging; otherwise
everything runs on the demo Mac. Submission format, deadline and hacking window from
the organisers at 0:00.
