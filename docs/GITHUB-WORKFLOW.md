# GitHub workflow for two people and their agents

The repo is the shared brain. Chat, email and copy-paste are not. This is the whole
flow; it takes five minutes to learn.

## One-time setup (both of you, tonight or at the start)

```bash
# 1. GitHub CLI, logged in
brew install gh
gh auth login            # choose GitHub.com, HTTPS, login with browser

# 2. Clone
gh repo clone ajjarm/greatunihack
cd greatunihack

# 3. Tell the scripts who you are (teammate: add your handle in scripts/team.sh)
./scripts/sync.sh        # prints branches and your open inbox; if this works, you are set
```

Teammate must be added as a collaborator (Ajjar runs
`gh repo add-collaborator`... see "Admin" below) and must accept the invite email.

## Every working session

```bash
./scripts/sync.sh                      # fetch everything, show teammate branches, show inbox
git checkout -b <yourname>/<feature>   # one short branch per feature, from main
# ... build with your agent ...
./scripts/checkpoint.sh "ui shell + routing"   # every 20 min: add, commit, push
./scripts/land.sh                      # every ~45 min: merge main in, push, merge to main, push
```

`checkpoint.sh` commits and pushes to your branch. `land.sh` brings your branch onto
main and leaves you back on your branch, rebased on the new main. If `land.sh` reports a
conflict, fix the files it lists, `git add` them, and run it again.

## Getting information from the other person's code

This replaced "prompt → email → their AI → copy-paste back".

**Step 1, read it yourself (works 80% of the time).** Their agent pushes every 20
minutes, so their work is on GitHub. Tell your agent:

> Run ./scripts/sync.sh, then read origin/<their-branch> and tell me how the scoring API
> is shaped.

The agent runs things like `git diff main...origin/<branch> --stat` and
`git show origin/<branch>:src/api/score.ts`. No human in the loop.

**Step 2, ask through the repo (the other 20%).** When you need a decision or something
not yet written:

```bash
./scripts/ask.sh "Need the shape of the /score response" "I'm building the results panel in apps/web/results. What fields come back and is latency included?"
```

That opens a GitHub issue labelled `handoff`, assigned to the other person. GitHub
emails and push-notifies them. Carry on with something else.

**Step 3, the other side answers from their agent.** They say "check inbox" to their
agent. `AGENTS.md` tells the agent to run `./scripts/inbox.sh`, read the request, look
at the code, and reply with `./scripts/answer.sh <number> "answer or path/to/file"`,
which comments and closes the issue. If the answer is a file, the agent commits it,
pushes, and the answer names the path.

**Step 4, you read the answer.** `./scripts/sync.sh` shows closed handoffs from the last
hour with their final comment, or `gh issue view <number>`.

## Optional, fully automated answering (test in the first 15 minutes)

`.github/workflows/claude-handoff.yml` makes Claude answer any issue or comment that
mentions `@claude`, reading the repo on GitHub, with no human in the loop. It needs one
repository secret:

```bash
claude setup-token                          # prints a long-lived token for your subscription
gh secret set CLAUDE_CODE_OAUTH_TOKEN       # paste it
```

Then open an issue containing `@claude what does the scoring module export?` and
watch the Actions tab. If this works, handoff questions can be answered without either
human touching their agent. If it does not work within 15 minutes, ignore it; steps 1–4
above do not depend on it.

## Avoiding conflicts

- Directories are owned (see `docs/DECISIONS.md`). Stay in yours.
- Shared files (package manifest, lockfile, schema, router, `.env.example`) are owned by
  Ajjar. Need a dependency? Ask via `ask.sh`, or add it and land immediately so the
  other side picks it up on the next sync.
- Land small and often. A 45-minute branch merges in seconds; a 3-hour branch does not.
- Never force-push main.

## Admin (Ajjar)

```bash
gh repo add-collaborator <teammate-handle>   # if gh supports it; otherwise Settings → Collaborators
gh repo edit --visibility public             # at submission time, for judges and LinkedIn
```
