# Decisions — Great Uni Hack, 8 Nov 2026

Agents read this after the contract. Everything here is decided unless marked open.

## Track and idea

- **Sponsor track:** BNY ("a financial tool nobody has seen before, for one specific
  type of user"). Bonus challenges: none. n8n and ElevenLabs both dropped (7 Nov evening). Also entered for the overall prize automatically.
- **Idea:** a money agent for students that watches the screen and steps in at
  checkout with regret risk, real cash impact, factors, and basket negotiation. Full
  spec in `docs/SPEC.md`.
- **Name:** open. Placeholder string lives in one file (`apps/web/src/lib/brand.ts`).
- **User wording:** open between "university students who shop online" and an ADHD
  framing; no medical claims either way.

## Stack

- `apps/web`: Next.js 16 (App Router, src dir), TypeScript, Tailwind 4, npm. One app:
  API routes + nudge page + dashboard. Dev server on :3000.
- `apps/extension`: Chrome extension, Manifest V3, host permission for amazon.co.uk
  only. Reads the checkout page, calls the API, injects the nudge page as an iframe.
- Data: JSON fixtures in `data/`, served by an in-memory store. No database on the day.
- AI: Anthropic API (phase 2 only). Key needed by 3:00.
- Hosting: none required; everything runs on the demo Mac. Vercel only if a phone must
  reach the dashboard during judging.
- Run: `cd apps/web && npm install && npm run dev`; `DEMO_FAST_TIMERS=1` for the demo.

## What is real vs mocked (say this to judges)

| Part | Phase 1 | Phase 2 target |
|---|---|---|
| Checkout detection | extension on the Amazon checkout URL, scenarios matched by total | real basket parsed from the page |
| Scoring | fixture assessments written by Zack | computed: timeline, necessity, affordability, factors 1–7 |
| Reason chat | keyword fallback | Claude judgement |
| Reflection and calibration | real state changes in the in-memory store | same (reflection prompt lives on the dashboard) |
| Transaction feed | not loaded | endpoint exists; no feed on the day |
| Spend Score | fixture | Claude-judged with fallback |

## Product decisions (from the merge of four specs)

Chrome extension scoped to Amazon (screen watcher dropped: privacy comfort). Two axes (necessity, affordability)
plus regret risk from factors 1–7. Essential: AI prompts when plausible, visible
checkbox when prompted, hidden override otherwise, user wins. No planned/unplanned
question. No mood tracker. No rewards mechanic. Justification chat in. Pressure cues
in, with a dashboard insight. Duplicates automatic from history. Waiting list 24h.
Reflection time chosen by the AI per basket. Any purchase ratable any time. Spend
Score judged by the AI with fixed guidelines. Bank-style feed replaces manual entry.

## Team and tools

| Who | Tool | Lane |
|---|---|---|
| Ajjar (`ajjarm`) | Claude Ultra | Extension, Brain, design, integrator |
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
| 2026-11-07 | Chrome extension scoped to Amazon instead of a Mac screen watcher. | A teammate was not comfortable with screen watching; judges may not be either. Narrow permission, every other feature kept. |
| 2026-11-07 | ElevenLabs dropped for the day. | Scope. |
