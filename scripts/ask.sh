#!/usr/bin/env bash
# Ask a teammate for something through a GitHub issue.
# Usage: ./scripts/ask.sh <who> "title" ["details"]     who = short name from scripts/team.sh, a GitHub handle, or "all"
set -euo pipefail
cd "$(git rev-parse --show-toplevel)"
# shellcheck source=team.sh
source scripts/team.sh

who="${1:?usage: ./scripts/ask.sh <who|all> \"title\" [\"details\"]}"
title="${2:?usage: ./scripts/ask.sh <who|all> \"title\" [\"details\"]}"
details="${3:-}"

if [ "$who" = "all" ]; then
  to="$(others)"
else
  to="$(handle "$who")" || { echo "Unknown teammate '$who'. Roster:"; roster; exit 1; }
fi

branch="$(git branch --show-current)"
body="$(printf '%s\n\n---\nFrom: @%s on branch `%s`, asked at %s.\n\nTo answer: tell your agent "check inbox". It reads the repo and replies with ./scripts/answer.sh <number> "answer or path/to/file".' \
  "$details" "$(me)" "$branch" "$(date '+%H:%M')")"

gh label create handoff --color F59E0B --description "Request between teammates" 2>/dev/null || true
url="$(gh issue create --title "$title" --body "$body" --label handoff --assignee "$to")"
echo "Asked @$to: $url"
