# Hackathon Playbook — Great Uni Hack, 8 Nov 2026

Six hours, four people, four laptops, Claude Ultra plus Codex. This file is the
strategy. Agents read it too, so keep it current.

## Lessons from Ox Hack (Oxford, Oct 2026)

| What happened | What we do this time |
|---|---|
| Picked the main theme + platinum sponsor track. Everyone did. Lost in the noise. | **Reverse-engineer the idea from the sub-tracks.** Read every sponsor track first. Pick the one with the fewest likely entrants and the clearest judging criteria. A sponsor-track win is a hackathon win. |
| First idea (freelancer client-time tool) was too niche for a hackathon room. | Niche **track**, big **story**. The track is narrow; the pitch still states a problem a judge recognises in one sentence. |
| App did heavy AI/maths/API work behind the scenes, but the demo looked like a plain app. Judges saw "basic". | **Show the complexity.** Build an "under the hood" view: live log of AI calls, the formula with real numbers updating, a pipeline diagram that lights up, a side-by-side "naive vs ours". The demo must make the clever part visible without us explaining it. |
| Only 60 s with one judge, 2 min with others. No script. Ran out of time. | **Scripted, timed, owned lines.** `docs/PITCH.md` has 60 s / 2 min / 3 min versions. Each line has an owner. Rehearse twice with a timer before judging. |
| Not clear what was different about us. | One sentence, written down by hour 1: "Unlike X, we Y, which means Z." It goes on the first slide, in the README, and is the first thing said. |
| Dev was smooth, 24 h, Claude Ultra. | Now 6 h. Parallelise from minute one: subagents, worktrees, four laptops, four lanes in four directories, one GitHub repo. |
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

## Six-hour timeline (four lanes)

| Time | Ajjar (integrator + core) | Zack (under-the-hood + demo data) | Rayan (second feature + QA) | Aarav (track + pitch) |
|---|---|---|---|---|
| 0:00–0:30 | All four: read every track, score, pick. Ajjar writes `docs/DECISIONS.md`. | Same. | Same. | Same, and starts the pitch skeleton. |
| 0:30–0:50 | Scaffold app, push to main, fill `.env.example`, write `docs/INTERFACES.md` (directory map, route shapes, shared types). | Design demo scenarios; build `data/` fixtures on branch `zack/demo-data`. | Read INTERFACES.md; plan the second feature in `plan/active/`. | Write the one sentence; set up submission page; collect sponsor logos/criteria. |
| 0:50–3:30 | Core feature in parallel subagents. Land every 45 min. Resolve anyone's shared-file conflicts. | Build the live "under the hood" panel against the interfaces, with fixture data first, real events once core lands. | Build the second feature in its own directory. After every landing on main: run the demo path, file bugs with `ask.sh`. | Deck, script, screenshots as screens appear. Re-read judging criteria at 1:30 and 2:30, flag drift with `ask.sh all`. |
| 3:30–4:30 | Wire core → panel for real. Fix integration bugs. | Polish panel: timing, labels, the "naive vs ours" toggle. | Codex adversarial review of the demo path; fix own lane. | Rehearsal 1 with a timer. Cut lines. |
| 4:30–5:00 | **Feature freeze.** Demo path only. | Record backup video of the demo. | QA on the frozen build; report only crashes. | Rehearsal 2. Q&A bank. |
| 5:00–5:30 | Repo public, README final. | Screenshots into README. | Submission form filled with Aarav. | Submit. Confirm it went through. |
| 5:30–6:00 | Buffer. Nothing new. | Buffer. | Buffer. | Buffer. |

Hard freezes: no new feature after 4:30. No code change at all after 5:30 except a
crash on the demo path. Only the integrator touches shared files, ever.

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

**Codex (Zack's subscription and Ajjar's; anyone can install it).**
- Install the CLI: `npm i -g @openai/codex` then `codex` once to log in.
- Role: **reviewer and second lane**, not primary builder. Prompts that work:
  "Adversarial review of `plan/active/*.md`: what will break in a live demo?" and
  "Review `git diff main` for anything that crashes the demo path."
- Codex reads `AGENTS.md` natively, so it follows the same rules.

**All four laptops.** Everyone runs their own Claude Code or Codex against the same repo
on their own branch, in their own directory. The repo, not chat, is the shared memory.

## Four lanes (so four people are faster than one, not slower)

With four people the danger is four agents editing the same files. So lanes are
directories, with one integrator holding `main` and the shared files:

1. **Integrator + core (Ajjar).** Scaffold, shared files, `docs/INTERFACES.md`, the
   core feature, resolving conflicts, landing order. If two lanes need the same shared
   change, Ajjar makes it and lands it immediately.
2. **Under-the-hood + demo data (Zack).** The panel that makes the clever part visible,
   built first against fixtures so it never blocks on core. Demo scenarios: realistic,
   specific, a little dramatic. Drives the demo in the pitch.
3. **Second feature + QA (Rayan).** One self-contained feature in its own directory
   (sponsor API integration, export, a second screen). After every landing on main,
   runs the demo path and files bugs with exact repro via `ask.sh`.
4. **Track + pitch (Aarav).** Owns the judging criteria and re-reads them on the hour.
   Deck, script timing, rehearsals, Q&A bank, submission form, README, screenshots,
   backup video, Codex adversarial review before freeze.

Rules that keep four lanes from colliding:

- Shared shapes go in `docs/INTERFACES.md` before anyone builds against them.
- Nobody edits another lane's directory. Post a handoff instead; it takes 30 seconds and the owner keeps their lane coherent.
- Land one lane at a time, every 45 minutes, smallest branch first.
- A lane that is blocked on another lane builds against fixtures, never waits.

## Stack default (confirm tomorrow)

Unless the track demands otherwise: Next.js (App Router) + TypeScript + Tailwind, single
app, `npm`, deployed to Vercel in the last hour if a public URL helps. AI via the
Anthropic SDK. Data in memory or SQLite unless persistence is part of the pitch. Record
the final choice in `docs/DECISIONS.md`.
