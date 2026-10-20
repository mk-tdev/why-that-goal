# Implementation progress

## 20 October 2026 — First working slice

- Public repository created at https://github.com/mk-tdev/why-that-goal.
- Three fictional synthetic scenarios, with seed-based background tracking and authored event keyframes.
- Replay, score at replay time, player focus/trails, clickable event evidence, EN/ES fan/analyst templates, recap and overlay export.
- Nine core tests pass, including duplicates, delayed receipts, goal revisions and temporal export bounds.
- TypeScript validation and production build pass.
- Production dependency audit reported zero vulnerabilities at this milestone.
- Browser checks exercised early replay/score state, audience and language switching, non-goal scenario, recap and player focus.
- Desktop and 390px mobile layouts inspected; no horizontal overflow at 390px.

This is a deterministic prototype. No Foundry model calls, server API, semantic verifier, held-out AI evaluation or Azure hosting is implemented yet. The next milestone is the real server-side model/tool path described in [architecture](architecture.md).

## 20 October 2026 — Product reset

The initial interface was rejected by the user. Replaced the entire application shell and visual design with a tactical replay workspace. Removed the marketing hero, metric cards and recap dialog. The pitch now has in-place lane annotations and an earlier-frame comparison; a notebook exposes the underlying geometry.

Added three spatial tests (finite-segment clamping, zero-length segments, opponent selection/time-sensitive tracking), bringing the suite to 12. The prior entry records historical checks of the rejected version, not acceptance of the redesign. See [product reset](product-reset.md) for research, rationale and remaining work. The same synthetic fixture limitations and missing Foundry integration remain.

Redesign verification: production build and all 12 tests passed. Browser checks confirmed playback advancing to the goal, comparison changing clearance from 3.0 m to 3.3 m, player coordinate inspection, and a 390px viewport with no horizontal overflow. Downloaded JSON was checked for exactly three visible events through second 8 and the selected spatial measurement. Desktop screenshot saved as `docs/screenshots/tactical-studio.jpg`.
