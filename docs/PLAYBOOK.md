# Hackathon Playbook — Great Uni Hack, 8 Nov 2026

Six hours, two people, two AI subscriptions. This file is the strategy. Agents read it
too, so keep it current.

## Lessons from Ox Hack (Oxford, Oct 2026)

| What happened | What we do this time |
|---|---|
| Picked the main theme + platinum sponsor track. Everyone did. Lost in the noise. | **Reverse-engineer the idea from the sub-tracks.** Read every sponsor track first. Pick the one with the fewest likely entrants and the clearest judging criteria. A sponsor-track win is a hackathon win. |
| First idea (freelancer client-time tool) was too niche for a hackathon room. | Niche **track**, big **story**. The track is narrow; the pitch still states a problem a judge recognises in one sentence. |
| App did heavy AI/maths/API work behind the scenes, but the demo looked like a plain app. Judges saw "basic". | **Show the complexity.** Build an "under the hood" view: live log of AI calls, the formula with real numbers updating, a pipeline diagram that lights up, a side-by-side "naive vs ours". The demo must make the clever part visible without us explaining it. |
| Only 60 s with one judge, 2 min with others. No script. Ran out of time. | **Scripted, timed, owned lines.** `docs/PITCH.md` has 60 s / 2 min / 3 min versions. Each line has an owner. Rehearse twice with a timer before judging. |
| Not clear what was different about us. | One sentence, written down by hour 1: "Unlike X, we Y, which means Z." It goes on the first slide, in the README, and is the first thing said. |
| Dev was smooth, 24 h, Claude Ultra. | Now 6 h. Parallelise from minute one: subagents, worktrees, two laptops, two agents, one GitHub repo. |
| Needed info from teammate's code → prompt → email → his AI → copy-paste back. Took ages. | **Push every 20 min; read their branch before asking; ask through a GitHub issue** (`./scripts/ask.sh`). See `docs/GITHUB-WORKFLOW.md`. |

## Choosing the idea (first 30 minutes, non-negotiable)

1. List every track and sponsor prize with its judging criteria and prize. Put it in
   `docs/DECISIONS.md` → Tracks table.
2. Score each track 1–5 on: how few teams will enter it, how clear the criteria are,
   how well a 6-hour demo can hit them, whether a sponsor API/tool is required (using
   the sponsor's tool is usually a big plus for their prize).
3. Pick **one primary sub-track** and at most **one secondary** it also qualifies for.
   Do not enter the main theme unless the idea does so for free.
4. Write the idea as: problem (1 line), who has it, what the demo shows in 90 seconds,
   the differentiator sentence, what the "under the hood" view shows.
5. Lock the stack. Default is whatever gets a demo on screen fastest (see below).

## Six-hour timeline

| Time | Ajjar | Teammate |
|---|---|---|
| 0:00–0:30 | Read tracks together, score, pick. Write `docs/DECISIONS.md`. | Same. Then start the pitch doc skeleton. |
| 0:30–0:45 | Scaffold app, push to main, fill `.env.example`. | Collect/craft demo data and scenarios in `data/` or `fixtures/`. Branch `demo-data`. |
| 0:45–3:30 | Core build in parallel subagents: UI shell, core logic, API/AI layer. Land every 45 min. | Second-lane feature in own directory; test each landing on main; file bugs as handoff issues; draft pitch script. |
| 3:30–4:30 | **"Under the hood" view.** Make the hidden work visible. | Deck + slides, screenshots, README polish. Codex adversarial review of the demo path. |
| 4:30–5:00 | Freeze features. Fix demo path only. | Rehearsal 1 with timer. Fix script. |
| 5:00–5:30 | Submission (Devpost or whatever they use), repo public, README with run steps + screenshots. | Rehearsal 2. Q&A bank in `docs/PITCH.md`. |
| 5:30–6:00 | Buffer. Nothing new. | Buffer. Nothing new. |

Hard freezes: no new feature after 4:30. No code change at all after 5:30 except a
crash on the demo path.

## Show the complexity

Pick at least one of these and build it as a first-class screen, not a console log:

- **Live trace panel**: every AI/API call shown as it happens with input summary,
  latency, output summary. Judges watch the system think.
- **Numbers on screen**: the formula or scoring with live values, and what changes
  when an input changes. Toggle "naive approach" vs "ours" to show the gap.
- **Pipeline diagram** that lights up stage by stage as a real request flows through.
- **Before/after**: the same scenario with the feature off and on, side by side.
- **Confidence / uncertainty** shown honestly. Judges trust honest systems.

Rule: a judge who uses the app alone for 60 seconds, without us, must still see that
something serious is happening.

## Using the AI tools well

**Claude Code (Ajjar, Ultra).**
- One main session drives. It spawns **subagents** (Agent tool) for independent pieces:
  "build the UI shell in `apps/web`", "build the scoring module in `packages/core`
  with fixtures", "write demo data". Each subagent gets a plan file and a directory.
- Use **worktrees** for a second feature that must not collide with the main build.
- Use the browser pane to check the UI, not just unit output.
- Keep a `plan/active/<feature>.md` per lane so any agent can pick it up.

**Codex (teammate's subscription, and Ajjar's).**
- Install the CLI: `npm i -g @openai/codex` then `codex` once to log in.
- Role: **reviewer and second lane**, not primary builder. Prompts that work:
  "Adversarial review of `plan/active/*.md`: what will break in a live demo?" and
  "Review `git diff main` for anything that crashes the demo path."
- Codex reads `AGENTS.md` natively, so it follows the same rules.

**Both laptops.** Teammate runs their own Claude Code or Codex against the same repo on
their own branch. The repo, not chat, is the shared memory.

## Teammate's lane (so two people are faster than one)

The build itself is mostly agent throughput, so the second person's highest-value work
is everything the build agent cannot do:

1. Track-fit owner: keep re-reading the judging criteria and checking the build against
   them. Flag drift early via a handoff issue.
2. Demo data and scenario design: realistic, specific, a little dramatic.
3. QA on every landing to main: run the demo path, file bugs with exact repro.
4. Pitch deck, script timing, rehearsal, Q&A bank.
5. A self-contained second feature in its own directory (e.g. the "under the hood"
   panel, an export, an integration with the sponsor's API).
6. Codex adversarial review before freeze.

## Stack default (confirm tomorrow)

Unless the track demands otherwise: Next.js (App Router) + TypeScript + Tailwind, single
app, `npm`, deployed to Vercel in the last hour if a public URL helps. AI via the
Anthropic SDK. Data in memory or SQLite unless persistence is part of the pitch. Record
the final choice in `docs/DECISIONS.md`.
