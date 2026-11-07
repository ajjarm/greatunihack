# Mock data guide — Zack's lane

The fixture data **is the demo's brain for the first three hours**. Everything the nudge
and the dashboard show comes from these files through the API. Write them as if the real
system produced them. Shapes are fixed in `docs/INTERFACES.md` and
`apps/web/src/lib/types.ts`; the starter files in `data/` already validate, so extend
them rather than starting from scratch. Run `npm run check:data` in `apps/web` after
every change; it fails loudly on shape or consistency errors.

Deadlines: v1 (enough for UIs to look real) by 1:30. Final by 2:30. Then you move to
pitch, README, video and QA.

## The persona: Sam (change numbers if you like, keep them consistent)

- Second-year student, Manchester. `demoDate` is the hackathon day; `demoNow` is
  23:40 on that day, because scenario 1 is a late-night purchase.
- Balance on demo day: £412.
- Incomes: maintenance loan £2,140 on 12 January (previous instalment in September,
  visible in history); part-time job £9.50 an hour, paid every other Friday, amounts
  vary £180–£220, next one 14 days after demo day.
- Fixed outgoings: rent £650 on the 1st; phone £18 on the 14th; gym £24 on the 20th;
  Spotify £11 on the 5th.
- Weekly limits: eating out £40, clothes £60, fun £30, groceries £45.
- Rules: "no trainers until exams are over" (clothes, avoid, until "exams"); "stop
  ordering takeaway on weeknights" (eating_out, avoid); "course books are always fine"
  (books, always_fine).
- Goal: summer trip, target £600, saved £140.

## data/ files

| File | What it is | Consumers |
|---|---|---|
| `persona.json` | Profile, incomes, outgoings, limits, rules, goal, balance, demoNow | everything |
| `purchases.json` | ~60 purchases over the 90 days before demoDate, with feedback on ~25 | purchases tab, insights, duplicates, history factor |
| `assessments-history.json` | ~20 past nudges (what the agent said, what Sam did), so Home and Insights have history | home, insights |
| `scenarios.json` | The five demo baskets with full assessment responses and variants | nudge, watcher |
| `home.json` | Spend Score with 8 weeks of history, the insight sentence | home |
| `insights.json` | The insight sentences and the aggregates behind them | insights tab |
| `timeline.json` | 60 days of projected balance from demoDate, with income and bill events | insights, nudge show-more |
| `waiting.json` | 2 items already on the waiting list, one expiring soon | waiting tab |
| `report.json` | Last week's report | dashboard, n8n |
| `calibration.json` | Per-category multipliers and tuned percentages | insights, nudge |
| `feed-rows.csv` | 6 extra bank-style rows for the live n8n demo (not loaded at start) | n8n |

## Patterns the demo depends on (do not forget these)

The insights and factors only work if the history contains the patterns they describe.
Build these in deliberately:

1. **Late-night regret.** At least 6 purchases between 23:00 and 02:00; 4 or more of
   them `regretted`. Mostly clothes and accessories.
2. **Clothes regret rate 60%.** Five reviewed clothes purchases, three regretted.
3. **Accessories regret rate 75%.** Four reviewed, three regretted.
4. **Books 0% regret.** Three reviewed, all happy. Supports the "course books are
   always fine" rule.
5. **Eating out 40%.** Ten reviewed, four regretted, weeknight takeaways regretted more
   than weekend ones.
6. **Two duplicates already in history:** a second phone case (bought 6 weeks ago,
   regretted) and a second pair of earbuds. Scenario 3 relies on the phone cases.
7. **Pressure cues.** At least 8 purchases carry a cue (`scarcity`, `sale`,
   `countdown`); 5 or more of those regretted, so the pressure insight can say
   "you regret 60% more of purchases made under a '2 left' or sale banner".
8. **Payday spike.** A cluster of 4–5 purchases within 48 hours of each job payday,
   with higher regret than average.
9. **A Friday-after-10pm window** that shows up at least four times.
10. **Groceries and transport are boring and happy.** Lots of small, unreviewed or
    happy purchases, so the data doesn't look like Sam only buys junk.
11. **Headphones bought in September**, happy, so scenario 3 can say "you bought
    headphones in September" as context without calling the new ones a duplicate.

## The five scenarios (data/scenarios.json)

Write the full `response` for each as if the Brain produced it: verdict, headline,
regretRisk, affordability, items with necessity tags and per-item risk and factors,
impact numbers that agree with persona and timeline, three top factors, cues with notes,
negotiation options, reflectionDays, a reasoning paragraph, the timeline slice, and the
calibration for the category.

| id | Basket | Expected response |
|---|---|---|
| `scn_1_impulse` | Amazon, 23:40: hoodie £45 + Nike trainers £85, "Only 2 left in stock" | `strong_nudge`, regret 78 (trainers 89, hoodie 41). Factors: rule "no trainers until exams", late-night history, scarcity cue. Impact: £38 safe until the next shift, rent still covered, £35 over clothes limit. Negotiation: drop trainers → risk 34, verdict `nudge`→ green-ish; delay trainers 14 days. reflectionDays 3. Variants: `reason` ("they're for my sister's birthday") → gift accepted, risk 44, impact unchanged; `negotiated` (drop trainers). |
| `scn_2_essential` | Amazon, 2 days before rent: paracetamol £3.49 + prescription top-up £10.50 | Item necessity 92, `essentialPrompt: true`. Before the answer: verdict `nudge` with headline "Looks essential. Is it?". Variant `essentialYes` → `essential_cover`, headline "Buy it. Skip one takeaway this week and you're covered.", regret 8. |
| `scn_3_duplicate` | Amazon: noise-cancelling headphones £54 + phone case £35 | `nudge`, regret 58 (headphones 22 `useful`, case 81 `want`). Factors: duplicateOf the phone case from 6 weeks ago ("you own two"), accessories regret 75%. Negotiation: drop case → risk 22, `go_ahead`. reflectionDays 7 for headphones, 3 for the case (use 7 at basket level). Variant `negotiated`. This is the one Sam "buys anyway" in the demo, so `assessments-history.json` must not already contain it. |
| `scn_4_fine` | Amazon: course reader £6 | `go_ahead`, regret 6, headline "Looks fine. £406 safe after this." Rule "course books are always fine" matched. Toast only. |
| `scn_5_steam` | Steam: a game £39.99, Friday 22:30, "-40% ends in 2 days" countdown | `nudge`, regret 64. Factors: Friday-after-10pm window, countdown cue, fun limit £30 → £10 over. Negotiation: delay 5 days (after the next shift) → risk 38. reflectionDays 7. |

Make the numbers agree: scenario 1's `impact.safeToSpendBeforePence` must equal the
timeline's lowest point before the next income; `limit.spentThisWeekPence` must equal
the sum of this week's clothes purchases in `purchases.json`; `calibration.tunedPct`
must match `calibration.json`.

## home.json, insights.json, report.json

- Spend Score this week 72, amber, trend up; eight weeks of history that start around
  58 and climb unevenly. Explanation three sentences, friendly, specific to Sam.
- Insight sentence on Home: "You've regretted 3 of your last 4 late-night clothes
  orders. Tonight's a Friday."
- Insights sentences (at least six): regret by category; the late-night window; the
  payday window; pressure sensitivity with the percentage; the duplicates; the
  calibration change ("I'm 81% tuned to you, up from 64% a month ago"). Each with an
  `evidence` string that names counts.
- Avoided spending (estimated) over the last 30 days: £138, with three "could be"
  lines (trip fund, rent buffer, days of spending).
- Last week's report: nudgesShown 9, heeded 5, overridden 4, overriddenHappy 1,
  overriddenRegretted 2, limitsKept 3, limitsExceeded 1, avoidedPence 7200, spendScore
  69, three sentences.

## Style of all text

Friendly, short, specific, never shaming. "You" not "the user". Numbers in pounds
with no decimals unless under £10. No exclamation marks. No "um, basically".

## Realism checklist

- Merchants vary (Amazon, ASOS, Tesco, Deliveroo, Uber Eats, Trainline, Boots, Steam,
  Spotify, the SU shop, a kebab place). Not everything is Amazon.
- Amounts are not round. £13.47, not £13.
- Dates spread across all 90 days, with the patterns above on top of ordinary life.
- Balance arithmetic roughly holds: September loan in, rent out monthly, purchases out,
  job pay in, ending at £412.
- Every purchase with feedback has a `feedbackAt` after `purchasedAt` by a plausible
  gap (food a day, clothes a few days, tech a week).
