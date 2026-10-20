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

## 20 October 2026 — Three.js spatial replay

Added a lazy-loaded WebGL stadium with procedural pitch texture, 22 articulated players, goals, 2,400 instanced seats, floodlights, shadows and bloom. Broadcast, overhead and follow cameras support orbit/pan/zoom. The same match-time state drives both renderers and geometry overlays. Added full-width stadium mode, a player dropdown and a 2D fallback with cleanup of GPU resources.

Verified in the browser: real 3D rendering, camera transitions, player focus connected to the notebook, switching to 2D while retaining selection/time, and 390px layout without horizontal overflow. TypeScript/production build and all 12 core tests pass. The 3D chunk is about 155 KB gzipped; Vite retains an uncompressed-chunk size warning. Broad mobile GPU benchmarking and automated context-loss testing have not been performed. This remains synthetic replay with deterministic analysis; Foundry integration is still pending.

## 20 October 2026 — Custom controls and visual refinement

Replaced all three native select menus, the native range input and the details/summary disclosure with shared custom React controls. Menus render in a portal with viewport-aware placement, selected states, descriptive options, arrow/Home/End navigation, typeahead, Escape dismissal and focus return. Replay seeking supports pointer capture, touch, arrow stepping, PageUp/PageDown and Home/End, with an accessible time value and a custom tooltip. Semantic buttons and ARIA remain for accessibility.

Refined camera controls with vector icons, segmented visualization layers, framed scene controls, highlighted timeline progress, filmstrip selection and rounded panel edges. Foundry remains disconnected.

Browser verification: keyboard scenario selection, player typeahead, Escape dismissal, slider increments (0 → 0.1 → 1.1 seconds), language selection and evidence expansion all worked. DOM inspection found zero select elements, native range inputs or details widgets. At 390px, the menu stayed within the viewport and document width remained 390px.

## 20 October 2026 — Football motion

Replaced sliding formation interpolation with smooth speed-bounded routes, receiving/carrying positions, defensive retreat and support runs. Added timed ground passes, lofted switches, shot contact/arrival, goalkeeper reactions, net and save rebounds, distance-driven running animation, contextual ball-phase labels and half-speed playback. Removed the original seeded jitter generator; retained seed as fixture provenance.

19 tests pass, including seven new motion checks: speed bounds, contact/reception alignment, position/height continuity, loft versus ground height, shot speed/outcomes, deterministic scrubbing and player separation. Browser inspection confirmed an airborne switch, half-speed playback and the existing follow camera. These are designed synthetic sequences with approximate animation, not a calibrated football physics or tactics simulator. Foundry remains disconnected.
