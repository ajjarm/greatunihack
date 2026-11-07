# Watcher (macOS menu-bar agent) — Ajjar's lane

Electron + TypeScript. See `plan/active/ajjar-watcher-brain.md` and `docs/SPEC.md` 4.1.

Loads `${WEB_URL}/nudge?assessmentId=…` (default `http://localhost:3000`) in a
frameless always-on-top window, 400px wide, top-right. Preload exposes
`window.watcher = { close, resize, openDashboard }` (see `docs/INTERFACES.md` section 6).

Scaffolded during phase 1 by Ajjar's subagent. Nobody else edits this directory.
