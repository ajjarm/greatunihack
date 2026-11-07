# Ajjar — Watcher, Brain, design, integrator

- **Branches:** `ajjar/watcher`, `ajjar/brain`, `ajjar/design` (one per subagent or worktree)
- **Directories:** `apps/watcher/**`, `apps/web/src/lib/**`, `apps/web/src/app/api/**`,
  shared files (package.json, lockfile, root layout, globals.css, tokens.css, types.ts),
  `docs/INTERFACES.md`, `docs/DESIGN.md`.
- **Tool:** Claude Ultra, subagents in parallel.

## Phase 0 (0:00–0:30)

- Everyone cloned, `npm install`, `npm run dev`, `/api/health` ok. Branches created.
- Ask organisers: submission format, deadline, hacking window.
- Create `apps/web/.env.example` with `ANTHROPIC_API_KEY=`, `DEMO_FAST_TIMERS=1`.

## Phase 1 (0:30–3:00), three subagents

1. **Watcher shell** (`apps/watcher`): Electron + TypeScript. Menu-bar (Tray) app, no
   dock icon. Frameless always-on-top BrowserWindow 400 wide at top-right loading
   `${WEB_URL}/nudge?...`. Preload exposes `window.watcher = {close, resize,
   openDashboard}`. Global hotkey ⌃⌥N: in phase 1 cycles `GET /api/scenarios` and opens
   `/nudge?scenario=<id>`. Tray menu: safe-to-spend (from `/api/home`), pause 1h, open
   dashboard, quit.
2. **Detection** (`apps/watcher/src/detect`): every 2s `screencapture -x` to a temp
   file; OCR via a Swift helper using Apple Vision (`swiftc` one file) with Tesseract.js
   fallback; keyword gate; basket hash from OCR lines; on hit, `POST /api/assess` with
   `source: "watcher"`, items parsed from OCR lines as best effort in phase 1
   (`scenarioId` matching by merchant keyword is acceptable for the demo), open the
   window with the returned id. One nudge per basket hash per session.
3. **Design**: Claude Design file for the nudge and the dashboard → `docs/DESIGN.md`
   → update `tokens.css` → tell Rayan and Aarav to apply component notes.

Integrator duties throughout: land everyone every 45 minutes; answer handoff issues;
add dependencies on request; keep INTERFACES.md and types.ts in sync.

## Phase 2 (3:00–5:00), subagents

4. **Real assess** (`apps/web/src/lib/brain/**`): timeline, necessity (Claude), affordability,
   factors 1–7, reason judgement (Claude), negotiation, reflectionDays (Claude),
   verdict bands; `POST /api/assess` switches from fixture to live when
   `BRAIN_MODE=live`; scenarios still available via `scenarioId` for safety.
5. **Vision extraction**: screenshot → Claude vision → `AssessRequest` (items, total,
   cues). Replace the phase-1 OCR parsing.
6. **Spend Score + report** via Claude with deterministic fallback.
7. Backup extension via subagent only if the Watcher is shaky.

## Done when

Hotkey and OCR open the nudge over Amazon and Steam; five scenarios run end to end;
phase-2 assess returns sensible verdicts on a real Amazon basket; tokens applied;
everything landed on main.

## Status

- Done:
- Not done:
- Next step:
- Open handoff issues:
