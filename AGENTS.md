# AGENTS.md — how every agent works in this repo

Read this whole file before doing anything. `CLAUDE.md` imports it, so Claude Code,
Codex and any other agent all follow the same rules.

## Context

Great Uni Hack, Manchester, **8 November 2026**, a **6-hour** build. Team of two:
**Ajjar** (GitHub `ajjarm`) and **Zack** (GitHub `Zack-Aftab`).
Goal: **win a sponsor sub-track**, not the main theme. Idea, track and stack are
decided on the day and written in `docs/DECISIONS.md`.

## Read order (every session)

1. `docs/DECISIONS.md` — current idea, target track, stack, what is mocked. If it is
   still a template, stop and ask the human before building anything.
2. `plan/active/*.md` — what is being built right now, by whom, and what "done" means.
3. `./scripts/inbox.sh` — open handoff requests addressed to the current user.
4. `docs/PLAYBOOK.md` — lessons from the last hackathon and the 6-hour timeline.

## Hard rules

- **Everything lives on GitHub.** Push a checkpoint at least every 20 minutes with
  `./scripts/checkpoint.sh "what changed"`. Unpushed work does not exist to your teammate
  or their agent.
- **Read before you ask.** Before asking the teammate for anything, run
  `./scripts/sync.sh` and read their branch yourself (`git show origin/<branch>:<path>`,
  `git diff main...origin/<branch>`). Most questions are answered by reading their code.
- **Ask through the repo, never through chat.** If you still need something only they can
  provide (a decision, an endpoint shape, a key), run `./scripts/ask.sh "title" "details"`.
  It opens a GitHub issue labelled `handoff` assigned to them. Do not block on the answer;
  continue with something independent.
- **Answer the inbox.** At the start of every session, and whenever told "check inbox",
  run `./scripts/inbox.sh`. For each open issue assigned to the current user: read the
  repo and their branch, do the work or write the answer, then
  `./scripts/answer.sh <issue-number> "answer or path/to/file"`. That closes the issue.
- **Stay in your lane.** `plan/active/` names the directories each person owns. Shared
  files (package manifest, lockfile, schema, router, env example) are changed only by
  the owner listed in `docs/DECISIONS.md`, or after a handoff issue says so.
- **Main always runs.** Land to main at least every 45 minutes with
  `./scripts/land.sh`. Short branches, no review gates, no waiting on CI.
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

## Default ownership (adjust in docs/DECISIONS.md tomorrow)

| Who | Owns |
|---|---|
| Ajjar | Architecture, core app build, shared files, pitch delivery |
| Teammate | Track research and fit, pitch deck + script timing, demo data and scenarios, QA walkthrough, second-lane features in their own directory, Codex review |
