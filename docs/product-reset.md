# Product reset — 20 October 2026

The first interface was rejected. It arranged a pitch, text cards and counters like a generic web dashboard. Its explanations largely repeated events. That did not demonstrate why a viewer should use it.

## Research and decisions

- [Official challenge and rules](https://github.com/microsoft/insidethegamehackathon/blob/main/OFFICIAL%20RULES.md): the required path is ingestion, interpretation, explanation, rendering and personalization. Five judging criteria have equal weight. A polished frontend alone is insufficient.
- [Hudl Studio](https://wellw.hudl.com/products/studio): synchronized telestration and player tracking support visual communication. Design inference: put explanations on the replay, beside the spatial evidence.
- [FIFA line breaks](https://www.fifatrainingcentre.com/en/fwc2022/efi-metrics/efi-metric--line-breaks.php): moving beyond an opposition unit is a football-specific concept. Do not call any forward pass a line break; unit identification would be required.
- Existing competition research showed pitches, multilingual commentary and verifier agents are common. None is a novelty claim.

## New product direction

An interactive tactical replay desk, opening directly into a match. The main surface is a large pitch, with a compact sequence rail and an evidence notebook. No marketing hero, decorative KPI cards or generic assistant chat.

Core interaction: select a completed pass → inspect its geometric lane and the closest defender → compare positions two seconds earlier → inspect the exact measurement and event → export the replay evidence.

Visual direction: warm paper workspace, ink typography, orange match markers, deep green pitch, small broadcast scoreboard, numbered editorial notebook, compact transport. Controls are real tools with selected states. The experience should feel like a sports analysis application.

## Integrity and boundaries

The lane measurement is distance from the closest opposing player to the finite pass segment at the chosen frame. Receiver space is nearest-opponent distance to the pass endpoint. These are geometric measurements of synthetic keyframes, not interception probabilities, expected goals, tactical causality or calibrated pressure. Earlier-position comparison is retrospective analysis of an already selected event, clearly labeled.

## Build sequence

1. Rebuild the application shell and direct-manipulation replay; introduce tested spatial calculations.
2. Replace illustrative background movement with constrained synthetic match generation, validate speed, possession, event timing and held-out cases.
3. Add real server-side Foundry tool use to select/qualify meaningful moments, with schema and evidence validation.
4. Evaluate grounding, timing, corrections, multilingual consistency, cost and latency on held-out sequences.
5. Deploy, run user walkthroughs and record the three-minute submission demonstration.

No claim that the current prototype is a complete or winning entry. The frontend reset establishes the interaction; steps 2–5 remain necessary.
