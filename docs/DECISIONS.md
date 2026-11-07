# Decisions — Great Uni Hack, 8 Nov 2026

Agents read this after the contract. Everything here is decided unless marked open.

## Track and idea

- **Sponsor track:** BNY ("a financial tool nobody has seen before, for one specific
  type of user"). Bonus challenges: n8n only if time allows in phase 2; ElevenLabs
  dropped. Also entered for the overall prize automatically.
- **Idea:** a money agent for students that watches the screen and steps in at
  checkout with regret risk, real cash impact, factors, and basket negotiation. Full
  spec in `docs/SPEC.md`.
- **Name:** open. Placeholder string lives in one file (`apps/web/src/lib/brand.ts`).
- **User wording:** open between "university students who shop online" and an ADHD
  framing; no medical claims either way.

## Stack

- `apps/web`: Next.js 16 (App Router, src dir), TypeScript, Tailwind 4, npm. One app:
  API routes + nudge page + dashboard. Dev server on :3000.
- `apps/watcher`: Electron + TypeScript, macOS. Local OCR (Apple Vision via Swift
  helper, Tesseract.js fallback). Claude vision for extraction in phase 2.
- Data: JSON fixtures in `data/`, served by an in-memory store. No database on the day.
- AI: Anthropic API (phase 2 only). Key needed by 3:00.
- Hosting: none required; everything runs on the demo Mac. Vercel only if a phone must
  reach the dashboard during judging.
- Run: `cd apps/web && npm install && npm run dev`; `DEMO_FAST_TIMERS=1` for the demo.

## What is real vs mocked (say this to judges)

| Part | Phase 1 | Phase 2 target |
|---|---|---|
| Checkout detection | hotkey cycling scenarios, then OCR keyword gate | OCR gate + Claude vision extraction |
| Scoring | fixture assessments written by Zack | computed: timeline, necessity, affordability, factors 1–7 |
| Reason chat | keyword fallback | Claude judgement |
| Reflection and calibration | real state changes in the in-memory store | same, plus n8n delivery if time |
| Transaction feed | not loaded | n8n from a sheet, Open Banking shape |
| Spend Score | fixture | Claude-judged with fallback |

## Product decisions (from the merge of four specs)

Watcher hero; Chrome extension only as a backup. Two axes (necessity, affordability)
plus regret risk from factors 1–7. Essential: AI prompts when plausible, visible
checkbox when prompted, hidden override otherwise, user wins. No planned/unplanned
question. No mood tracker. No rewards mechanic. Justification chat in. Pressure cues
in, with a dashboard insight. Duplicates automatic from history. Waiting list 24h.
Reflection time chosen by the AI per basket. Any purchase ratable any time. Spend
Score judged by the AI with fixed guidelines. Bank-style feed replaces manual entry.

## Team and tools

| Who | Tool | Lane |
|---|---|---|
| Ajjar (`ajjarm`) | Claude Ultra | Watcher, Brain, design, integrator |
| Rayan (`RayanDeputy`) | Claude Pro | Nudge page |
| Aarav (`aarav-bhatnagar`) | Codex | Dashboard |
| Zack (`Zack-Aftab`) | any | Data, then pitch |

## Decision log

| When | Decision | Why |
|---|---|---|
| 2026-11-07 | Repo scaffolded; idea and stack deferred. | Theme unknown. |
| 2026-11-07 | Team of four; lanes are directories; one integrator. | Four agents on one folder collide. |
| 2026-11-07 | BNY track chosen over Neptune North. | Team is more excited by a product; excitement over six hours is worth real points. |
| 2026-11-07 | Demo-first: fixtures behind the real API from minute zero. | A working demo with fixtures beats a half-working real system. |
| 2026-11-07 | Mac screen Watcher instead of a Chrome extension. | Works in any app; it is the originality claim. |
| 2026-11-07 | ElevenLabs dropped for the day. | Scope. |
