# Supabase spending database

Deployed project: **Great Uni Hack**, `edajmmyqcuufnilxgckk`.
Persona: **Alex Morgan**, one fictional adult, for the requested ADHD-focused product.
History: **11 August–8 November 2026**, 90 inclusive London calendar dates.
Demo time: **8 November 2026, 23:40 Europe/London**.
All records are synthetic. No diagnosis or clinical attributes are stored.

## What is included

| Table | Purpose |
|---|---|
| spending_profiles | Profile, ownership, opening balance and full Persona JSON |
| spending_categories | All 13 shared categories |
| spending_income_sources | Monthly salary and schedule |
| spending_bills | Five recurring bills |
| spending_budgets | Weekly category limits |
| spending_rules | Personal avoid/always-fine rules |
| spending_purchases | 171 completed purchases, feedback, cues and reflection dates |
| spending_transactions | 189 signed ledger entries: purchases, salary and bills |
| spending_assessments | 21 historical assessments, indexed fields and complete Assessment JSON |
| spending_assessment_items | Items, factors, necessity, confidence and duplicate references |
| spending_waiting_items | Four paused purchases, linked to assessments |
| spending_calibration | Category multipliers and calibration percentages |
| spending_scenarios | All five demo Scenario objects, with variants |
| spending_snapshots | Home, Insights, Report and TimelineResponse contract snapshots |

## Alignment with the repository

Reviewed `AGENTS.md`, `docs/SPEC.md`, `docs/INTERFACES.md`, `docs/MOCK-DATA-GUIDE.md`, `plan/active/zack-data.md` and `apps/web/src/lib/types.ts`.

- Money uses integer pence; currency is GBP; timestamps preserve time zones.
- The existing category, feedback, decision, cue and verdict values are retained.
- SQL columns use snake_case. JSON payloads use the exact existing camelCase API names.
- `contract-data.json` contains nine API shapes that compile against the existing shared TypeScript types, including every required nested Assessment field.
- The scenario IDs remain `scn_1_impulse`, `scn_2_essential`, `scn_3_duplicate`, `scn_4_fine`, `scn_5_deal`; reason, negotiated and essentialYes variants are preserved.
- Full payload JSON stores impact, topFactors, cues, negotiation, timeline, calibration, optional reason and spokenLine. Item JSON includes necessityConfidence, essentialPrompt, limitedHistory and duplicateOf.
- Duplicates refer to purchases in this adult dataset. Monthly income replaces the student loan and shift income. Books refer to personal reading.
- Reviewed category samples retain clothes 3/5 regretted, accessories 3/4, books 0/3 and eating out 4/10; unsure is excluded from percentages. Late-night, Friday-night, cue and repeated-item examples coexist with ordinary groceries and transport.
- The existing source-of-truth JSON fixtures remain unchanged. These adult records live separately under `data/database/`, so existing app demos continue to work.

The user's adult ADHD-focused persona and requested hosted database supersede the spec's student persona and no-database deployment choice. No shared API types or UI files were changed. Database-only identifiers, ownership, ledger reconciliation and synthetic-data markers are internal metadata, not new API fields.

## Financial consistency

Opening balance plus all signed ledger transactions equals **41,200 pence (£412)**. Each completed purchase has exactly one matching negative transaction. A wait decision does not create a completed purchase. Income and recurring bills have their own transactions. Income is take-home salary.

The 60-day future projection uses salary and recurring bills; it is a projection, not a promise about future discretionary spending. Safe-to-spend is the minimum projected balance before the next income. Snapshot aggregation uses the guide's rolling seven-day budget window.

## What is mocked

Assessments, scenarios, verdict predictions and the illustrative Spend Score are demonstration fixtures, not live AI output. Cash arithmetic, category feedback rates, calibration replay, purchase references, report counts and ledger reconciliation are computed. Future negotiations and justifications are stored examples; this database alone does not implement those API actions. The report score remains an explicitly illustrative 72.

## Files and reproduction

- `schema.sql`: create the 14 tables, constraints, indexes, RLS and grants once in a new Supabase database.
- `seed.sql`: insert deterministic sample records after the schema; rerunning preserves existing rows with the same IDs.
- `generate_seed.py` and `enrich_seed.py`: regenerate both SQL and JSON from seed 20261107. Run from the repository root: `python data/database/generate_seed.py`.
- `sample-data.json`: database records.
- `contract-data.json`: API-shaped export.
- `check_contract.py`: compile the exported literal values against shared types; requires the app's installed TypeScript. Run `python data/database/check_contract.py`.
- `validate.sql`: checks on the deployed database, plus category feedback counts.

Do not run schema.sql again against existing tables. Use a new reviewed migration for changes. seed.sql uses `ON CONFLICT DO NOTHING`; it will not overwrite later user edits. Generated files can be large because historical cash projections and scenario variants are complete.

## Ownership and app integration

RLS is enabled on every table. Anonymous access to personal records is revoked. Authenticated owners can access their own profile and children; authenticated users can read the fixed category vocabulary. The sample profile has **auth_user_id = NULL**, so its data is available only through administrative/server access until explicitly assigned to a real Supabase Auth user. Do not place a service-role key in browser code.

The current Next.js API still reads the original in-memory fixture store. Ajjar must implement the database adapter in the API lane. Read `spending_profiles.persona`, `spending_assessments.payload`, `spending_scenarios.payload` and `spending_snapshots.payload` for complete contract shapes. `contract-data.json` is an example adapter export. On writes, update the relational columns and JSON payload together in one transaction; cached snapshots need recomputing when purchases, feedback, rules or balances change. These snapshots are fixture caches, not automatically maintained materialized views.

The ledger's `id` maps to `TransactionIn.externalId`, `occurred_at` to `date`, with merchant, description, signed amount and category retained. Matching an incoming transaction to an assessment remains API logic. Preserve unique external IDs for idempotent ingestion.

## Verification completed

- Nine exported contract surfaces compiled against the repository's shared types.
- `validate.sql` passed against the populated hosted PostgreSQL database.
- Existing app fixture check remains 25/25 passing (separate original fixtures).
- Supabase security advisor: no findings. Performance advisor: informational unused-index notices on this newly created database; no warning/error findings.
- Authenticated access with no assigned profile returned zero purchases.
