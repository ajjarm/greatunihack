# Zack — the data, then the pitch

- **Branch:** `zack/data`
- **Directories:** `data/**` until 2:30; then `docs/PITCH.md`, `README.md`, `public/pitch/**`.
- **Reads first:** `AGENTS.md`, `docs/MOCK-DATA-GUIDE.md`, `docs/INTERFACES.md` sections 4 and 7, `apps/web/src/lib/types.ts`.

## Goal

The fixture data is the demo's brain for the first three hours. Make Sam real.

## Steps

1. `cd apps/web && npm install && npm run check:data` — the starter data passes. Keep
   it passing after every change.
2. Expand `data/purchases.json` to ~60 purchases over 90 days with every pattern in the
   guide's "Patterns the demo depends on" list.
3. Expand `assessments-history.json` to ~20.
4. Make the five scenarios in `scenarios.json` complete and consistent (all variants
   named in the guide). The text is what the judge reads: friendly, specific, short.
5. `home.json`, `insights.json`, `report.json`, `timeline.json`, `waiting.json`,
   `calibration.json` consistent with the purchases.
6. `feed-rows.csv`: six bank-style rows for the live n8n demo.
7. v1 landed by 1:30 (`./scripts/land.sh`), final by 2:30.
8. Then: pitch script timings in `docs/PITCH.md`, slides, README with screenshots,
   backup video at 4:00, QA on every landing, two rehearsals.

## Done when

`npm run check:data` passes; the nudge and dashboard look real with your data; the
five scenarios produce the expected verdicts listed in the guide.

## Prompt to paste into your agent

> Read docs/MOCK-DATA-GUIDE.md, docs/INTERFACES.md sections 4 and 7, and
> apps/web/src/lib/types.ts. You own only the data/ directory. Expand the starter
> fixture files into the full persona described in the guide, keeping every pattern in
> the "Patterns the demo depends on" list and keeping all numbers consistent across
> files. Run `npm run check:data` in apps/web after every change and fix whatever it
> reports. All text friendly, short, specific, no exclamation marks. Do not edit any
> file outside data/.

## Status

- Done:
- Not done:
- Next step:
- Open handoff issues:
