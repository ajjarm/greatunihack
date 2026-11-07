# DESIGN.md — SecondThought design system

This is the design contract for every UI surface: the nudge (inside the extension's
iframe) and the dashboard (desktop and phone). Agents: read this file, then open the two
reference prototypes in a browser and match them. Where this file and a prototype
disagree, this file wins.

| Reference | What it shows |
|---|---|
| `docs/design/nudge-prototype.html` | The nudge over an Amazon page: arrival, hovers, "Wait until payday", reason input, toast, replay |
| `docs/design/dashboard.html` | All five dashboard sections, desktop above 768px, phone below |
| `docs/design/nudge.jpg`, `desktop-*.jpg`, `phone-*.jpg` | Screenshots of the above |
| `apps/web/src/styles/tokens.css` | Every value in this file, as CSS variables |

Open the prototypes with `python3 -m http.server 8787 --directory docs/design` and go to
`http://localhost:8787/nudge-prototype.html` or `/dashboard.html`.

## 1. Principles

1. **Calm, dry, on your side.** A friend who's good with money. Never shaming, never
   alarming. The worst band is a soft coral, not red.
2. **One block, little text.** Each surface says one thing first, then lets you dig.
   Detail lives in hover popovers and "Show details", not on the surface.
3. **Numbers are the heroes.** Big figure, small label underneath. Labels never outrank
   values.
4. **One accent, used for actions.** Lime `#CDFF44` marks what you can press next (the
   primary button, the current week, the active tab). It is never decoration.
5. **Colour always has a word.** Coral, amber and mint mean stop, think and go. Each one
   appears beside a number or a word that says the same thing.
6. **Glass for the floating layer only.** Cards and the nudge are translucent glass.
   Things on glass are flat fills, never more glass.
7. **Nothing under 12px.** If it doesn't fit at 12px, cut the words.
8. **Every animation has a reason.** Arrival, feedback or a state change. Nothing loops
   while you're reading.

## 2. Tokens

All values live in `apps/web/src/styles/tokens.css`. Use the variables, never the hex.

### 2.1 Colour (dark, the product)

| Token | Value | Use |
|---|---|---|
| `--color-bg` | `#141416` | Page background |
| `--color-surface` | `#2A2B2D` | Solid card fallback (where glass can't render) |
| `--color-surface-2` | `#36373A` | Solid inset tile fallback |
| `--color-text` | `#F2F2F2` | Primary text and numbers |
| `--color-text-muted` | `#B4B5B7` | Labels, secondary text (6.9:1 on surface) |
| `--color-text-dim` | `#7A7B7D` | Decimals (`.00`), large text only (3.3:1) |
| `--color-border` | `rgba(255,255,255,.10)` | Dividers between rows, top bar and rail edges |
| `--color-fill` | `rgba(255,255,255,.06)` | Tiles inside cards, tracks, input bars, segmented controls |
| `--color-fill-2` | `rgba(255,255,255,.10)` | Secondary buttons, selected segment, chat bubbles |
| `--color-accent` | `#CDFF44` | Primary button, active tab icon, current week, progress fill |
| `--color-accent-bg` | `#3D442F` | Tinted accent background (rare) |
| `--color-on-accent` | `#121212` | Text and icons on an accent fill |
| `--color-go` / `--color-go-bg` | `#9BF2B0` / `#38433D` | Go band, "Happy", "Covered", paydays |
| `--color-think` / `--color-think-bg` | `#FFD15C` / `#443F33` | Think band, "Unsure" |
| `--color-stop` / `--color-stop-bg` | `#FF8C78` / `#443736` | Stop band, "Regretted", overdrawn days |

Band thresholds for any 0–100 regret risk: **go 0–39, think 40–69, stop 70+**. On glass,
use the band colour itself at 12% opacity for a chip background
(`rgba(155,242,176,.12)` and so on). Use the `-bg` tokens only on solid surfaces.

### 2.2 Colour (light, opt-in)

Set `<html data-theme="light">`. Not used in the demo. Lime fails contrast on white, so
the light accent is olive.

| Token | Light |
|---|---|
| `--color-bg` / `--color-surface` / `--color-surface-2` | `#F4F4F2` / `#FFFFFF` / `#F0F0EC` |
| `--color-text` / `--color-text-muted` / `--color-text-dim` | `#141416` / `#5C5D60` / `#8A8B8E` |
| `--color-accent` / `--color-accent-bg` / `--color-on-accent` | `#4F6B00` / `#EEFFC2` / `#FFFFFF` |
| `--color-go` / `--color-go-bg` | `#1F7A44` / `#E3F5E9` |
| `--color-think` / `--color-think-bg` | `#8A5A00` / `#FFF2CC` |
| `--color-stop` / `--color-stop-bg` | `#B3412F` / `#FDE8E4` |

### 2.3 Material

| Token | Value |
|---|---|
| `--glass-tint` | `rgba(58,59,61,.55)` (cards) |
| `--glass-tint-strong` | `rgba(58,59,61,.72)` (the nudge, over busy shop pages) |
| `--glass-blur` | `blur(40px) saturate(160%)` |
| `--glass-sheen` | diagonal white gradient, 10% → 0 |
| `--glass-edge` | 1px gradient hairline, brighter at top-left and bottom-right |
| `--glass-rim` | `inset 0 1px 0 rgba(255,255,255,.18), inset 0 -1px 0 rgba(0,0,0,.40)` |
| `--color-popover` | `rgba(50,51,53,.97)` (popovers are nearly opaque so text stays crisp) |
| `--color-scrim` | `rgba(0,0,0,.48)` (dims the shop page while the nudge is up) |

### 2.4 Shape, shadow, layers

| Token | Value | Use |
|---|---|---|
| `--radius-sm` | 10px | Merchant marks, tags |
| `--radius-md` | 16px | Tiles, popovers |
| `--radius-lg` | 22px | Cards, the nudge panel (20px on phone) |
| `--radius-pill` | 999px | Buttons, inputs, chips, segmented controls, toasts |
| `--shadow-card` | `0 24px 60px rgba(0,0,0,.35), 0 1px 2px rgba(0,0,0,.30)` | Cards |
| `--shadow-float` | adds a top rim | Popovers, toasts, the nudge |
| `--z-card` / `--z-popover` / `--z-nav` / `--z-toast` | 1 / 30 / 40 / 50 | Stacking order |

### 2.5 Type

One family: **Inter** (Google Fonts, loaded in `app/layout.tsx` as `--font-inter`).
Every number uses `font-variant-numeric: tabular-nums`, set once on `body`. Do not use a
monospace face for numbers. `--font-mono` (Geist Mono) is for code only.

| Role | Token | Size / weight / tracking | Example |
|---|---|---|---|
| Display number | `--fs-display` | 56 / 600 / −0.04em, line-height 1 | Spend Score `72` |
| Stat number | `--fs-number` | 30 / 600 / −0.03em (22–26 inside the nudge) | `£412.00` |
| Page title | `--fs-h1` | 28 / 500 / −0.02em (26 on phone) | `Home` |
| Nudge headline | `--fs-headline` | 21 / 600 / −0.02em, line-height 1.25 | `Hold on, this looks like an impulse buy.` |
| Card title | `--fs-h2` | 18 / 500 / −0.01em | `Next 5 weeks` |
| Body | `--fs-body` | 14 / 400, line-height 1.45 | rows, sentences |
| Label | `--fs-label` | 12 / 500 | `until Fri 13 Nov` |

Decimals on money are `--color-text-dim` at weight 500: `£412<span class="dec">.00</span>`.
Inputs on phone are 16px so iOS doesn't zoom.

### 2.6 Space

4pt grid: `--space-1` 4 · `-2` 8 · `-3` 12 · `-4` 16 · `-5` 20 · `-6` 24 · `-7` 32 ·
`-8` 40 · `-9` 48.

| Where | Value |
|---|---|
| Card padding | 20 (16 on phone) |
| Gap between cards | 14 |
| Tile padding | 16 × 18 (14 on phone) |
| Page padding | 26 × 28 desktop; 18 × 16 phone, plus 100 at the bottom for the tab bar |
| Row height (lists) | 12 top and bottom, 1px `--color-border` between rows |

### 2.7 Motion

Durations come from tokens. The curve is always `--ease-out`
(`cubic-bezier(.22,1,.36,1)`) unless something moves between two on-screen positions
(`--ease-in-out`). Never `ease-in`, never `transition: all`, never scale from 0.

| Token | Value | Used for |
|---|---|---|
| `--motion-press` | 120ms | `:active { transform: scale(.97) }` on every button |
| `--motion-fast` | 150ms | Hover background and colour |
| `--motion-base` | 240ms | Popovers and tooltips in, count-ups of short numbers |
| `--motion-slow` | 340ms | Cards arriving, the nudge sliding in |
| `--motion-exit` | 160ms | Anything leaving (exits are about a third faster) |

`prefers-reduced-motion` sets every duration to 0 in `tokens.css`. Opacity changes may
stay; movement may not. `prefers-reduced-transparency` swaps glass for the solid surface.

## 3. Materials

### 3.1 Glass card (the default container)

Put the material on `::before` so popovers inside the card can still blur what's behind
them. Children sit on `z-index: 1`.

```css
.card { position: relative; border-radius: var(--radius-lg); padding: var(--space-5); box-shadow: var(--shadow-card); }
.card::before {
  content: ""; position: absolute; inset: 0; border-radius: inherit; pointer-events: none;
  background: var(--glass-sheen), var(--glass-tint);
  backdrop-filter: var(--glass-blur); -webkit-backdrop-filter: var(--glass-blur);
  box-shadow: var(--glass-rim);
}
.card::after {
  content: ""; position: absolute; inset: 0; border-radius: inherit; padding: 1px; pointer-events: none;
  background: var(--glass-edge);
  -webkit-mask: linear-gradient(#000 0 0) content-box, linear-gradient(#000 0 0);
  -webkit-mask-composite: xor; mask-composite: exclude;
}
.card > * { position: relative; z-index: 1; }
.card:has(.popover[data-open="true"]) { z-index: 20; }
```

Glass needs something behind it to read as glass. The dashboard page has three soft
blobs fixed behind the content: lime at 10%, coral at 9%, mint at 8%, each blurred 90px.

### 3.2 Inside glass: flat fills only

Tiles, tracks, inputs, segmented controls and secondary buttons are flat
`--color-fill` / `--color-fill-2` with no border and no shadow. Never nest a glass
surface inside another.

### 3.3 Popover

`--color-popover` background, `--radius-md`, `--shadow-float`, 250–290px wide. It opens
from its trigger: set `transform-origin` to the point nearest the trigger. Keep it
mounted and toggle `data-open` so it can animate out.

```css
.popover { opacity: 0; visibility: hidden; transform: translateY(-6px) scale(.97);
  transition: opacity var(--motion-exit) var(--ease-out), transform var(--motion-exit) var(--ease-out), visibility 0s linear var(--motion-exit); }
.popover[data-open="true"] { opacity: 1; visibility: visible; transform: none;
  transition: opacity 200ms var(--ease-out), transform 260ms var(--ease-out), visibility 0s; }
```

The element that owns a popover must create a stacking context above its siblings while
open (`z-index: 20` on the hovered tile or card). Without it, the next tile paints over
the popover. Do not put `z-index` on a wrapper that holds several tiles.

## 4. Components

Each component lists what it is, its anatomy and its states. Class names below are the
ones the prototypes use; React components can name them however they like.

**Button**
- Primary (`.btn.acc`): `--color-accent` fill, `--color-on-accent` text, 13/600, pill,
  min height 40 (44 for icon-only and on phone). Hover lightens to `#D9FF6E`.
- Secondary (`.btn.sec`): `--color-fill-2`, text colour.
- Icon round: 40–44 circle, `--color-fill-2`, `aria-label` required.
- One primary per surface. Press: `scale(.97)` over `--motion-press`.
- Disabled: 50% opacity, a padlock icon when it unlocks after an action (see the nudge).

**Chip (status)**
12/600 pill, band colour text on the band colour at 12%. Words, not colour alone:
`Covered`, `Happy`, `Regretted`, `Unsure`, `Essential` (muted), `Above £0`. The only
accent chip is `Rate it`, because it's an action.

**Segmented control**
`--color-fill` track, 4px padding, 32px pill buttons, selected one on `--color-fill-2`
with text colour. Used for Purchases filters.

**Stat tile**
Inset `--color-fill` tile. Order: label (12, muted) → title (16/500) → number (30/600)
with dimmed decimals → optional chip. A white 34px circle with a black icon sits
top-right on desktop; hidden on phone.

**Flat bar**
6px tall (8px for goal bars), radius half the height, track `--color-fill-2`, fill solid
`--color-text`, `--color-accent` or a band colour. No gradients, gloss or shadows. Fills
grow from the left on arrival: `scaleX(0) → 1`, 640ms `--ease-out`, 200ms delay. Where a
bar shows a shortfall, the missing part is the band colour on the same track.

**Limit pill** (Home only, from the reference)
40px pill track with a pill fill and a dark 28px label inside showing the percentage.
Three styles side by side: accent fill, white fill, hatched (for 0%). Label below:
`Groceries · £24 of £45`.

**Score ring** (nudge)
76px ring, 7px stroke, `--color-fill-2` track, band-colour arc with a 5px glow in the
band colour. The number sits in the middle as HTML text, 22/600, with a small `%`. Under
it: `regret risk`. No band word under the ring; colour plus number say it.

**Spend Score bars** (Home)
Eight weeks. Past weeks hatched (`repeating-linear-gradient(135deg, …)` 1px lines) with a
faint 1px outline; the current week solid accent in three steps. Tooltip only on hover:
the score and the change on the week before. Bars grow from the bottom with a 30ms
stagger. The week label row has the current week in an accent pill; on phone it shows
day numbers only.

**Timeline strip** (nudge and dashboard; replaces every line chart)
The answer to "can I afford this, given what's coming?".
- Data: a start balance plus dated events `{date, name, amountPence, kind: pay|bill|buy}`
  for the next 33 days, from `GET /api/timeline` and the persona.
- Draw: an 8px track. Each span between events is coloured by the balance after the
  event that starts it: `--color-stop` when below £0, `rgba(255,255,255,.45)` otherwise.
- Dots: 14px circles on the track, 2px dark ring. Pay is `--color-go`, bills are white,
  the purchase is the band colour (16px).
- Under the strip: `Today` on the left, the end date on the right, 12px muted.
- Then two rows only, the events that matter: next payday and rent (or whichever bill
  causes the lowest point). Each row: date (muted), name, amount (muted), balance after
  (600, coral if negative).
- Headline above: `Overdrawn on 29 of the next 33 days` in coral, or `Lowest point £105
  on Sat 5 Dec` with a `Above £0` chip.
- Hover or tap a dot: a popover under that dot, `Rent · Tue 1 Dec` then
  `−£650. You'll have −£502 after it.`
- Never add a second line, axis ticks or a legend.

**List row** (purchases)
34px white merchant mark with the merchant's initial, then name (500) over
`Merchant · Category` (12, muted), predicted regret % in its band colour if there is
one, amount, then the feedback control. 1px `--color-border` between rows. Rows are
grouped under a day label (`Saturday 7 November`, 12, muted).

**Feedback control**
Three 32px round buttons in a `--color-fill` pill: happy, unsure, regretted (face
icons, `aria-label` and `aria-pressed`). Selected fills with the band colour: go, think,
stop, with a black icon. Tapping the selected one clears it. Essentials show an
`Essential` chip instead.

**Chat** (Profile)
User bubbles: accent fill, `--color-on-accent`, right-aligned, bottom-right corner 6px.
Agent bubbles: `--color-fill-2`, left. Confirmations are not bubbles: a mint pill with a
tick, `Bill saved · Rent · £650 · 1st`. The input bar is a `--color-fill` pill with an
accent round send button.

**Toast**
Bottom-centre pill, `--color-popover`, 14/500, rises 12px over 260ms, leaves after
2.8s. `role="status"` and `aria-live="polite"`. On phone it sits above the tab bar.

**Navigation**
- Desktop: an 80px left rail. Logo on top, five round 44px icon buttons with tooltips on
  hover, "pause nudges for an hour" at the bottom. The active one sits on
  `--color-fill-2`. A 7px lime dot marks Purchases when a rating is due.
- Phone (below 768px): the rail becomes a bottom tab bar on glass. Icon above a 12px
  label, active icon in accent, padding includes `env(safe-area-inset-bottom)`.
- Top bar: search pill (desktop only), notifications, avatar. On phone: logo and name
  left, avatar right.

## 5. The nudge

Lives in the extension iframe, 460px wide, top right of the shop page. Laptop only.

### 5.1 Layout, top to bottom (one glass block)

1. Header line, 12px muted: `SecondThought · Amazon · £618 · experimental`, with
   `Show details ⌄` on the right.
2. Headline, 21/600: `Hold on, this looks like an impulse buy.`
3. One row of three inset tiles:
   - Score ring tile (120px): ring with `82%`, `regret risk` under it. Hover: why.
   - Money tile: `£206` in band colour, `overdrawn till Fri 13 Nov`, a flat bar of what
     you have against the price. Hover: the sum.
   - Time tile: `65 hrs`, `of work to pay for it`, six and a half white blocks. Hover:
     hours, shifts, share of the trip fund.
4. Timeline strip tile (see §4).
5. Show details (collapsed by default): the item row with its want/need tag and score,
   next bill covered or not, goal impact, then the factors with points out of max as
   flat bars.
6. Input pill: `Why are you buying it?` with mic and an accent send button.
7. Buttons: `Wait until payday · 52%` (primary, it is the negotiation),
   `Buying anyway` with a padlock icon (locked until a reason is sent), round dismiss.

No pills or badges for the band. No floating pieces. No line graphs. Every action
appears once.

### 5.2 States and copy

| State | What changes |
|---|---|
| Thinking (≈1.2s) | Panel in, spinning ring and two shimmer lines, `Having a look at this one…` |
| Ready | Content lands with a 50ms stagger; ring sweeps and the number counts 0 → score over 700ms |
| Wait until payday | Score counts to 52 over 500ms, band shifts to think, tiles and strip recompute, then the panel leaves and the toast reads `Saved to Waiting. I'll ask again on Fri 13 Nov.` |
| Reason sent | Reply under the input; `Reason accepted. Money impact unchanged.` for a gift, otherwise `Noted. The money maths doesn't change.` Buying anyway unlocks. A gift lowers the score (to 61 here). |
| Buying anyway | Panel leaves, toast `Noted. I'll check in on this one in a few days.` |
| Dismiss / Escape | Panel leaves, no toast |
| Essential basket | Headline `Looks essential. Is it?`, Yes / No; Yes → `Buy it. Skip one takeaway this week and you're covered.` |
| Go (score < 40) | No panel. A 56px toast pill: `Looks fine. £406 safe after this.` with a mint tick, gone after 3s |

### 5.3 Motion

| What | Values |
|---|---|
| Page behind | `--color-scrim` fades in over 320ms |
| Panel in | `translateX(44px) scale(.96)` → none, opacity 0 → 1, 380ms `--ease-out` |
| Panel out | same path, 240ms |
| Content land | `translateY(8px)` + opacity, 300ms, 50ms stagger |
| Ring | `stroke-dasharray` 700ms `--ease-out`; number counts with requestAnimationFrame, cubic ease-out |
| Popovers | per §3.3; the tile popovers drop from their tile, the why popover slides in from the right |
| Strip | segments grow from the left 600ms after a 220ms delay; on change, segment `left`/`width` and dot `left` transition 500ms |

### 5.4 Files

`apps/web/src/components/nudge/nudge.css`, `NudgeCard.tsx`, `TimelineChart.tsx` (rebuild
as the strip), `NudgeToast.tsx`, `AnimatedNumber.tsx` (keep; tabular nums, cubic
ease-out, ≤ 700ms).

## 6. The dashboard

Routes in `apps/web/src/app/(dashboard)/`. Desktop 1280 max width; phone below 768px.
Every section opens with a page title (28/500) and one muted sentence, then cards that
arrive with a 50ms stagger (`translateY(8px)` + opacity, 340ms).

### Home — `GET /api/home`, `GET /api/timeline`, `GET /api/purchases`
- Header sentence: the insight (`You've regretted 3 of your last 4 late-night clothes
  orders. It's 11:40pm.`). Primary button `Add a rule` opens Profile with the chat
  focused.
- Money card (left, wide): three stat tiles (Safe to spend until next payday, Next
  payday, Next bill with `Covered`). Below: Spend Score `72 /100` with `↗ improving`, one
  sentence, `Reflect on 1 purchase` (primary, or `All caught up`) and `Waiting · 2`;
  the eight-week score bars to the right.
- Right column: Limits this week (three limit pills and `£138 left across your four
  limits.`), then Next 5 weeks (timeline strip).
- Recent purchases: five compact rows with status chips, `See all`.
- Phone: one column. The three tiles become two plus one full width. Score bars sit under
  the score.

### Purchases — `GET /api/purchases`, `PATCH /api/purchases/:id/feedback`, `GET /api/pending-reflections`
- Segmented filter in the header: All, Wants, Essentials, Regretted.
- Reflection card first when one is due: `How do you feel about the zip hoodie now?`,
  merchant, amount, `I guessed 71% regret risk`, three big buttons with icon and word.
  After answering: `All caught up.` and a toast. The rail dot clears.
- Then the full list grouped by day, with the feedback control on every non-essential
  row. Phone: the control wraps to a second line under the name.

### Waiting — `GET /api/waiting`, `PATCH /api/waiting/:id`
- Two-column grid of cards (one column on phone). Each: mark, item, merchant, price;
  a 44px countdown (`09:19:42`, or `11 days` when over 48h) ticking every second;
  `until I ask again · Mon 9 Nov, 9am`; a white flat bar of time elapsed; buttons
  `Wait another day` (primary), `Buy it`, `Remove` (right).
- Leaving cards fade and scale to .97 over 240ms before the grid closes up.
- Empty: `Nothing waiting.` and one line on how things get here.

### Insights — `GET /api/insights`, `GET /api/timeline`
- Row 1, three sentence cards: late night, under pressure (`88%` coral vs `17%`), and
  duplicates. One sentence each plus one muted evidence line.
- Row 2, three bar cards: Regret by category, Risky times (both band-coloured flat bars
  with `3 of 4 regretted` under each), Limits this week (white bars, `£24 of £45`).
- Row 3: Next 5 weeks (strip), Tuned to you (`81%`, per-category rows with the gain in
  mint), Avoided (`£138`, `estimated, this term`, one "could be" sentence).
- Phone: one column, same order.

### Profile — `GET/PUT /api/memory`, `POST /api/memory/chat`
- Left: chat card (640px tall, 520 on phone). Agent opener, then the conversation. Each
  saved change appears as a mint confirmation pill from `changes[]`.
- Right: Money in, Bills, Rules, Summer trip (goal bar in accent). Rows update when the
  chat saves something; an existing bill is updated, not duplicated.

### Existing dashboard components

| File | Restyle to |
|---|---|
| `components/dashboard/timeline.tsx` | The timeline strip (§4) |
| `components/dashboard/bills-calendar.tsx` | Inset `--color-fill` day cells, today ringed in accent, bills as white dots and paydays as mint dots (same as the strip) |
| `components/dashboard/calendar-event-form.tsx` | Fill inputs as pills, primary button `Save` |
| `components/dashboard/spend-score-breakdown.tsx`, `factors.tsx` | Factor rows with flat bars and `points/max`, as in the nudge's details |
| `components/dashboard/score-info.tsx`, `score-examples.tsx` | Popover (§3.3) on hover of the score; no extra cards |
| `components/dashboard/shared.tsx` | Card, Tile, Chip, Button primitives from §3–4 |
| `components/dashboard/motion.css` | Keep only the arrive, bar-grow and popover keyframes from this file |

## 7. Writing

- Sentence case everywhere. No exclamation marks. No "Oops".
- Talk like the friend: `Hold on, this looks like an impulse buy.`,
  `Noted. I'll hold you to it.`, `One less thing.`
- Money: `£412.00` in stat tiles, `£412` elsewhere, `−£206` with a true minus sign.
  Negative balances read `£206 overdrawn`, not `−£206 safe to spend`.
- Dates: `Fri 13 Nov`, `Tue 1 Dec 2026` only when the year is ambiguous. Check
  weekdays: 1 Dec 2026 is a Tuesday.
- Percentages: `82%`. Counts: `3 of 4`. Time: `11:40pm`.
- Button labels say what happens: `Wait until payday`, `Buy it`, `Remove`. The same
  action keeps the same name across the nudge, toast and dashboard.

## 8. Accessibility

- Text 4.5:1 or better (all text tokens pass on the surface; `--color-text-dim` is for
  decimals and large text only).
- Every colour has a word or number beside it.
- Real `<button>`, `<input>` with `<label>`, `aria-label` on icon buttons,
  `aria-pressed` on toggles, `role="status"` on toasts.
- Focus ring: `outline: 2px solid var(--color-text); outline-offset: 2px` on
  `:focus-visible`.
- Touch targets 44px on phone. Inputs 16px on phone.
- Hover content is reachable by tap (timeline dots, score) and by focus.
- Escape closes the nudge.
- Reduced motion and reduced transparency are handled by `tokens.css`; don't override
  them.

## 9. Don't

| Don't | Do |
|---|---|
| Band pills like `High risk` | The number in the band colour plus a plain label |
| Line charts with two series | The timeline strip |
| Gradients, gloss or shadows on bars | Flat fills |
| Floating pieces around the nudge | One glass block |
| Labels under 12px | Fewer words |
| Mono fonts for numbers | Inter with tabular figures |
| Lime as decoration or text colour for paragraphs | Lime on the next action only |
| `transition: all`, `ease-in`, scale from 0 | Named properties, `--ease-out`, scale from .96 |
| The same action twice (`Apply` and `I'll wait`) | One button |
| Hard-coded hex in components | `var(--…)` tokens |

## 10. Prompts for each lane's agent

**Nudge (`apps/web/src/components/nudge/**`)**

> Read docs/DESIGN.md sections 1–5 and open docs/design/nudge-prototype.html. Restyle
> the nudge to match it exactly: one glass block (§3.1 with `--glass-tint-strong`), the
> score ring with the number inside, two stat tiles with flat bars, the timeline strip in
> place of TimelineChart, Show details collapsed, the input pill, and the three buttons
> with "Wait until payday" as the primary and "Buying anyway" locked until a reason is
> sent. Use only tokens from apps/web/src/styles/tokens.css. Apply the motion in §5.3 and
> the popover rules in §3.3, including the stacking fix. Keep the existing API calls and
> host bridge. Verify in /nudge/preview with every scenario, then land.

**Dashboard (`apps/web/src/app/(dashboard)/**`, `apps/web/src/components/dashboard/**`)**

> Read docs/DESIGN.md sections 1–4 and 6 and open docs/design/dashboard.html at desktop
> width and at 375px. Rebuild the dashboard shell (rail on desktop, bottom tab bar under
> 768px) and the five sections to match it, using the glass card, tile, chip, flat bar,
> timeline strip, list row and feedback control from §4. Use only tokens from
> apps/web/src/styles/tokens.css. Restyle the existing components per the table in §6.
> Keep the API calls as they are. Verify every section at 1280 and 375 with no
> horizontal scroll, then land.
