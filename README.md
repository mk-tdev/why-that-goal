# Why That Goal?

**The goal is the ending. Discover the play that made it possible.**

Why That Goal? is an interactive football companion built for Microsoft and the Premier League’s **Inside the Game: Developer Hackathon**, tackling **The Synthetic Match Insights Engine for Premier League Studio** challenge.

It turns fictional match events into a story you can explore: follow the attack, understand the key passes and runs, and click an explanation to see the evidence directly on the pitch.

[Our hackathon project](https://innovationstudio.microsoft.com/hackathons/insidethegamedeveloperhackathon/project/126704) · [The challenge](https://innovationstudio.microsoft.com/hackathons/insidethegamedeveloperhackathon/executive_challenge_details/5078/about)

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

The explanations describe what the available evidence shows. A run or a gap can help explain the buildup, but it does not prove that the same action would always produce a goal.

## Where the project stands

The replay, live synthetic feed, clickable explanations and automatic sequence recaps work locally today.

**Microsoft Foundry is not connected yet.** Current explanations use measured match information and predefined wording. The next step is to connect Foundry so it can help select the most useful observations, while keeping every claim tied to the match evidence. Azure hosting, AI evaluation and the final demo video are also still to complete.

All teams, players and match data are fictional and created for this project. This is a hackathon prototype, not a live Premier League data service.

## Run locally

Install Node.js 22.12 or later, then install the project:

```sh
npm ci
```

Start the match and explanation service in one terminal:

```sh
npm run dev:api
```

Start the app in a second terminal:

```sh
npm run dev
```

Open the local address printed in that terminal. No Azure credentials or paid football data subscription are needed for the current demo.

## Further details

- [Foundry setup guide](docs/foundry-setup.md)
- [How the app is built](docs/architecture.md)
- [Explanation service and evidence checks](docs/api/intelligence.md)
- [Development progress](docs/progress.md)

For development checks, run `npm test` and `npm run build`.
