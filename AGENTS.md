# AGENTS.md — how every agent works in this repo

Read this whole file before doing anything. `CLAUDE.md` imports it, so Claude Code,
Codex and any other agent all follow the same rules.

## Context

Great Uni Hack, Manchester, **8 November 2026**, a **6-hour** build. Team of four:
**Ajjar** (GitHub `ajjarm`, integrator), **Zack** (GitHub `Zack-Aftab`), and two more
(handles in `scripts/team.sh`). Goal: **win a sponsor sub-track**, not the main theme.
Idea, track and stack are decided on the day and written in `docs/DECISIONS.md`.

With four people the main risk is collisions, not speed. One person (the integrator)
owns `main` and every shared file; everyone else works in their own directory on their
own branch and lands through `./scripts/land.sh`.

## Read order (every session)

1. `docs/DECISIONS.md` — current idea, target track, stack, what is mocked. If it is
   still a template, stop and ask the human before building anything.
2. `plan/active/*.md` — what is being built right now, by whom, and what "done" means.
3. `./scripts/inbox.sh` — open handoff requests addressed to the current user.
4. `docs/PLAYBOOK.md` — lessons from the last hackathon and the 6-hour timeline.

## Hard rules

- **Everything lives on GitHub.** Push a checkpoint at least every 20 minutes with
  `./scripts/checkpoint.sh "what changed"`. Unpushed work does not exist to your teammates
  or their agents.
- **Read before you ask.** Before asking a teammate for anything, run
  `./scripts/sync.sh` and read their branch yourself (`git show origin/<branch>:<path>`,
  `git diff main...origin/<branch>`). Most questions are answered by reading their code.
- **Ask through the repo, never through chat.** If you still need something only they can
  provide (a decision, an endpoint shape, a key), run
  `./scripts/ask.sh <who> "title" "details"` (who = short name from `scripts/team.sh`, or
  `all`). It opens a GitHub issue labelled `handoff` assigned to them. Do not block on the
  answer; continue with something independent.
- **Answer the inbox.** At the start of every session, and whenever told "check inbox",
  run `./scripts/inbox.sh`. For each open issue assigned to the current user: read the
  repo and their branch, do the work or write the answer, then
  `./scripts/answer.sh <issue-number> "answer or path/to/file"`. That closes the issue.
- **Stay in your lane.** `docs/DECISIONS.md` names the directory each person owns and
  `plan/active/` names the feature in it. Never edit a file in another lane; ask instead.
  Shared files (package manifest, lockfile, schema, router, env example, shared types)
  are changed only by the integrator, or after a handoff issue to the integrator says so.
- **Interfaces first.** Anything two lanes share (an API route shape, a type, a data
  file format) is written down in `docs/INTERFACES.md` before either side builds
  against it. Change it only via a handoff issue so the other side's agent sees it.
- **Main always runs.** Land to main at least every 45 minutes with
  `./scripts/land.sh`. Short branches, no review gates, no waiting on CI. Land one lane
  at a time; if `land.sh` reports a conflict in a shared file, ask the integrator.
- **No secrets in git.** `.env` is ignored. Every key the app needs is listed in
  `.env.example` with an empty value.
- **Demo-first.** A feature that cannot be seen in the demo does not count. If the
  clever part is hidden (AI calls, maths, data pipeline), build the "under the hood"
  view that shows it live. See `docs/PLAYBOOK.md` → "Show the complexity".
- **Working beats perfect.** Mock data and fixtures are fine if `docs/DECISIONS.md`
  says what is mocked. Do not spend time on tests, lint, CI or auth unless the track
  demands it.

## Working method

- Plan in 5 minutes, not 30: write `plan/active/<feature>.md` with goal, owner, files,
  done-when, and how it appears in the demo. Then build.
- Parallelise. In Claude Code, use subagents for independent chunks (UI, API, demo
  data, copy) and git worktrees when two features touch different directories.
- Codex (if available) is the reviewer: adversarial review of the plan, then of the
  code before landing. It does not drive implementation.
- Before landing: run the app, confirm the demo path by hand, note the run command in
  the commit message or `README.md`.
- At handoff or end of session: update `plan/active/<feature>.md` with what is done,
  what is not, and the next step, so the other person's agent can continue.

## Default lanes (confirm names and directories in docs/DECISIONS.md tomorrow)

| Lane | Who | Owns |
|---|---|---|
| Integrator + core | Ajjar | Architecture, scaffold, shared files, `main`, core feature, conflict resolution, pitch delivery |
| Under-the-hood | Zack | The live "show the complexity" panel (trace, numbers, pipeline), demo data and scenarios, demo driving in the pitch |
| Second feature | Person 3 | A self-contained feature in its own directory (sponsor API integration, export, second screen), QA on every landing |
| Track + pitch | Person 4 | Track criteria owner (re-reads the brief, flags drift), deck, script timing, rehearsal, submission form, README, screenshots, backup video, Codex adversarial review |

Lanes are directories, not just topics. Four agents editing four directories do not
collide; four agents editing one `app/` folder will.
