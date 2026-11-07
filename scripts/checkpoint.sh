#!/usr/bin/env bash
# Commit everything and push to your branch. Run every 20 minutes. Usage: ./scripts/checkpoint.sh "message"
set -euo pipefail
cd "$(git rev-parse --show-toplevel)"

msg="${1:-checkpoint $(date '+%H:%M')}"
branch="$(git branch --show-current)"

git add -A
if git diff --cached --quiet; then
  echo "Nothing new to commit on $branch."
else
  git commit -q -m "$msg"
fi

if [ "$branch" = "main" ]; then
  git pull -q --rebase origin main
fi
git push -q -u origin "$branch"
echo "Pushed $branch: $msg"
