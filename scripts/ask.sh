#!/usr/bin/env bash
# Ask your teammate for something through a GitHub issue. Usage: ./scripts/ask.sh "title" ["details"]
set -euo pipefail
cd "$(git rev-parse --show-toplevel)"
# shellcheck source=team.sh
source scripts/team.sh

title="${1:?usage: ./scripts/ask.sh \"title\" [\"details\"]}"
details="${2:-}"
to="$(other)"
if [ -z "$to" ]; then
  echo "Set TEAMMATE in scripts/team.sh first."
  exit 1
fi

branch="$(git branch --show-current)"
body="$(printf '%s\n\n---\nFrom: @%s on branch `%s`, asked at %s.\n\nTo answer: tell your agent "check inbox". It reads the repo and replies with ./scripts/answer.sh <number> "answer or path/to/file".' \
  "$details" "$(me)" "$branch" "$(date '+%H:%M')")"

gh label create handoff --color F59E0B --description "Request between teammates" 2>/dev/null || true
url="$(gh issue create --title "$title" --body "$body" --label handoff --assignee "$to")"
echo "Asked @$to: $url"
