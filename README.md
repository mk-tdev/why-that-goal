# Why That Goal?

**[Open the public judge demo](https://why-that-goal.blacksand-18241469.southeastasia.azurecontainerapps.io)** — no sign-in. Foundry and all three agents are connected. [Deployment, costs and verification](docs/deployment.md).


**The goal is the ending. Discover the play that made it possible.**

Why That Goal? is an interactive football companion built for Microsoft and the Premier League’s **Inside the Game: Developer Hackathon**, tackling **The Synthetic Match Insights Engine for Premier League Studio** challenge.

It turns fictional match events into a story you can explore: follow the attack, understand the key passes and runs, and click an explanation to see the evidence directly on the pitch.

[Watch the 1:50 demo video](https://www.youtube.com/watch?v=qVZuNPllBsk) · [Our hackathon project](https://innovationstudio.microsoft.com/hackathons/insidethegamedeveloperhackathon/project/126704) · [The challenge](https://innovationstudio.microsoft.com/hackathons/insidethegamedeveloperhackathon/executive_challenge_details/5078/about)

![Why That Goal? interactive football replay](docs/screenshots/stadium-3d.jpg)

## Why we’re building it

A highlight shows the finish, but often leaves the most interesting questions unanswered. Which pass changed the attack? Where did the receiver move? Did space open up, or did the defender close it down?

We want fans to understand more of the game and give analysts and presenters a visual way to explain a moment. Every explanation should lead back to something the viewer can inspect.

## How it answers the challenge

The hackathon asks teams to turn synthetic football data into understandable match insights, live stories and automatic recaps for studio, broadcast and streaming experiences.

Why That Goal? brings those ideas together:

- **Follow the match as it unfolds.** Events arrive one by one, and explanations update as the play develops.
- **Understand what mattered.** See the key passes, receiving runs and changes in space around the attack.
- **See the evidence.** Click an observation to replay the relevant moment, with markings on the pitch.
- **Get the story at the end.** An automatic recap explains the buildup and whether it ended in a goal, save or intercepted attack.
- **Choose your view.** Switch between fan and analyst explanations, English and Spanish, different cameras and player focus.

## Try the experience

Choose one of six sequences: two goals, two saves and two attacks stopped by interceptions.

1. Select **Start live feed** to watch the sequence unfold.
2. Follow the explanations in the notebook beside the 3D pitch.
3. When the sequence ends, read the automatic recap and click **Replay evidence** to revisit a key moment.
4. Explore further with guided replay, slow motion, player focus and the broadcast, overhead or follow-play cameras.
5. Choose **Open workspace → Enter Workspace**, then switch to **Operator** for the broadcast console: a signal chain from feed to Foundry, a timestamped event log, a queue of measured evidence you can cue onto the pitch, and **Take graphic to air** for an on-air lower third.

The explanations describe what the available evidence shows. A run or a gap can help explain the buildup, but it does not prove that the same action would always produce a goal.

## Where the project stands

The replay, live synthetic feed, clickable explanations, automatic sequence recaps and Operator console are deployed publicly on Azure Container Apps, which reaches Foundry through a managed identity with no API keys.

**Microsoft Foundry powers the buildup explanations and sequence recaps.** It writes audience- and language-specific narratives with versioned evidence citations. Measured geometry and replay targets remain code-derived. The replay shows measured evidence immediately while a story is being generated, and clearly identifies deterministic fallback. Generated stories are cached in memory, so the first run of a sequence can take longer than a repeat.

Recorded checks are published in [`public/verification.json`](public/verification.json) and shown in **Inside the intelligence**. They cover 40/40 controlled checks, 4/4 approved live Foundry cases and a reviewer-corrected false-save fault. These are integration evidence, not an independent AI quality benchmark. The [public 1:50 demo video](https://www.youtube.com/watch?v=qVZuNPllBsk) is uploaded.

All teams, players and match data are fictional and created for this project. This is a hackathon prototype, not a live Premier League data service.

## Run locally

Install Node.js 22.12 or later, then install the project:

```sh
npm ci
npm run setup:auth
```

Start the match and explanation service in one terminal:

```sh
npm run dev:api
```

Start the app in a second terminal:

```sh
npm run dev
```

Open the local address printed in that terminal. The demo opens immediately without registration or sign-in (`PUBLIC_DEMO=true`). Choose **Open workspace → Enter Workspace** to inspect the broadcast console and aggregate monitoring without a password. The default setup runs without Azure credentials. To enable Foundry, copy `.env.example` to `.env`, set the Responses endpoint and deployment name, set `FOUNDRY_ENABLED=true`, and run `az login` before starting the API. Never use `VITE_` variables for credentials. See the Foundry setup guide below.

## Further details

- [Foundry setup guide](docs/foundry-setup.md)
- [How the app is built](docs/architecture.md)
- [Explanation service and evidence checks](docs/api/intelligence.md)
- [Development progress](docs/progress.md)

For development checks, run `npm test` and `npm run build`.

## Check Foundry

`npm run check:foundry` makes one real model call and fails if the app falls back. `node --env-file=.env --import tsx scripts/evaluate-foundry.ts` checks six authored outcomes plus an early Spanish analyst snapshot; it uses paid inference and records latency, token usage and cited narratives in `docs/evaluations/foundry.json`. These are integration checks, not a held-out quality benchmark.

## Agent collaboration

Foundry now runs a match analyst, storyteller and evidence reviewer with typed shared state and explicit handoffs. The reviewer can return a draft for one correction or block publication; unapproved prose falls back to measured explanations. Expand **Agent collaboration** in the notebook for the actual role trace and review issues. All three roles currently use the same deployment through custom TypeScript orchestration.

See [workflow, recovery limits and comparison](docs/multi-agent.md) and [evidence-preserving validation repair](docs/validation-repair.md). `npm run evaluate:agents` makes bounded paid model calls and records the authored single-versus-multi comparison plus a controlled semantic fault. Set `FOUNDRY_ORCHESTRATION=single-agent` to restore the baseline. This feature does not establish enterprise readiness or guarantee an award.

## Enterprise access and operations

The workspace now uses expiring HttpOnly sessions, viewer/operator permissions, CSRF protection, request/job/feed limits and structured operational telemetry. Public judge access is enabled with `PUBLIC_DEMO=true`; any visitor can enter the inspection workspace without a password. `setup:auth` is only for an optional private local deployment. Entra is optional for a private enterprise deployment. The Entra JWT/MSAL deployment path is implemented and cryptographically tested, but still needs a real tenant app registration and SSO verification. Operator mode exposes **Operations pulse**; metrics endpoints require operator access. Foundry agents remain connected, with inference scheduled at a useful buildup checkpoint and the outcome to preserve the model budget.

Run `npm run evaluate:enterprise` for forty reserved-case stress checks, `npm run evaluate:enterprise -- --live` for bounded paid inference, and `npm run check:load` for a controlled local HTTP concurrency/limit check. Read [enterprise controls, results and remaining gaps](docs/enterprise-readiness.md) before deployment.

## Judge walkthrough

Open **Inside the intelligence** for the five-stage pipeline, current Foundry handoffs, the recorded false-save correction and evaluation limits. Choose **Open workspace → Enter Workspace** for the broadcast console and Operations pulse. No password is required. [Criteria review](docs/judging-review.md) · [Submission field guide](docs/submission.md).

## Third-party licenses

[Dependency and asset notices](THIRD_PARTY_NOTICES.md) · [Exact lockfile audit](docs/evaluations/dependency-licenses.json). Run `npm run audit:licenses` after installing all dependencies. Notices also ship in the app footer and container; original application code is not relicensed by that notice file.
