## Why That Goal? — See the Play Behind the Finish

A goal replay shows the finish. Fans, analysts and studio producers also need to understand the buildup—and inspect the evidence behind the explanation.

**Why That Goal? is a working, publicly deployed match-intelligence studio.** It turns original synthetic football events into live narratives, automatic sequence recaps and cinematic 3D replays. Select an explanation to revisit the supporting pass, receiving run or space change directly on the pitch. Goals, saves and intercepted attacks produce different stories.

**Try the app:** https://why-that-goal.blacksand-18241469.southeastasia.azurecontainerapps.io

**Public source, setup and evaluation reports:** https://github.com/mk-tdev/why-that-goal

### One pipeline, five stages

1. **Ingest:** receive fictional match events one by one, preserving event time, arrival time and versions.
2. **Interpret:** derive pass progression, receiver movement, receiving-point space changes and terminal outcomes in deterministic code.
3. **Explain:** use Microsoft Foundry agents to select evidence, write a narrative and review its support before publishing AI text.
4. **Render:** link claims to exact replay intervals, on-pitch traces, cinematic cameras and a producer-controlled lower-third graphic.
5. **Personalize:** offer concise fan and detailed analyst views, English/Spanish output and player-follow cameras using the same underlying evidence.

### Microsoft Foundry: a substantive model contribution

The deployed `wtg-insights` model powers evidence selection, storytelling and semantic review through the Foundry Responses API. Typed contracts and citation checks connect model output to versioned measurements. Useful live checkpoints and terminal recaps trigger generation; caching and bounded calls limit repeated inference while current measured insights remain available during generation.

The interface identifies Foundry output, cached results and measured fallback. Azure managed identity authorizes server-side inference without exposing a model API key to visitors. Prompts, contracts and evaluation reports are public. This implementation uses Foundry model inference with custom orchestration; Foundry Agent Service and native Foundry evaluation/tracing services are not claimed.

### Purposeful multi-agent collaboration

Three specialized roles have separate instructions, contexts and output contracts:

- **Match analyst:** selects relevant measured facts; the coordinator retrieves their evidence through `getFact`.
- **Storyteller:** turns the validated analysis into an audience-appropriate story and cited recap.
- **Evidence reviewer:** checks the complete time-bounded snapshot against the story, summary and every recap card, including outcome, attribution, timing and unsupported causal language.

They coordinate through an immutable evidence snapshot and explicit handoffs. A reviewer can request one targeted writer revision followed by another review. Rejection, invalid output, timeout or provider failure preserves a labeled measured fallback.

In a recorded fault-injection test, a draft with valid citation structure falsely described a goal as a save. The Foundry reviewer requested a correction; the writer repaired the flagged text, and re-review approved it. This demonstrates a concrete benefit of a separate semantic review gate beyond structural checks. All roles use the same deployment through a custom TypeScript coordinator; this is not Microsoft Agent Framework or A2A, and the small comparison does not establish general superiority over single-agent systems.

### Enterprise foundations and producer value

Azure Container Apps hosts the public HTTPS application. Scoped managed identity, per-caller rate limits, inference budgets, bounded concurrency, schema/citation validation, health probes, sanitized audit records and visible service counters make the prototype inspectable. The producer workspace exposes the signal chain and event log, then lets a human take the reviewed graphic to air alongside the replay.

The public demo intentionally requires no account or password. Its open inspection workspace is not an enterprise identity boundary. A private rollout would add tenant isolation, shared session/job/budget storage, persistent monitoring and alerting, real identity deployment validation, licensed data integration and agreed load/SLA targets. Monitoring and runtime controls are currently process-local.

A broadcaster pilot would measure event-to-accepted-graphic time, editorial rejection rate and evidence-cue accuracy with human sign-off. These are proposed adoption measures, not achieved customer or ROI results.

### Recorded validation and limitations

Published reports include **40/40 deterministic temporal and degraded-data checks**, **4/4 reserved authored live Foundry cases with reviewer-approved output**, and the false-save correction test. These are small synthetic evaluations, not independent model-accuracy scores. Human semantic review of the reserved outputs remains pending; model review can make mistakes. More agent stages also add latency and token use.

All teams, players, match events and tracking are fictional. The live feed simulates event arrival; this is not a licensed live-match or video-understanding integration. Spatial measurements describe the observed buildup, not proof that a particular run caused a goal. The producer graphic is demonstrated inside this app, not in an external broadcast system.

### Judge walkthrough

1. Open the public app; no login is required. Allow the service to wake if it has scaled to zero.
2. Start the live feed for the quick break. Watch events and evidence arrive, then inspect the Foundry status and automatic goal recap.
3. Select the receiving-run replay evidence around **72:08** to see the cited movement and interval on the pitch.
4. Open **Inside the intelligence** for the five stages, current roles/handoffs and separately labeled reviewer evaluation.
5. Choose **Open workspace → Enter Workspace → Operator**. Inspect signal-chain/event-log/monitoring views, then use **Take graphic to air** to see the red PGM tally and lower third.
6. Try a saved or intercepted attack and compare its outcome-specific recap; switch audience, language or player focus.

Recorded evaluations are labeled separately from current execution. Cached output is labeled; a fallback is not presented as a model approval.
