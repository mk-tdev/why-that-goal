# Architecture and implementation status

## Tactical replay prototype

```text
Seeded authored scenarios
         ↓
Event time + receipt time + latest version per event ID
         ↓
Deterministic score, passing statistics and geometry
         ↓
Fan/analyst EN/ES templates + versioned evidence
         ↓
Annotated replay pitch, earlier-frame comparison, timed overlay JSON
```

The application is a React/TypeScript client built with Vite. It makes no runtime model requests. Google Fonts supplies optional typography; system fallbacks keep the interface usable if fonts are unavailable. Core match functionality needs no network after the app loads.

## Event contract

`MatchEvent` has a stable ID, integer revision, match-relative event time (`at`) and arrival time (`receivedAt`), team, player, optional recipient, coordinates, outcome, and localized display labels. Time is seconds from the sequence start; `baseClock` maps sequence time to the match clock. Coordinates are metres from the left/top of a 105 × 68 pitch.

Events are eligible only when both their event and receipt timestamps are available. Deduplication selects the latest available version per ID before aggregation. A voided goal replaces its earlier version rather than adding a second event. Replaying before a correction's arrival retains the earlier view of the match.

Tracking consists of timestamped positions with linear interpolation. The state engine never uses tracking to assert causal relationships. Fixtures are trusted in-repository data; external feed validation/authentication is not implemented yet.

## Explanation contract

Each current template draws only from an available event and current-time aggregation. It names a versioned event reference. Passing distance is Euclidean distance between the event's recorded endpoints. Shot distance is measured to the centre of goal and is explicitly not a scoring probability.

Fan and analyst variants share the same calculations. Spanish explanations are authored templates, not a translation-service integration. The notebook identifies the source event and geometric method. This establishes provenance, not tactical causality or model reasoning.

## Spatial inspection

`spatial.ts` projects each opponent onto the finite pass segment, clamps to its endpoints, and finds the minimum distance. A separate minimum gives opponent distance to the receiving point. Both are recalculated from interpolated tracking at the displayed frame. The circle radius equals that distance in pitch metres. Comparison shows positions two seconds earlier against the selected event’s known path; it is retrospective analysis, not a live forecast.

## Overlay contract

`exportOverlay` produces JSON with schema version, match ID, synthetic-data provenance, seed, pitch units, audience/language, processing mode and `generatedThrough`. Each overlay carries a start/end time, text, event ID/version and visual target. The export includes no events beyond the selected time. The UI adds a selected-analysis measurement object only once its source event is available; the measurement frame is recorded separately for retrospective comparisons. Version 1.0 is an internal prototype format, not an organizer- or broadcast-vendor-certified schema.

## Next milestone: real grounded inference

- Add a server-side API with a documented request/response contract.
- Create a dedicated Foundry project/deployment arrangement and use managed identity.
- Give the model tools to query bounded event windows and deterministic metrics.
- Validate citations, numbers and temporal scope independently of generated prose.
- Clearly separate observed events, computed quantities and interpretation.
- Exercise the real server against upstream failure simulations before public exposure.
- Evaluate on held-out seeds and adversarial cases; publish outputs, latency and failure counts.
- Add rate/call/token bounds, safe fallback and operational traces.

The existing Azure capability check from planning is not an implemented application integration. No cloud resources are provisioned by the repository.

## Verification boundaries

Core tests check temporal scoring, duplicates, delayed arrivals, correction replacement, coordinate distances, interpolation, saved-shot behavior and current-time overlay scope. These do not establish football realism, narrative usefulness, production resilience or AI quality. Browser checks are reported separately from core tests.

## 3D renderer

`Stadium.tsx` is lazy-loaded with Three.js. The scene maps match x/y metres into world x/z coordinates, centred on the pitch. Players and ball share the same interpolation and selected time as the 2D renderer. Limb animation illustrates motion; it is not measured biomechanics. All geometry, pitch texture, kits, seating and labels are generated locally, without external models or licensed footage.

OrbitControls supplies orbit/pan/zoom. Camera presets interpolate to broadcast, overhead or a player/ball-follow position. Reduced-motion preference disables camera interpolation. WebGL context creation/loss exposes a 2D fallback. A keyboard-accessible dropdown provides player focus alongside canvas picking.

Rendering is capped near 30 fps and device pixel ratio 1.5; seating is instanced. Bloom and output colour conversion use Three.js postprocessing. ResizeObserver resizes render targets. Unmount cancels the animation loop and disposes scene materials, textures, geometries, controls, postprocessing targets and the WebGL context. The 3D chunk is roughly 154 KB gzipped; Vite reports a >500 KB uncompressed-chunk warning. Broad device performance testing remains outstanding.
