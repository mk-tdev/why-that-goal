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

## 20 October 2026 — Guided replay

Added a five-chapter director’s replay for each synthetic sequence: first pass, supporting off-ball movement, receiving-space comparison, final pass and finish. Plays each window at half speed, holds the final frame for 3.5 seconds, then advances. Custom chapter controls support pause/resume, replay, previous/next and exit; manual seeking, scenario changes and fallback exit the guide.

The 3D view transitions between chapter-specific camera positions, respects reduced motion, and allows manual orbit. Pitch graphics show gold pass paths, cyan movement traces with an earlier-position marker, and dashed earlier/current receiving-distance rings. Source event IDs, versions and time windows appear in the chapter card. Space changes compare the same fixed receiving point and do not imply causation. The guide is retrospective, deterministic and English-only; Foundry remains disconnected.

28 core tests pass. New tests cover chapter bounds and source references, off-ball possession exclusion, measured space changes and goal/save outcomes across all three scenarios. Desktop inspection confirmed automatic advancement and close camera framing; narrow-screen inspection confirmed the guide moves below the pitch. Existing Three.js bundle-size warning remains.

## 21 October 2026 — Featured attacking sequence

Refined the quick break with late timed runs from Vega and Okafor; the guided off-ball chapter now follows Vega before reception. Replaced capsule actors with articulated knees/elbows, fitted shirts, collars, crests, back numbers, socks, boots and distinct goalkeeper kits. Running animation adds knee recovery, bent arms and restrained body sway, driven by replay distance and speed.

Added camera movement within guide chapters, a lower finish view and closer player inspection. Interactive pitch pins select pass, player and receiving-space evidence, pause playback and frame the subject. The inspector reports current geometry, speed, recent displacement, provenance and possession/flight status. Labels project from world coordinates and separate when nearby; player inspection isolates a recent movement trace. Camera/orbit interaction pauses the guide, and resuming restores the director camera. These remain procedural models and authored synthetic trajectories, not motion capture or a calibrated simulation. Foundry stays disconnected.

Validation: production build and all 28 core tests pass, including bounded speeds, separation and ball-contact alignment after the run changes. Browser checks verified pitch selection, automatic camera transitions and guide pause on inspection. The existing large Three.js chunk warning remains.

## 21 October 2026 — Clear playing surface and contact polish

Docked the director rundown below the pitch and the inspector beside it (below on narrow screens). The WebGL viewport resizes to the available playing surface. Pitch-label placement now searches for free boxes around projected anchors, avoiding player silhouettes, the ball and other labels; crowded labels are omitted. Removed duplicate guide sprite text over the action.

Added a two-link planted/recovery leg solve, kick preparation and follow-through, and a receiving pose. Smoothed close-control offsets around movement, reception and release; a new continuity test caught and eliminated a near-target direction-switch jump. The rendered ball now uses the model’s 11 cm radius and ground-pass rotation follows travelled distance. Added boot soles, sock trim, ears and goalkeeper gloves. Motion remains procedural and synthetic; Foundry is disconnected.

Validation: 32 tests and production build pass. Four new checks cover bounded, non-overlapping labels, completely occupied viewports, ankle clearance through the gait cycle, and millisecond carry continuity across all scenarios. Browser inspection confirmed desktop side docking and 390px stacked layout, plus live player measurements. Existing Three.js chunk-size warning remains.

## 21 October 2026 — Cinematic finish

Added a dedicated Replay finish entry point and extended the final chapter through the goal aftermath. The camera holds the strike/keeper in view, then moves closer to the goalmouth; the finish uses a clean pitch without trajectory graphics and retains the guide below the viewport. The goalkeeper now has a delayed takeoff, extension, flight and landing pose; goal scenarios use a later, speed-bounded goalkeeper route. Scorer/supporter celebrations and subdued defender poses begin only after a recorded goal, never after a save.

Rebuilt both nets with subdivided back, roof and side mesh lines. The ball continues into the goal before rebounding at the back net; a local damped net ripple begins at that contact time and stays pinned to the frame. The poses, rebound and net ripple are authored approximations rather than a full rigid-body/cloth simulation. Foundry remains disconnected.

Validation: 36 tests and production build pass. New checks cover keeper reaction/landing timing, goal-only reactions, back-net contact/rebound continuity and localised net deformation/settling. Browser inspection verified the finish entry point, clean goalmouth framing, visible reactions and extended aftermath. Existing Three.js chunk warning remains.

## 21 October 2026 — Disconnected intelligence backend

Added a loopback HTTP API, strict request/output contracts, bounded snapshot evidence tools, revision-aware citations and server-derived replay targets. An optional adapter interface supports validated fact selection, deadline/abort signaling and explicit fallback reasons. The runtime does not instantiate an adapter or make model calls. The frontend remains independent. Published a local OpenAPI contract and Foundry handoff instructions; free-form explanation validation and live provider integration remain pending.

Validation: 46 tests pass, including 10 backend tests covering real HTTP requests, body/content-type limits, time/receipt boundaries, corrections, missing tracking, malicious selections, timeouts, provider errors and multilingual numeric consistency. The initial sandbox denied local socket binding; the full suite passed with loopback permission. Typecheck and production build pass; existing Three.js chunk warning remains. No Azure resources or external integration were used.

## 21 October 2026 — Replay connected to evidence API

Connected the notebook to the backend through a same-origin Vite proxy on API port 8791 (8787 was occupied by an unrelated SSH tunnel). Requests follow event visibility, audience and language; cancelled/older requests cannot populate the current snapshot. Backend event explanations and measured evidence are selectable directly in the notebook, with replay timestamp and player-focus actions. Loading, unavailable-service fallback and explicit retry states keep the replay usable. Foundry remains disconnected.

Validation: 47 tests pass, including the frontend HTTP client against the real local server, response snapshot mismatch rejection, invalid replay targets, aborts and local-origin acceptance. Browser inspection verified backend measurements and an evidence jump to 72:04, then stopped the API and confirmed visible local fallback with retry. Production build passes; existing Three.js chunk warning remains.

## 24 October 2026 — Explain the buildup

Added rule-based goal/chance summaries with versioned pass-progress, receiving-run and before/after space evidence. Fan view selects up to four key observations; analyst view retains the full chain. Clicking a claim plays its measured interval with the appropriate on-pitch trace/circle and camera. Saved shots and incomplete sequences have distinct narratives. Closing gaps are reported honestly; interpretations explicitly avoid counterfactual causality claims. Foundry remains disconnected.

Validation: 50 tests pass, including narrative citation scope, goal/save differentiation, independent gap calculations, missing tracks and withdrawn passes. Production build passes (existing chunk warning). Browser verification confirmed goal explanation and a receiving-run evidence replay. Local preview uses port 5174 because another application occupies 5173; both local origins are allowed.

## 24 October 2026 — Varied outcomes

Expanded to six sequences: two goals, two saves and two interceptions with no shot. Added a cutback-save route, a counter intercepted at the final pass, and a switch attack cut out earlier. No-shot handling now spans ball ownership, goalkeeper/celebration state, guided breakdown cameras and explanations. Sequence lengths and UI moment counts are dynamic. Failed passes never receive completed-pass metrics; their failure remains explicitly cited.

Validation: 60 tests pass across all six fixtures, including ball contact/continuity, bounded speed, body separation, guide references, goal/save/no-shot outcomes and temporal explanation boundaries. `npm run evaluate:scenarios` produces a six-case outcome/citation report. Production build passes with the existing chunk warning. Browser inspection verified the intercepted sequence and breakdown replay. These fixtures reuse authored paths and are regression coverage, not an independent AI benchmark. Foundry disconnected.

## 24 October 2026 — Automatic sequence recaps

Added an automatic, rule-based recap for every completed sequence, with outcome-specific goal/save/interception wording and cited cards for the final passing connection, receiving movement, space change and decisive event. Recaps render below the replay without covering the pitch; evidence links play the measured interval and a return control restores the recap. Goal/save evidence opens the cinematic finish. Exports include the recap and supporting facts.

Validation: 68 tests pass, including all six outcomes, citation resolution, no early recaps, delayed terminal receipt, withdrawn outcomes, EN/ES citation consistency and invalid-response rejection. Browser verification confirmed automatic appearance, evidence replay and return navigation. Production build passes with existing Three.js size warning. Foundry remains disconnected; narrative selection is deterministic.

## 24 October 2026 — Live synthetic feed

Added a local SSE sequence stream with a server clock and exactly-once versioned event delivery per connection. Live mode advances the stadium, gates evidence to received events, hides future filmstrip moments and produces the recap after completion. Restart and exit controls, a six-second stall watchdog and stream cleanup handle interrupted sessions. No automatic reconnect or resumable stream is claimed. Added API documentation and Foundry setup guidance; Foundry remains disconnected.

Validation: 70 tests pass, including real streamed HTTP responses for all six scenarios, ordering, receipt boundaries, duplicate prevention, invalid queries/origins and client abort cleanup. Browser verified progressive delivery, notebook updates and automatic goal recap. Production build passes with the existing Three.js chunk size warning.

## 25 October 2026 — Live Foundry explanations and recaps

Verified `wtg-insights` (`gpt-6-luna`, Global Standard) and connected the resource Responses endpoint with server-side Entra authentication. Foundry now writes the main buildup story and cited recap cards in the selected language/audience. Number-free model prose is separated from trusted measured facts; invalid references, premature recaps, malformed outputs and timeouts fall back. Citation checks do not prove semantic accuracy.

The API serves measured evidence immediately and polls bounded asynchronous generation, preserving snapshot isolation. Added cached results, concurrency and request budgets, timeout/cooldown behavior and server-only environment configuration. The ignored local environment is enabled; public example defaults to disabled. No Azure roles/resources were changed.

Validation: 73 tests pass. Real HTTP transport and Postman simulation verify success, 429, service errors, invalid citations and timeouts. Seven live calls cover six terminal outcomes and an early Spanish analyst snapshot; all returned validated model narratives. These are authored regression fixtures, not held-out AI evaluation. Production build passes with the existing Three.js warning; dependency audit reports zero vulnerabilities with the pinned Azure identity/UUID dependency combination.

## 25 October 2026 — Purposeful multi-agent review

Added three separately prompted/schema-constrained Foundry agents: match analysis, storytelling and evidence review. A typed coordinator holds one snapshot, hydrates selected facts through bounded evidence tools, and records handoffs. The reviewer sees the full snapshot, requires coverage of every narrative target and can approve, reject or request one correction. Corrections change only flagged targets; accepted sections and recap structure are preserved. A malformed analyst plan can receive one contract repair. Agent/provider failure withholds unapproved prose and retains deterministic explanations.

The notebook exposes live phase progress, evidence lookups, attempts, tokens, handoff reasons and review issues. All roles use the same deployment with separate contexts through custom TypeScript orchestration, not Agent Framework/A2A/MCP. The single-agent baseline remains selectable.

Validation: 82 tests pass, including handoff contexts, review/repair/re-review, rejection, invalid plans, request deadlines, snapshot isolation, trace validation and protection against revision regressions. Real HTTP/Postman simulations exercised all three roles and failure cases. The final live comparison produced reviewed narratives for goal/save/interception in approximately 10–19 seconds. A controlled false-save story passed structural checks but was caught and repaired by the real reviewer. Initial failed runs are retained; this is not a held-out benchmark or proof of general superiority. Production build passes with the existing Three.js chunk warning.

## 25 October 2026 — Enterprise controls and evaluation

Added server-enforced viewer/operator authentication, expiring revocable HttpOnly sessions, CSRF protection, local scrypt password setup and a tenant-bound Entra JWT/MSAL integration path. Actual local access is enabled; tenant application registration/consent and live Entra browser SSO remain deployment work. Added caller/login/job/stream quotas, explicit retry behavior, bounded monitoring, sanitized request audits, protected JSON/Prometheus metrics and an operator operations panel. Sessions, quotas and metrics are process-local; no hosted monitoring or distributed infrastructure is claimed.

Foundry and all three agents remain connected. Inference now runs at one meaningful intermediate checkpoint and the terminal outcome, with fresh measured explanations between them. Four reserved authored attacks and 40 temporal/degraded-data checks exposed and fixed away-team shot-distance/recovery errors. The recorded live evaluation approved four of four cases at approximately 21 seconds p95; independent human semantic review remains pending. A controlled 50-request HTTP run verified authentication, throttling and job deduplication at 27 ms p95, without claiming Foundry scale.

Validation: 92 tests pass, production build passes, dependency audit reports zero vulnerabilities. Browser checks verified both roles, logout/restart revocation and operator restrictions. The live replay approved an intermediate checkpoint, rejected its final AI story and safely published a measured fallback; monitoring recorded both outcomes. See enterprise-readiness.md and the retained evaluation reports for scope and remaining production work.

## 25 October 2026 — Frictionless judging

Enabled explicit public demo access for the hackathon. Judges enter the replay and connected Foundry analysis without credentials; administrative tools remain operator-only. Anonymous calls retain peer-IP request/job/stream quotas and global inference limits. Private deployments can disable public access and optionally use Entra. Browser verification confirmed direct entry, public-demo status and disabled operator mode after restart without a valid session. All 93 tests and the production build pass.

## 25 October 2026 — Public Azure deployment

Deployed the no-login judging experience to Azure Container Apps Consumption in Southeast Asia. One HTTPS origin serves built assets, the evidence API and paced SSE. The app uses an approved user-assigned managed identity with registry-pull and account-scoped inference roles, not a model API key. All three Foundry agents completed a reviewed goal narrative in 12.6 seconds; anonymous access, protected metrics/private files, origin checks, 191 paced SSE frames and automatic recap were verified over the public URL. Browser inspection verified the 3D stadium and a recap evidence jump into the measured receiving run.

Cost controls: 0.25 vCPU / 0.5 GiB, scale zero-to-one, existing registry reused, no dedicated pool or paid log ingestion. Free grants are shared and Foundry token billing remains separate; process budgets reset on restart and do not guarantee a monthly spending cap. Added a production Dockerfile, scoped ingress-IP trust, static isolation/cache/security headers, repeatable deployment and public-verification scripts, and cost/operations guidance. All 95 tests and the production build pass. The retained final HTTPS verification used the cached approved workflow after fixing test-harness agent-name labels, with no change to model output.
