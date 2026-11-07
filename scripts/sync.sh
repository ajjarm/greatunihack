#!/usr/bin/env bash
# Fetch everything, show what the team is doing, show your inbox. Run at the start of every session.
set -euo pipefail
cd "$(git rev-parse --show-toplevel)"
# shellcheck source=team.sh
source scripts/team.sh

git fetch --all --prune -q

echo "== You are @$(me) on branch $(git branch --show-current)"
echo
echo "== Remote branches, newest first"
git for-each-ref --sort=-committerdate refs/remotes/origin \
  --format='%(committerdate:relative)%09%(authorname)%09%(refname:short)%09%(subject)' | head -15
echo
if git rev-parse --verify -q origin/main >/dev/null; then
  git rev-list --left-right --count origin/main...HEAD \
    | awk '{print "== Your branch is "$1" behind and "$2" ahead of origin/main"}'
  echo
fi
echo "== Open handoff requests assigned to you"
gh issue list --label handoff --assignee @me --state open || true
echo
echo "== Recently answered handoffs (closed)"
gh issue list --label handoff --state closed --limit 5 || true
echo
echo "Read a teammate file without checking out:  git show origin/<branch>:<path>"
echo "See what changed on their branch:           git diff main...origin/<branch> --stat"
