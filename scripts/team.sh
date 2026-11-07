#!/usr/bin/env bash
# Team GitHub handles. Sourced by the other scripts. Fill in TEAMMATE tomorrow.
AJJAR="ajjarm"
TEAMMATE="Zack-Aftab"

me() { gh api user --jq .login 2>/dev/null; }

other() {
  local m
  m="$(me)"
  if [ "$m" = "$AJJAR" ]; then echo "$TEAMMATE"; else echo "$AJJAR"; fi
}
