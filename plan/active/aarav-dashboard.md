# Aarav — the dashboard

- **Branch:** `aarav/dashboard`
- **Directories:** `apps/web/src/app/(dashboard)/**`, `apps/web/src/components/dashboard/**`. Nothing else.
- **Tool:** Codex.
- **Reads first:** `AGENTS.md`, `docs/INTERFACES.md` (sections 4, 5, 8), `apps/web/src/lib/types.ts`, `docs/SPEC.md` section 4.3.

## Goal

Five routes under a `(dashboard)` route group with their own layout (bottom tab bar on
phones, left nav on desktop), all reading from the API, looking like an app on a phone.

## Steps

1. `src/app/(dashboard)/layout.tsx` with the nav. Routes: `/home`, `/purchases`,
   `/waiting`, `/insights`, `/profile`. (Do not touch `src/app/page.tsx` or
   `src/app/layout.tsx`; they are Ajjar's.)
2. `/home` from `GET /api/home`: Spend Score dial (band colour + text label), trend,
   explanation on tap; balance; safe to spend; days to next income; next bill; the
   insight sentence; recent assessments; pending-reflections banner.
3. `/purchases` from `GET /api/purchases`: grouped by day, newest first; category and
   feedback filters; feedback control per row → `PATCH /api/purchases/:id/feedback`;
   rows with a due reflection show the prompt first.
4. `/waiting` from `GET /api/waiting`: countdown cards; buy / wait / remove →
   `PATCH /api/waiting/:id`.
5. `/insights` from `GET /api/insights` and `GET /api/timeline`: sentence cards; regret
   by category bars; risky windows; pressure sentence; duplicates; limits bars;
   avoided (labelled estimated) with "could be" lines; calibration overall and per
   category with delta; timeline chart (plain SVG); live agent log.
6. `/profile` from `GET/PUT /api/memory` and `POST /api/memory/chat`: chat UI with
   `changes[]` chips; structured view of incomes, outgoings, limits, rules, goal.
7. Phone layout first (375px), desktop second. Only `tokens.css` variables for colour,
   radius, shadow, font, motion; Tailwind for layout.
8. Later (phase 2): apply `docs/DESIGN.md` notes when Ajjar lands it.

## Done when

Every number on every tab comes from the API; giving feedback on a purchase changes
the calibration shown on Insights; the chat shows changes; looks right at 375px and
1280px; nothing hard-coded in colour.

## Ask Ajjar for

Missing fields; dependencies (prefer none; plain SVG for charts).

## Prompt to paste into your agent

> Read AGENTS.md, docs/INTERFACES.md, apps/web/src/lib/types.ts and
> plan/active/aarav-dashboard.md. You own only apps/web/src/app/(dashboard) and
> apps/web/src/components/dashboard. Build the five dashboard routes exactly as in
> docs/SPEC.md section 4.3 against the running API (npm run dev in apps/web). Phone
> layout first. Use only the CSS variables in apps/web/src/styles/tokens.css for
> colour, radius, shadow, font and motion; Tailwind for layout only. Never import from
> data/ and never invent fields that are not in types.ts. Do not edit any file outside
> your two directories; if you need something, stop and tell me what to ask Ajjar for.
> Commit with ./scripts/checkpoint.sh every 20 minutes.

## Status

- Done:
- Not done:
- Next step:
- Open handoff issues:
