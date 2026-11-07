#!/usr/bin/env bash
# Show every open handoff request assigned to you, with comments. Agents run this at session start.
set -euo pipefail
cd "$(git rev-parse --show-toplevel)"

git fetch --all --prune -q
echo "== Open handoff requests for @$(gh api user --jq .login)"
nums="$(gh issue list --label handoff --assignee @me --state open --json number --jq '.[].number')"
if [ -z "$nums" ]; then
  echo "Inbox empty."
  exit 0
fi
for n in $nums; do
  echo
  echo "----- #$n -----"
  gh issue view "$n" --comments
done
echo
echo "Answer with: ./scripts/answer.sh <number> \"answer text or path/to/file\""
