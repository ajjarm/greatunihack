# Interfaces between lanes

Anything two lanes both touch is written here **before** either side builds against it.
Owned by the integrator. To change something, open a handoff issue to the integrator
(`./scripts/ask.sh ajjar "change: ..."`), so the other lane's agent sees the change.

## Directory map

| Directory | Lane | Owner |
|---|---|---|
| `app/` or `src/core/` | core | Ajjar |
| `src/under-the-hood/` (or similar) | under-the-hood panel | Zack |
| `src/<feature>/` | second feature | Rayan |
| `docs/`, `public/pitch/` | pitch | Aarav |
| `data/` or `fixtures/` | demo data | Zack |

## API routes

| Route | Method | Request | Response | Owner |
|---|---|---|---|---|
| | | | | |

## Shared types

```ts
// e.g. export type Score = { value: number; confidence: number; trace: TraceStep[] }
```

## Data file formats

| File | Shape | Producer | Consumers |
|---|---|---|---|
| | | | |

## Events the under-the-hood panel listens to

| Event | Payload | Emitted by |
|---|---|---|
| | | |
