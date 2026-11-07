# Ajjar — extension, Brain, design, integrator

- **Branches:** `ajjar/extension`, `ajjar/brain`, `ajjar/design` (one per subagent or worktree)
- **Directories:** `apps/extension/**`, `apps/web/src/lib/**`, `apps/web/src/app/api/**`,
  shared files (package.json, lockfile, root layout, globals.css, tokens.css, types.ts,
  host.ts), `docs/INTERFACES.md`, `docs/DESIGN.md`.
- **Tool:** Claude Ultra, subagents in parallel.

## Phase 0 (0:00–0:30)

- Everyone cloned, `npm install`, `npm run dev`, `/api/health` ok. Branches created.
- Ask organisers: submission format, deadline, hacking window.
- `apps/web/.env.example` exists; nobody needs a key in phase 1.

## Phase 1 (0:30–3:00), subagents

1. **Extension** (`apps/extension`): Manifest V3, TypeScript (plain esbuild or no
   bundler). Host permission `https://www.amazon.co.uk/*`. Content script on
   `/gp/buy/*` and `/checkout/*`: confirm "Place your order"/"Buy now" button plus an
   order summary; parse items (name, price, qty), delivery, total, visible pressure
   text; build `AssessRequest`; `POST ${WEB_URL}/api/assess`; inject
   `${WEB_URL}/nudge?assessmentId=…` as a fixed top-right iframe 400px wide; listen for
   `{source:"st-nudge", type:"resize"|"close"|"open"}` and act. One nudge per basket
   hash per tab session. Shortcut `Alt+Shift+N`: force assess; phase 1 cycles
   `GET /api/scenarios`. Popup: safe-to-spend (`/api/home`), pause 1h, open dashboard.
   Load unpacked in chrome://extensions. Phase-1 acceptable shortcut: on the checkout
   URL, match the page total to a scenario's `totalPence` and use `scenarioId`.
2. **Design**: Claude Design file for the nudge and the dashboard → `docs/DESIGN.md`
   → update `tokens.css` → tell Rayan and Aarav to apply component notes.

Integrator duties throughout: land everyone every 45 minutes; answer handoff issues;
add dependencies on request; keep INTERFACES.md and types.ts in sync.

## Phase 2 (3:00–5:00), subagents

3. **Real assess** (`apps/web/src/lib/brain/**`): timeline, necessity (Claude),
   affordability, factors 1–7, reason judgement (Claude), negotiation, reflectionDays
   (Claude), verdict bands; `POST /api/assess` switches to live when
   `BRAIN_MODE=live`; `scenarioId` still works for safety.
4. **Real basket parsing** in the extension (replace the total-matching shortcut).
5. **Spend Score + report** via Claude with deterministic fallback.
6. n8n reflection delivery only if everything else is done.

## Done when

The extension injects the nudge on the Amazon checkout for all five scenarios and then
on a real basket; phase-2 assess returns sensible verdicts; tokens applied; everything
landed on main.

## Status

- Done:
- Not done:
- Next step:
- Open handoff issues:
