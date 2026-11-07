@AGENTS.md

## Claude Code specifics

- Use the Agent tool for independent chunks so they run in parallel. Give each
  subagent the plan file path and the directory it owns. Never let two subagents
  edit the same file.
- For a second feature that touches different directories, use a worktree
  (`isolation: "worktree"` on the Agent tool, or EnterWorktree) branched from main.
- When asked to "check inbox", run `./scripts/inbox.sh` and handle every open
  handoff issue assigned to the current GitHub user before anything else.
