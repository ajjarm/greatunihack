# Rayan — the nudge page

- **Branch:** `rayan/nudge`
- **Directories:** `apps/web/src/app/nudge/**`, `apps/web/src/components/nudge/**`. Nothing else.
- **Tool:** Claude Pro. If you hit the limit, tell Ajjar; you move to QA and rehearsals.
- **Reads first:** `AGENTS.md`, `docs/INTERFACES.md` (sections 4, 6, 8), `apps/web/src/lib/types.ts`, `docs/SPEC.md` section 4.2.

## Goal

A page at `/nudge` that renders an `Assessment` as the floating card the judge sees,
with real API calls for every button, working both inside the extension's iframe
(host messages via `host.ts`) and in a normal browser tab (messages are no-ops).

## Steps

1. Scaffold `src/app/nudge/page.tsx` (client component) + `src/components/nudge/*`.
   Read `?assessmentId=` or `?scenario=`; for `scenario`, `POST /api/assess` with
   `{scenarioId, source:"demo", merchant:"", items:[], deliveryPence:0, totalPence:0,
   cues:[], capturedAt:new Date().toISOString(), basketHash:"demo"}` then render.
2. Render the full card in the order in SPEC 4.2 with fixture scenario 1. Use only
   `tokens.css` variables for colour, radius, shadow, font, motion.
3. Wire buttons: negotiate → `POST /api/assessments/:id/negotiate`; reason →
   `POST .../reason`; essential chip and prompt → `PATCH .../essential`; I'll wait /
   Buying anyway / Dismiss → `PATCH .../decision` then `hostClose()` from
   `apps/web/src/lib/host.ts`. Re-render from the returned assessment; animate number
   changes.
4. Show more section: reasoning, per-item factors with points/max, timeline mini
   chart (simple SVG, income and bill markers, before and after lines), calibration.
5. Toast variant for `verdict === "go_ahead"`; call `hostResize(72)`; auto-close 3s.
6. Call `hostResize(document.body.scrollHeight)` after every render.
7. Keyboard: tab order, Escape = Dismiss, focus visible. Reduced motion respected.
8. Check all five scenarios: `/nudge?scenario=scn_1_impulse` … `scn_5_deal`.
9. Later (phase 2): apply `docs/DESIGN.md` component notes when Ajjar lands it.

## Done when

All five scenarios render correctly; negotiate, reason, essential and decisions all
round-trip through the API and update the card; the toast variant works; the page
works with and without the bridge; Escape closes; nothing is hard-coded in colour.

## Post a handoff for

Any field missing from `Assessment`; any dependency (charts libs etc. — prefer plain
SVG); any change to the bridge.

## Prompt to paste into your agent

> Read AGENTS.md, docs/INTERFACES.md, apps/web/src/lib/types.ts and
> plan/active/rayan-nudge.md. You own only apps/web/src/app/nudge and
> apps/web/src/components/nudge. Build the nudge page exactly as specified in
> docs/SPEC.md section 4.2 against the running API (npm run dev in apps/web). Use only
> the CSS variables in apps/web/src/styles/tokens.css for colour, radius, shadow, font
> and motion; Tailwind for layout only. Start with /nudge?scenario=scn_1_impulse, then
> make all five scenarios work. Every button must call the API and re-render from the
> response. Do not edit any file outside your two directories; if you need something,
> pause and tell me so we can post it as a contract change for the integrator to merge,
> which keeps all three UIs consistent. Commit with ./scripts/checkpoint.sh every 20
> minutes.

## Status

- Done:
- Not done:
- Next step:
- Open handoff issues:
