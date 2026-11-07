# Main story: the late-night trainers

Use scenario `scn_1_impulse`; keep the clock at 2026-11-08 23:40 Europe/London.

1. Show the prepared Amazon basket: £45 hoodie + £85 trainers, with a scarcity cue in the fixture. Verify the actual visible banner if demonstrating a real checkout; do not claim a fixture banner was detected live.
2. Nudge: strong_nudge, prepared regret risk 80. Evidence: 3 of 5 reviewed clothing orders regretted; no-more-trainers rule; late-night timing.
3. Explain cash: £1,000 balance; rent £850 on 10 November; payday 13 November. £150 safe before the basket, £20 afterwards.
4. Apply drop-trainers negotiation: £45 basket; £105 safe afterwards; clothing budget changes from £70 over to £15 remaining. Risk 45: a smaller nudge, not a green light.
5. Show the historical order evidence in Purchases and the calibration on Insights. For a reliable feedback demonstration, use the already-due unreviewed clothing order `online-clothes-06`. Marking it regretted increases the category multiplier by 0.1 under the existing API logic. The fixed clock does not automatically advance to newly scheduled reflection times.
6. Optional quick contrasts: scn_2_essential (medicine), scn_3_duplicate (phone case and gift reason), scn_4_fine (£6 paperback toast), scn_5_deal (Amazon game countdown).

Prepared checkout references are item search links, not guaranteed live stock, price or checkout pages. The API supports deterministic scenarioId selection. The extension and pages must be supplied by their lane owners; this data does not implement their UI.

Dashboard rule: all cards must use the same profile and demoNow, with live changes reflected after feedback or decisions. Initial snapshots are examples, not permanent aggregate truth.
