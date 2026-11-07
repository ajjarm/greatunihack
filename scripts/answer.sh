#!/usr/bin/env bash
# Answer a handoff issue and close it. Usage: ./scripts/answer.sh <issue-number> "answer text or path/to/file"
set -euo pipefail
cd "$(git rev-parse --show-toplevel)"

n="${1:?usage: ./scripts/answer.sh <issue-number> \"answer text or path/to/file\"}"
ans="${2:?answer text or file path required}"
branch="$(git branch --show-current)"

if [ -f "$ans" ]; then
  # Push the file so the other side (and their agent) can read it straight away.
  git add "$ans"
  git diff --cached --quiet || git commit -q -m "answer #$n: $ans"
  git push -q -u origin "$branch"
  body="$(printf 'Answer is in `%s` on branch `%s` (pushed).\n\nRead it with:\n\n    git fetch && git show origin/%s:%s' \
    "$ans" "$branch" "$branch" "$ans")"
else
  body="$(printf '%s\n\n---\nAnswered from branch `%s` at %s.' "$ans" "$branch" "$(date '+%H:%M')")"
fi

gh issue comment "$n" --body "$body" >/dev/null
gh issue close "$n" >/dev/null
echo "Answered and closed #$n."
