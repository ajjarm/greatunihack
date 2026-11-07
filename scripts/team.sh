#!/usr/bin/env bash
# Team roster: short-name:GitHub-handle. Fill in the two blank handles tomorrow.
# ask.sh uses the short names: ./scripts/ask.sh zack "title" "details"
TEAM="ajjar:ajjarm zack:Zack-Aftab person3: person4:"

me() { gh api user --jq .login 2>/dev/null; }

# handle <short-name-or-handle>  ->  GitHub handle
handle() {
  local q pair name h
  q="$(printf %s "$1" | tr '[:upper:]' '[:lower:]')"
  for pair in $TEAM; do
    name="${pair%%:*}"; h="${pair#*:}"
    if [ "$name" = "$q" ] || [ "$(printf %s "$h" | tr '[:upper:]' '[:lower:]')" = "$q" ]; then
      [ -n "$h" ] && echo "$h" && return 0
      return 1
    fi
  done
  return 1
}

# everyone except the current user, comma-separated (for "ask all")
others() {
  local m pair h out=""
  m="$(me)"
  for pair in $TEAM; do
    h="${pair#*:}"
    [ -n "$h" ] && [ "$h" != "$m" ] && out="${out:+$out,}$h"
  done
  echo "$out"
}

roster() { local pair; for pair in $TEAM; do printf '  %-8s @%s\n' "${pair%%:*}" "${pair#*:}"; done; }
