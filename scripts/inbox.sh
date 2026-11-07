#!/usr/bin/env bash
# Show every open handoff request assigned to you, with comments. Agents run this at session start.
set -euo pipefail
cd "$(git rev-parse --show-toplevel)"

git fetch --all --prune -q
echo "== Open handoff requests for @$(gh api user --jq .login)"
list() { gh issue list --label handoff --assignee @me --state open --json number --jq '.[].number'; }
nums="$(list)"
# GitHub's search index lags a few seconds after an issue is created; try once more.
if [ -z "$nums" ]; then sleep 4; nums="$(list)"; fi
if [ -z "$nums" ]; then
  echo "Inbox empty."
  exit 0
fi
for n in $nums; do
  echo
  echo "----- #$n -----"
  gh issue view "$n" --json number,title,author,body,comments --template '#{{.number}} {{.title}} (from @{{.author.login}})
{{.body}}
{{range .comments}}
> @{{.author.login}}: {{.body}}
{{end}}'
done
echo
echo "Answer with: ./scripts/answer.sh <number> \"answer text or path/to/file\""
