# SecondThought — Great Uni Hack 2026, BNY track

> Unlike budgeting apps that tell you what you spent last month, it steps in at the
> checkout, knows what your rent and payday do to this purchase, and tells you what to
> drop instead of saying no.

**Team:** Ajjar Mansoor, Zack Aftab, Rayan Deputy, Aarav Bhatnagar · **Built in 6 hours, 8 Nov 2026, Manchester**

## What it does

A money agent for students that lives on your Mac. It watches your screen and, the
moment you reach a checkout, steps in with a predicted regret risk, the real impact on
your money before your next income, the factors that matter, and which item to drop
instead of saying no. It learns from how you feel about purchases later and shows you
how well it has learned you.

## Run it

```bash
cd apps/web && npm install && DEMO_FAST_TIMERS=1 npm run dev
```

Then open http://localhost:3000 for the index, `/nudge?scenario=scn_1_impulse` for
the nudge, `/home` for the dashboard. The Chrome extension is in `apps/extension`
(load unpacked from chrome://extensions).

## Start here (team)

1. `./scripts/sync.sh`
2. Read `AGENTS.md`, `docs/INTERFACES.md`, `apps/web/src/lib/types.ts`, then your file
   in `plan/active/`.
3. Paste the prompt at the bottom of your plan file into your agent.

## Repo guide

| Path | What |
|---|---|
| `docs/SPEC.md` | The product, the demo-first phases, per-person instructions. |
| `docs/INTERFACES.md` | The contract: directories, API, fixture shapes, tokens. |
| `docs/MOCK-DATA-GUIDE.md` | Zack's guide to the fixture data. |
| `docs/DECISIONS.md` | What is decided, what is mocked, who is on what. |
| `docs/PITCH.md` | Timed, owned pitch script and Q&A bank. |
| `docs/GITHUB-WORKFLOW.md` | How four people and their agents share this repo. |
| `docs/TRACK-ANALYSIS.md` | Every track and idea scored. |
| `plan/active/` | One file per person: directories, steps, done-when, the prompt. |
| `apps/web` | Next.js: API + nudge page + dashboard. |
| `apps/extension` | Chrome extension (Amazon checkout → API → nudge iframe). |
| `data/` | Fixture data (the demo's brain in phase 1). |
| `scripts/` | `sync`, `checkpoint`, `land`, `ask`, `inbox`, `answer`. |

## Screenshots

[nudge] · [show more] · [dashboard home]
