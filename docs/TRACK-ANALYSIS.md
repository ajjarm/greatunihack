# Track analysis — Great Uni Hack, 8 Nov 2026

Written the night before, from the sponsor slides plus web research. Goal: pick the
track and idea with the best chance of winning *something*, with a demo that shows the
hard part without us explaining it.

## 1. The rules as we understand them

- Pick **one sponsor track**: NatWest (main), Tether, or Neptune North.
- **Bonus challenges** (n8n, ElevenLabs) are judged on the same project, no extra
  submission. We can target both, one, or neither.
- Every sponsor-track project is also judged for the **overall top three** (impact,
  technical execution, creativity, design, final demo).
- **MUDS poker bot** is a separate side competition: one Python bot per team, bots play
  each other, most big blinds won per hand. It does not interact with the main project.

Compatibility matters:

| Sponsor track | + n8n | + ElevenLabs | Why |
|---|---|---|---|
| Neptune North | yes | yes | No constraints on tooling |
| NatWest | yes | yes | No constraints on tooling |
| Tether | awkward | **no** | "No cloud or external APIs". ElevenLabs is a cloud API. n8n would have to be self-hosted and talk only to local things. |

## 2. What we learned about each sponsor

**Neptune North.** A technical consultancy founded in 2024 as a joint venture between
Oliver Wyman and Rokos Capital Management (a hedge fund). Builds data, AI and software
for **finance and defence** clients and describes its work as "demanding, challenging
environments". So the judges are engineers who think about distributed systems under
failure. "Multiple agents keep working toward a shared goal even when communication
fails" is the DDIL problem in defence (denied, degraded, intermittent, limited comms)
and the exchange-outage problem in trading. They will recognise gossip protocols, CRDTs
and auction-based task allocation. Prize: £1,000 shared, plus keyboards for 2nd and
3rd, so **three places**. "Excitement" is an explicit criterion.

**NatWest (main sponsor).** Financial inclusion and resilience, "financial time travel"
(forecasting hardship before it happens), vulnerable and underserved customers. NatWest
has run this theme for years (inclusive-payments hackathons, an investment in Serene,
an AI platform that detects early signs of financial distress). Criteria are five soft
ones: customer focus, innovation, social impact, use of AI and data, feasibility. This is
the track most teams in the room will enter.

**Tether.** Requires their stack: **QVAC** (open-source local AI SDK, `npm i @qvac/sdk`,
Node 22.17+, we have Node 26; also a Python package) and **Pear** (Holepunch's
peer-to-peer runtime). QVAC does local LLM chat (GGUF models), Whisper speech-to-text,
text-to-speech, embeddings, RAG, and a P2P layer on Hyperswarm. There is an official
`hello-pear-qvac-tui` template that combines both, which cuts the learning risk a lot.
Remaining risks: downloading a 2–4 GB model on venue wifi, and the judges score "QVAC
implementation" and "Pears implementation" as separate criteria, so both must be real.
Prize: £100 gift card each. Likely the fewest entrants.

**n8n.** "Automate a real task; n8n is the core; connects several services; handles
errors; works live in the demo." Prize: 1 year of n8n Cloud Pro each (worth roughly
$600–700 per person).

**ElevenLabs.** "Voice is central; natural voices that work in the demo; audio that makes
something new possible." Prize: 3 months of ElevenLabs Scale each (Scale is about
$330/month, so roughly $1,000 of value per person). Bolting text-to-speech onto an app
will not count as "central"; a judge will ask what breaks if you remove the voice.

**MUDS poker.** No public spec found. Get the engine, the bot interface, the time limit
per decision and the blind structure from the organisers in the first ten minutes.
Comparable student competitions (MIT Pokerbots) use a Python skeleton with a hand
evaluator library and run thousands of hands; most student bots are rule-based and
exploitable.

## 3. How ideas are scored

Each idea gets 1–5 on:

- **Fit**: how directly it hits the written criteria.
- **Demo**: can a judge see the hard part in 60 seconds without us explaining it?
- **Build**: chance of a working demo in 6 hours with four agents (5 = low risk).
- **Crowd**: how few teams will do something similar (5 = we would be alone).
- **Stack**: how naturally n8n and/or ElevenLabs become *core* rather than bolted on.

## 4. Neptune North ideas

### N1. Blackout Fleet (recommended)

A fleet of autonomous supply drones serving a flooded city. Shared goal: every demand
point receives supplies. Each drone is an independent agent with its own belief of the
world. While connected they allocate tasks by auction (contract-net: "who is closest to
point 14?"). The judge presses **Cut Comms**, or partitions the map into islands, or sets
packet loss to 60%. Drones keep working from last-known state, exchange state by gossip
when two pass within range, and on reconnect merge their task ledgers with CRDTs and
vector clocks, resolving duplicates on screen ("3 and 7 both took point 14; 7 yields and
re-plans"). A Claude call gives each drone a one-line reason for every non-trivial
decision, shown live. A goal-progress meter visibly keeps rising during the blackout.

| Fit | Demo | Build | Crowd | Stack |
|---|---|---|---|---|
| 5 | 5 | 4 | 4 | 4 |

- Hits every criterion by name: common goal, independent decisions, resilience,
  technical execution, excitement (the kill switch), presentation, design.
- Under-the-hood panel is natural: belief vs truth per agent, message log, merge events.
- n8n as **Mission Control** can be made genuinely core: every agent reports to an n8n
  webhook; n8n is the comms backbone and incident system. Killing n8n *is* the comms
  failure; n8n's error handling, retries and the post-blackout report (Sheets, Slack,
  email) are the "automates a real task" story.
- ElevenLabs flourish: Mission Control reads the blackout report aloud. Not central, so
  do not count on the ElevenLabs prize from this.
- Risk: scope. Must freeze at one map, 6–8 drones, 3 failure modes. The sim is
  deterministic code, which agents write very well.

### N2. Dark Pool: trading agents through an exchange outage

Several trading agents each run a slice of a large parent order (fill 100k shares at or
better than VWAP by 16:00) and a hedging agent keeps the book delta-neutral. The
connection to the central risk engine and the price feed drops. Agents fall back to
local risk limits, widen spreads on stale prices, pause or continue by their own rules,
and reconcile positions and P&L when the link returns.

| Fit | Demo | Build | Crowd | Stack |
|---|---|---|---|---|
| 5 | 3 | 4 | 5 | 3 |

- Speaks the judges' language (Rokos is a hedge fund). Nobody else will do this.
- Weaker demo for non-finance judges: charts staying inside limits are less dramatic
  than drones. "Excitement" scores lower.
- Keep as the alternative if the Neptune mentor hints they want a finance framing. The
  engine (agents, comms layer, kill switch, reconciliation) is the same as N1 with a
  different scenario skin, so the decision can be made at hour 1 without waste.

### N3. Microgrid Islands

Neighbourhood microgrids balancing load when the central grid controller dies; each
node decides on its own to shed, store or share power; the map stays lit.

| Fit | Demo | Build | Crowd | Stack |
|---|---|---|---|---|
| 5 | 4 | 4 | 4 | 3 |

Good, real-world, but less exciting than N1 and the "shared goal" is less visual than
deliveries arriving. Same engine. Third choice.

### N4. Mesh Rescue (robots mapping a collapsed building)

Robots share partial maps by gossip; comms fail in deep sections; the merged map
reassembles on reconnect.

| Fit | Demo | Build | Crowd | Stack |
|---|---|---|---|---|
| 5 | 5 | 2 | 4 | 2 |

The map-merge moment is spectacular but occupancy-grid rendering and merging is a
6-hour risk on its own. Not for this format.

## 5. NatWest ideas

### F1. Financial Time Machine

A timeline the user scrubs. A Monte Carlo cash-flow forecast with uncertainty bands
updates live. The user drops shocks on it ("boiler breaks in March", "hours cut 20%")
and a coach explains the consequence and ranks the interventions that fix it (pause a
subscription, move a bill date, apply for a council tax reduction). Under the hood: the
simulation running visibly, the coach's reasoning, and a "naive budget app vs ours"
toggle.

| Fit | Demo | Build | Crowd | Stack |
|---|---|---|---|---|
| 5 | 4 | 4 | 1 | 4 |

Literally what the brief asks for, which is the problem: half the room will build a
forecasting coach. Differentiation would have to come from the simulation quality and
the explanation panel. Stacks well with ElevenLabs (voice-only mode for low-literacy
users, which is a genuine inclusion story) and n8n (automated nudges and applications).

### F2. Benefits Radar

Billions in UK benefits go unclaimed every year. The agent reads transactions and
circumstances (mock open-banking data), detects entitlements the user is not claiming
(council tax reduction, Healthy Start, warm home discount, student hardship funds),
forecasts the month they will hit hardship without them, and walks them through the
claim. n8n automates the reminders and the forms.

| Fit | Demo | Build | Crowd | Stack |
|---|---|---|---|---|
| 4 | 4 | 3 | 3 | 5 |

Strongest social-impact story on this list and more original than a budgeting coach.
Risk is the rules engine: must mock 4–5 entitlements honestly and say so. n8n becomes
core naturally (it runs the real task: the claim workflow).

### F3. Voice-first money coach for people the apps leave out

An ElevenLabs conversational agent you phone or talk to, for users with low literacy,
English as a second language, or visual impairment. It knows your situation, forecasts
your next month, and talks you through one decision at a time. No screen required.

| Fit | Demo | Build | Crowd | Stack |
|---|---|---|---|---|
| 4 | 4 | 4 | 3 | 5 |

The one NatWest idea where ElevenLabs is undeniably central, so it is a credible shot at
the ElevenLabs prize even if NatWest is lost. The weakness is "show the complexity": a
voice conversation hides the forecasting unless a companion screen shows the agent's
state live.

### F4. Family Resilience Planner

Shared household view, kids' costs, carers. Decent, undifferentiated. Not scored.

## 6. Tether ideas (all 100% local, QVAC + Pear)

### T1. Campus Mesh Notes

Lecture audio transcribed locally (QVAC Whisper), summarised by a local LLM (QVAC),
synced to classmates over Pear with no internet. Demo on two laptops with wifi off:
record 30 seconds on one, the summary appears on the other.

| Fit | Demo | Build | Crowd | Stack |
|---|---|---|---|---|
| 5 | 4 | 3 | 5 | 0 |

Hits "real problem for your university", 100% local, and the P2P bonus directly. Build
risk is tooling and model download, not logic.

### T2. Offline Campus Helpdesk

Local RAG over university documents (timetables, regulations, support services) with
QVAC embeddings, distributed to students as a Pear app that updates peer-to-peer.

| Fit | Demo | Build | Crowd | Stack |
|---|---|---|---|---|
| 4 | 3 | 4 | 4 | 0 |

Safer build (text only) but a chat box is a weak demo.

### T3. Peer-to-peer AI tutoring swarm

Students' laptops share model inference over Pear so a weak laptop can use a stronger
peer's model (QVAC's P2P inference). Impressive if it works, but depends on a QVAC
feature whose current status is unclear.

| Fit | Demo | Build | Crowd | Stack |
|---|---|---|---|---|
| 5 | 5 | 1 | 5 | 0 |

Too risky for 6 hours.

## 7. If we wanted a bonus-first project

- **n8n-only idea**: "Hackathon Ops" that ingests the Devpost feed, judges' schedules
  and team Slack, and auto-builds the judging timetable with error recovery. Real task,
  several services, but no sponsor track, so no overall entry. Not worth it.
- **ElevenLabs-only idea**: real-time voice translation for A&E triage. Strong, but same
  problem.

## 8. Poker bot plan (independent of everything above)

1. Get the engine, bot interface, decision time limit and blind structure from MUDS.
2. Pre-flop: a heads-up opening/3-bet chart (tight-aggressive, position-aware).
3. Post-flop: Monte Carlo equity against a random or weighted range (500–2,000
   rollouts, within the time limit) using whatever evaluator the engine allows.
4. Decisions by equity versus pot odds with bet sizing in thirds of pot; fold equity
   from the opponent's observed fold-to-bet frequency; randomise within thresholds so
   we are not exploitable.
5. Test against a calling station, a maniac and a nit before submitting.

One person plus one agent, about 90 minutes, then back to their lane.

## 9. Recommendation

**Primary: Neptune North, idea N1 (Blackout Fleet). Bonus: n8n as Mission Control,
built to be the comms backbone rather than a bolt-on. Side bet: the poker bot.
ElevenLabs as a 20-minute flourish, not as an entry.**

Why, against the alternatives:

- Three prize places in a track most teams will avoid because the brief is abstract.
  Even a solid third beats a strong tenth in the NatWest room.
- The judging criteria reward exactly what we failed to show at Ox Hack: the
  complexity. A kill switch the judge presses is the best possible "under the hood".
- The judges are distributed-systems people from a finance and defence firm. Gossip,
  CRDTs and auctions are their vocabulary, and the story ("keeps working when the
  network dies, reconciles cleanly when it returns") is one sentence.
- Neptune North is a well-funded, hiring, Oliver Wyman and Rokos venture. Winning their
  track is a better CV line than a gift card.
- The same project enters the overall top three with a strong impact story (disaster
  relief) and a strong technical story.
- Tether would be the easiest track to win on entrant count, but it forfeits both
  bonuses, its prize is the smallest, and two unfamiliar SDKs plus a model download on
  venue wifi is a real risk to having anything to demo at all.
- NatWest with a voice-first coach (F3) is the credible plan B: it gives a real shot at
  the ElevenLabs prize and a long shot at NatWest. It loses to plan A on entrant count
  and on the "show the complexity" lesson.

**First 20 minutes tomorrow, before any code:**

1. Ask the Neptune North mentor: "Would you rather see a defence-style scenario
   (drones, DDIL) or a trading-style one (exchange outage)?" Pick N1 or N2 accordingly.
2. Ask the n8n mentor: "If n8n is our agents' message backbone and incident system, and
   the demo deliberately kills it, does that satisfy 'n8n is the core'?"
3. Get the MUDS poker engine and spec.
4. Confirm wifi can handle n8n cloud; otherwise run n8n locally in Docker.

## Sources

- [Neptune North homepage](https://www.neptunenorth.co.uk/) and [story page](https://www.neptunenorth.co.uk/about/story/)
- [Neptune North on PitchBook](https://pitchbook.com/profiles/company/749236-96), [Columbus hub news](https://www.nbc4i.com/news/local-news/columbus/british-tech-company-to-establish-hub-in-short-north/)
- [QVAC GitHub](https://github.com/tetherto/qvac), [QVAC quick-start](https://qvac.tether.io/blog/quick-start-build-your-first-local-ai-app-with-your-coding-agent), [QVAC docs](https://docs.qvac.tether.io/)
- [Pear docs](https://docs.pears.com/) (templates include hello-pear-qvac-tui)
- [GreatUniHack 2026 site](https://greatunihack.com/) (sponsor list includes NatWest)
- [NatWest and Serene](https://www.qorusglobal.com/content/29314-natwest-invests-in-ai-to-support-vulnerable-customers), [NextGenHack predictive cash-flow winner](https://www.business-school.ed.ac.uk/about/news/nextgenhack)
- [MIT Pokerbots engine](https://gh.r-mj.com/mitpokerbots/engine-2026), [student bot write-up](https://github.com/ngnnah/python_AutonomousPokerbot)
- [Gossip substrate for agentic AI](https://arxiv.org/pdf/2512.03285), [gossip-based auction for drone swarms](https://avesis.ankara.edu.tr/yayin/d6f11675-dd64-43aa-98a5-e07d7d6f9e56/a-gossip-based-auction-algorithm-for-decentralized-task-rescheduling-in-heterogeneous-drone-swarms), [CRDTs on drone swarms](https://sol.sbc.org.br/index.php/sbrc/article/download/42338/42105/)
- [ElevenLabs hackathon examples](https://lablab.ai/ai-articles/driving-voice-ai-innovation-highlights-from-the-elevenlabs-hackathon)
