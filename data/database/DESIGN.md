# Online spending demo database

Supabase project: **Great Uni Hack**, `edajmmyqcuufnilxgckk`.

One fictional adult: **Alex Morgan**. The persona supports the requested ADHD-focused product without storing diagnosis or clinical information. **66 completed online purchases** span **11 August–8 November 2026**, with realistic gaps. Demo time is **8 November, 23:40 Europe/London**.

## Main demo

An Amazon basket contains a **£45 hoodie and £85 trainers**. Alex has **£1,000**, rent of **£850 due 10 November**, and take-home pay of **£1,250 due 13 November**. Safe-to-spend before payday is **£150**, after reserving rent.

The basket leaves **£20**; dropping the trainers leaves **£105**. The clothes budget is £60, with no earlier clothes orders in the exact preceding seven days: the basket is £70 over; keeping the hoodie leaves £15 in that category budget. Three of five reviewed clothing orders were regretted. The personal rule is “No more trainers this month.”

Prepared risk is 80 before negotiation and 45 after (strong_nudge -> nudge). Do not describe the remaining optional hoodie as green: its score is still in the nudge band. The separate £6 paperback scenario demonstrates a green go-ahead. These are labelled demonstration predictions; money is calculated.

The dashboard supports the same story: Purchases shows the earlier clothing orders and feedback, Home shows cash context and recent assessments, Insights shows the exact evidence and calibration, Waiting contains two postponed purchases, and Profile contains the salary, bills, rules and goal. A prior unreviewed clothing order is already due for reflection so feedback can demonstrate a clothes-calibration change without depending on the frozen clock.

## Tables and records

Fourteen tables are retained. Counts after replacement:

| Table | Records / purpose |
|---|---|
| spending_profiles | 1 profile, opening balance, ownership and Persona payload |
| spending_categories | 13 fixed shared categories |
| spending_income_sources | 1 monthly income source |
| spending_bills | 5 recurring commitments, separate from shopping |
| spending_budgets | 5 weekly limits |
| spending_rules | 5 personal rules |
| spending_purchases | 66 completed online orders and demo_context metadata |
| spending_transactions | 83 signed confirmed ledger transactions |
| spending_assessments | 20 past assessments with full nested API payloads |
| spending_assessment_items | 20 assessed historical items |
| spending_waiting_items | 2 postponed items; one due in 10 demo minutes |
| spending_calibration | 13 category calibration records |
| spending_scenarios | 5 Amazon checkout scenarios and variants |
| spending_snapshots | 4 contract-compatible initial snapshots |

Category totals and review targets are in FORK-REVIEW.md. There are no offline bus fares, physical shop visits or arbitrary daily spending filler. Other online retailers and delivery services appear only in historical orders; every live checkout scenario is Amazon. Historical item references are explicitly Amazon **search links**, not claimed historical order receipts or verified product prices.

## Dashboard data ownership

Database: stores profile facts, online orders, decision history and feedback. API: computes aggregates, cash projections, calibration changes and contract responses. Dashboard and nudge: display the same results through the API.

| API response | Database inputs | Recompute after |
|---|---|---|
| Home | ledger balance, profile commitments, recent assessments, due unanswered reflections | confirmed transaction, decision, feedback or clock change |
| Purchases | purchases sorted by purchased_at; category and feedback filters | buy/ingest/feedback |
| Waiting | waiting rows and original assessments | wait, buy, remove or extend |
| Insights | happy/regretted outcomes, cues, duplicate IDs, calibration, rolling seven-day limits, future timeline | feedback, purchase, decision or profile change |
| Profile / memory | persona, incomes, bills, budgets, rules, goal | settings change |
| Weekly report | assessment decisions/outcomes, budgets and estimated avoided spend | decision, feedback or clock change |

`dashboard-queries.sql` supplies live relational examples for the integrator. Snapshot payloads are initial fixture caches. Do not serve stale snapshot values after a write: recompute the affected response or invalidate/rebuild the snapshot in the same transaction. Update normalized records and their JSON projections together. Do not subtract a buy-anyway intent and its matching confirmed transaction twice.

## Compatibility and integration limits

`types.ts` remains unchanged. SQL uses snake_case and complete API payload JSON uses camelCase. Money is integer pence, timestamps retain time zones, and now is persona.demoNow. Demo references are internal `demo_context`, excluded from the shared Purchase shape.

The existing API still reads the original root data/*.json in memory, **not Supabase**. Its database adapter is Ajjar's lane. `fixtures/` contains a matching export for a fixture-mode fallback. The original root fixture files have not been overwritten. Keeping the fallback and database seed identical prevents two conflicting demo datasets.

Two shared-checker differences are explicit: the fork still expects `scn_5_steam`, while the supplied spec says Amazon `scn_5_deal`; and its bill coverage test compares already-reserved safe-to-spend against the bill again. `check_export.py` uses a temporary copy of that checker with only these two adaptations. Bill coverage is evaluated at the bill date in the projected balance. No shared checker or API file is edited. See FORK-REVIEW.md for frozen timers, feed sign conversion and other integration findings.

The six future feed rows in `feed-rows.csv` are unseeded examples, with positive expense amounts for the existing transaction API. They are not part of the signed reconciliation ledger.

## Files and verification

- `schema.sql`: full creation script for a fresh database. Existing hosted database additionally received `demo_metadata.sql` as a migration.
- `seed.sql`: deterministic seed; `ON CONFLICT DO NOTHING` preserves rows on ordinary reruns. It is not a reset script.
- `generate_seed.py`, `enrich_seed.py`, `scenario_details.py`: generate the final seed and exports.
- `sample-data.json`: SQL-shaped records; `contract-data.json`: nine API surfaces.
- `demo-links.json`: purchase-to-demo evidence mapping for all 66 orders.
- `export_fixtures.py`: regenerate `fixtures/`.
- `check_contract.py`: TypeScript literal checks against shared types.
- `check_export.py`: semantic checks and online/demo-specific assertions.
- `validate.sql`: hosted data integrity, counts, old-row removal, ledger, references and RLS checks.
- `DEMO.md`: short presenter sequence and expected numbers.

All 25 adapted cross-file checks, all nine TypeScript surfaces and additional demo checks pass. Hosted validation passed after replacement. Supabase security advisor reported no findings. Access remains owner-scoped; the fictional profile is unclaimed and administrative/server access is required until explicitly assigned to an Auth user. Never expose a service-role key in browser code.

The previous 171-purchase seed was replaced atomically, limited to the unassigned synthetic profile. Existing schema and security policies were retained. The opening balance is explicit and reconciles with all 83 ledger entries to **£1,000**.
