#!/usr/bin/env bash
# Bring your branch onto main and push. Run every ~45 minutes. Leaves you on your branch, up to date with main.
set -euo pipefail
cd "$(git rev-parse --show-toplevel)"

branch="$(git branch --show-current)"
if [ "$branch" = "main" ]; then
  git add -A; git diff --cached --quiet || git commit -q -m "wip $(date '+%H:%M')"
  git pull -q --rebase origin main
  git push -q origin main
  echo "main is pushed and up to date."
  exit 0
fi

git add -A
git diff --cached --quiet || git commit -q -m "wip before land $(date '+%H:%M')"

git fetch -q origin
# Merge main into the branch first so any conflict is resolved here, not on main.
if ! git merge --no-edit origin/main; then
  echo
  echo "CONFLICT. Fix the files listed above, then: git add -A && git commit && ./scripts/land.sh"
  exit 1
fi
git push -q -u origin "$branch"

git checkout -q main
git pull -q --ff-only origin main
git merge -q --no-ff -m "land: $branch" "$branch"
git push -q origin main
git checkout -q "$branch"
git merge -q --ff-only main

echo "Landed $branch onto main and pushed. You are back on $branch."
