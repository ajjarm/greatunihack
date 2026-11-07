# Chrome extension — Ajjar's lane

Manifest V3, host permission for `https://www.amazon.co.uk/*` only. See `docs/SPEC.md`
4.1 and `plan/active/ajjar-extension-brain.md`.

- Content script runs on Amazon checkout URLs (`/gp/buy/*`, `/checkout/*`), confirms
  the page has a "Place your order" button and an order summary, reads item names and
  prices, builds an `AssessRequest`, calls `POST ${WEB_URL}/api/assess`, and injects
  `${WEB_URL}/nudge?assessmentId=…` as a fixed top-right iframe (400px wide).
- Listens for `{source:"st-nudge", type:"resize"|"close"|"open"}` messages from the
  iframe (see `docs/INTERFACES.md` section 6).
- One nudge per basket hash per tab session; a changed total re-judges.
- Keyboard shortcut (`Alt+Shift+N`) forces an assessment of the current page; in
  phase 1 it cycles the fixture scenarios.

This directory is one lane; changes from other lanes come in as handoffs.
