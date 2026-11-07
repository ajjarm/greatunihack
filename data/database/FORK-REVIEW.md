# Fork review and replacement demo-data plan

Reviewed 7 November 2026. Fork: Zack-Aftab/greatunihack; fetched origin/main before review. Attached SPEC.md also read in full. This is a proposal and review, not a database refill.

## Findings that govern the data

1. Live demo scope is Amazon checkout. All five scenarios must remain Amazon. Historical orders can include other online retailers and delivery services; no offline bus fares, cafe visits or shop purchases. Bills and salary provide financial context and do not become online shopping purchases.
2. Shared types remain the API contract. Database-only demo annotations belong in separate metadata, not invented Purchase fields.
3. The source store is `apps/web/src/lib/store.ts`: JSON fixtures, in-memory mutation, global cache. The hosted tables are not wired into it. New Supabase data alone will not change API output. A database adapter belongs to Ajjar's lane. Exporting the same dataset to data/*.json provides a compatible demo fallback.
4. `POST /api/assess` matches scenario ID, exact basket hash, then merchant + total within one penny. Arbitrary different totals get a generic go-ahead. The prepared products and prices must agree with the scenario fixtures; a product link alone does not guarantee a matching basket or current stock/price.
5. `apps/extension` currently contains only README.md. `apps/web/src/app` contains API routes and the root scaffold, with no nudge/dashboard implementations in this fork. These are other lanes' deliverables, not features that database records make functional.
6. Spec §5.4 omits category-history scoring below three reviews, with limitedHistory=true. Three reviews are demo evidence, not enough to make a clinical or statistically reliable prediction. Preserve sparse categories deliberately.
7. Reviewer rates must exclude unsure. The current check-data script counts all non-null feedback, including unsure, in its denominators. Use happy/regretted in the categories that demonstrate exact guide percentages, and put unsure examples elsewhere until the integrator resolves the mismatch.
8. Feedback code uses prediction threshold 50 and a +/-2 tunedPct adjustment, while the spec describes a rolling last-20 accuracy calculation. The previous database generator used a threshold of 40. Replacement data must not claim that these are equivalent. Use seed values that support the visible category multiplier change and document the API's demo approximation.
9. `spentThisWeek` uses the exact interval (demoNow - 7 days, demoNow], not calendar-week sums. Seed recent purchases and limit impacts using this interval.
10. Buy-anyway creates per-item watcher purchases and schedules reflections relative to persona.demoNow. pendingReflections compares against that same fixed clock. With DEMO_FAST_TIMERS=1, a due date of demoNow+60 seconds stays in the future until the clock advances. A seeded already-due reflection is a reliable fallback; live buy -> wait -> reflection requires integrator work.
11. The API transaction feed currently expects positive purchase amounts when matching buy-anyway intents. The reconciliation ledger uses signed amounts. A feed export must convert expense amounts to positive pence and exclude salary/bills; do not send the ledger directly to the endpoint.
12. Bank feed IDs are deduplicated in a process-local Map, not persisted to the database. Durable idempotency belongs to the adapter.

## Recommended purchase distribution

90 days means the span of the history, not a requirement to invent a purchase every day. Target 66 completed online purchases. Paused and declined baskets belong in assessments/waiting, not completed purchases.

| Category | Completed orders | Happy/regretted reviews | Evidence and demo use |
|---|---:|---:|---|
| clothes | 10 | 5 | 3 regretted / 5; late-night trainers/hoodie history; impulse basket |
| accessories | 8 | 4 | 3 regretted / 4; two phone cases including a regretted second case; gift justification |
| tech | 6 | 3 | September headphones happy; two earbuds; useful upgrade versus duplicate accessory |
| books | 5 | 3 | All three happy; adult personal-reading rule; reassuring go-ahead |
| health | 4 | 1 | Essentials and personal care; sparse history; user's essential answer wins |
| fun | 6 | 3 | Friday-night game purchases and countdowns; postpone until payday |
| household | 5 | 1 | Online practical orders; comparison with discretionary purchases; sparse history |
| groceries | 6 | 1 | Online grocery deliveries; ordinary essential spending; sparse history |
| eating_out | 10 | 10 | Online takeaway orders; four regretted / ten; cover-it plan and budget context |
| gifts | 3 | 1 | Actual gifts; reason can lower risk without changing cash impact |
| subscriptions | 2 | 0 | Online optional services; limited history; recurring commitments stay in bills |
| transport | 0 | 0 | Keep category valid, but no daily travel filler; empty-history case |
| other | 1 | 0 | Online miscellaneous order; unknown-history case |
| Total | 66 | 32 | Focused history with unreviewed records retained |

Counts are design targets, not minimums imposed by SQL. Dates spread over 90 days with realistic gaps; ordinary online orders balance high-risk examples. Do not assign regret to every optional purchase.

Additional overlapping patterns: at least six late-night purchases with four regretted; at least eight cue-bearing purchases with five regretted; at least four Friday-after-22:00 examples; small clusters around payday; two phone cases, two earbuds, happy September headphones. These patterns reuse the 66 records rather than adding more filler. Compute every displayed percentage from the exact reviewed records.

## Demo mapping

Every purchase gets a separate metadata entry keyed by its existing purchase ID: related scenario IDs, its purpose, the exact screen explanation it supports, relevant related purchase IDs, and an Amazon product/search reference where useful. Search links are labelled search links; no invented product IDs, promises of stock or fabricated past order links. Metadata does not alter the shared Purchase type.

1. scn_1_impulse: hoodie + trainers; late-night clothes history, personal trainer rule, scarcity; drop trainers and show updated cash/limit numbers.
2. scn_2_essential: paracetamol + prescription top-up; explicit essential question and cover-it plan, tied to a genuinely near bill.
3. scn_3_duplicate: headphones + phone case; point to the two actual prior case records; provide a gift reason variant in this scenario; preserve cash impact on reason changes. Do not preseed the current basket as already purchased.
4. scn_4_fine: £6 personal-reading paperback; three happy books and adult books rule; positive affordability and a go-ahead toast.
5. scn_5_deal: £39.99 game, countdown, Friday-night evidence and fun limit; delay option tied to a real later income date.
6. Reflection: current purchase starts feedback=null; an explicitly marked pre-due fallback record enables feedback -> category multiplier update until clock handling is fixed.

Keep around 20 past assessment summaries, two useful waiting-list entries, 60 days of future cash projections, and six not-yet-ingested feed rows for the n8n demonstration.

## Schema choice

Keep the existing 14 tables. Their roles are reasonable: profile, fixed category vocabulary, income sources, bills, budgets, rules, purchases, reconciliation transactions, assessments, assessed items, waiting entries, calibration, scenarios, and cached contract snapshots. Simplifying table count would not fix mismatched data. Snapshots must be clearly marked as caches and relational/JSON representations updated together. All existing tables retain RLS.

## Acceptance before replacing data

- All 66 purchases are identifiable online orders with demo evidence metadata.
- All scenario requests, variants, totals, factor points, category limits and explanations agree.
- No student loan/course/exams assumptions; persona stays the requested fictional adult.
- One consistent demo time and cash context. If the near-rent and Friday-night scenarios need different times, use explicit scenario contexts coordinated with the integrator; do not silently contradict persona.demoNow.
- Run both TypeScript contract checks and cross-file semantic validation on the replacement adult export. The existing app's 25/25 check only checks its original JSON files, not the separate database export.
- Live database checks verify references, seed counts, exact review denominators, projections and balance reconciliation after any approved refill.
- Do not rewrite shared API/scoring/UI code from the data lane. Document adapter, clock, matching and scoring gaps for the integrator.
