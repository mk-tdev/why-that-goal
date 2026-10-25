# Local intelligence pipeline, contract v1

Foundry is disconnected. No Azure resources, SDK, credentials or external model calls are involved. The replay notebook calls this backend through the same-origin Vite proxy and falls back to local explanations when unavailable. Run `npm run dev:api` in a second terminal to start the loopback-only service on port 8791. Run `npm test` for core and backend checks (local socket permission is required).

## HTTP contract

The machine-readable contract is [openapi.json](openapi.json). `GET /api/health` reports the disconnected state. `POST /api/analyze` accepts JSON with exactly these fields:

```json
{
  "scenarioId": "quick-break",
  "through": 19,
  "receivedThrough": 19,
  "audience": "analyst",
  "language": "en"
}
```

Supported scenarios: `quick-break`, `switch-play`, `no-finish`. `through` is sequence-relative seconds, bounded to the scenario duration. `receivedThrough` is the receipt-time cutoff, independently bounded to 0–7200 seconds. Both cutoffs must admit an event for it to be visible. Audience is `fan` or `analyst`; language is `en` or `es`. Unknown fields are rejected. No arbitrary events, prompts, credentials or provider switches are accepted through HTTP.

```sh
curl http://127.0.0.1:8791/api/health
curl http://127.0.0.1:8791/api/analyze \
  -H 'Content-Type: application/json' \
  --data '{"scenarioId":"quick-break","through":19,"receivedThrough":19,"audience":"analyst","language":"en"}'
```

Responses include the synthetic evidence snapshot, selected moments with replay timestamps, processing mode, fallback reason, provider name and local latency/call trace. The offline baseline selects the last six event facts; it does not claim intelligent ranking. A selected moment includes its event ID/version, player, timestamp, target coordinates, method and trusted text. Numeric facts include value and metres as the unit.

Errors: 400 invalid JSON/contract/scenario/time; 403 browser Origin not allowed; 404 unknown route; 405 unsupported method; 413 body above 8 KiB; 415 non-JSON input; 500 unexpected server failure. Responses are JSON and not cached. This is a local developer service, not a public production endpoint. Development origins on localhost/127.0.0.1 ports 5173 and 4173 are allowed; no cross-origin CORS access is enabled. Authenticated deployment, public rate limiting and operational logging are separate work.

## Evidence tools

`createEvidenceTools` binds every tool to one request snapshot:

- `snapshot()` returns the score, available facts and limitations, with defensive copies.
- `listEvents(start, end)` accepts at most 30 seconds inside the snapshot. It excludes voided events and resolves revisions before filtering the window.
- `getFact(id)` resolves only exact available, versioned IDs. Missing/stale references fail.

Facts cover recorded events, completed-pass endpoint distance and nearest-opponent distance at reception. Spatial evidence is omitted when tracking coverage is missing. Measurements never use tracking frames after the snapshot cutoff. Tracking is preloaded synthetic data, without independent arrival timestamps; interpolation is retrospective. These measurements do not prove pressure, difficulty, expected goals or tactical causation.

## Foundry narrative adapter

The optional server-only adapter calls the resource-level `/openai/v1/responses` endpoint using Microsoft Entra authentication through `DefaultAzureCredential`. `FOUNDRY_ENABLED=true`, `FOUNDRY_RESPONSES_ENDPOINT` and `FOUNDRY_DEPLOYMENT` configure it; the default remains deterministic. `/api/health` reports `configured` when an adapter is wired; this is configuration state, not a model-connectivity probe.

Foundry returns strict structured output: `{factIds, story: {title, summary}, recap: null | {title, summary, cards: [{title, text, factIds}]}}`. The adapter validates unique visible evidence IDs, string/array bounds, number-free plain prose, no premature recap and a cited terminal outcome. Titles, summaries and recap cards are generated; numerical fact text, outcome enum, event versions, timestamps and replay targets remain trusted code. `mode=model-selected` is retained for client compatibility and now includes the generated story. Legacy selection-only test adapters are still supported.

These checks establish structure and citation membership, **not semantic truth or tactical causality**. A model can still misinterpret valid evidence; the UI labels the prose as a Foundry interpretation. Measurements live in linked evidence rather than model-written numbers. Full language/outcome correctness still needs independent evaluation.

`POST /api/analyze` returns a measured baseline immediately with `reason=generating` and `trace.pending=true` while a bounded background job writes the story. Clients poll the identical request every 1.5 seconds until pending clears. Snapshots, audience and language have separate cache keys; results cannot populate a different snapshot. The frontend aborts obsolete polling. Baseline recaps appear as soon as the terminal event arrives; AI recaps replace them when ready.

Limits per API process: two active jobs, 128 snapshot results, ten-minute success cache, twenty-second failure cache/cooldown, twelve upstream requests per minute, two simultaneous provider calls, and two hundred upstream calls before restart. These are local development controls, not distributed production quotas. Each provider request has an eighteen-second timeout, the single-agent pipeline a twenty-second deadline, no automatic provider retry, `store:false`, and a 1600-output-token ceiling for the retained baseline. Empty evidence does not call the model. Cache hits do not consume inference. Usage tokens are available in the trace; no credentials or prompt bodies are logged by the app.

Tests exercise the actual HTTP client against contract-shaped local servers and a Postman simulation. Live integration results for six authored fixtures and an early Spanish analyst view are in `docs/evaluations/foundry.json`. This does not establish generalization, independent quality scores or enterprise readiness.

## Evidence-based buildup narratives

The response now includes `buildup` (title, summary, limitation and exact fact IDs). Trusted rules generate signed pass progress, receiving-run displacement and nearest-opponent gap change at a fixed destination. Each interval is covered by tracking within the request snapshot. Missing coverage omits the claim; withdrawn events remain excluded. Runs exclude the previous recorded carrier and intervening recorded ball actions, but are not derived from an independently measured possession feed. Home attacks toward x=105 and away toward x=0 in these fixtures.

Fan view selects the first and final passing connections, the largest measured receiving run and the greatest gap change. Analyst view retains all available buildup facts. Selection is a transparent heuristic, not a learned importance score. Space may close or stay steady; run/gap coincidence is not presented as proven causation. EN/ES outputs use the same numeric evidence. Evidence buttons play the cited interval through the existing cinematic run, space or pass renderer. With Foundry enabled, these facts support the generated interpretation.

## Six-sequence regression library

The API also accepts `cutback-save`, `counter-cut-out` and `switch-intercepted`. The cutback uses a longer switch and a close-range save; the two interception cases end at different passes, with explicit opponent recovery and no shot event. Failed passes are excluded from completed-pass progress/run/space claims; their recorded failure is cited separately in the breakdown explanation. Replay motion supports sequences without a shot or goal.

Run `npm run evaluate:scenarios` to reproduce [the outcome/citation report](../evaluations/scenarios.json). These are authored regression fixtures, including mirrored routes and track swaps to preserve continuity and body separation. They demonstrate outcome coverage beyond the featured quick break, not statistical generalization, independently held-out data or model quality. Foundry can write the narrative while preserving these measurements.

## Automatic sequence recap

`recap` is null until the sequence's terminal event passes both event-time and receipt-time gates. A withdrawn terminal outcome removes the recap. Completed recaps include an outcome enum (`goal`, `save`, `failed-attack`), title, concise summary, snapshot cutoff, terminal evidence ID and cards with exact versioned fact references. The cards select the final completed pass, largest receiving displacement, greatest gap change and decisive outcome. These are the deterministic fallback selection rules; Foundry can select and write different cited cards. Missing measurements are omitted.

The UI renders recaps automatically below the replay after the outcome becomes available, including in immersive stadium mode. Evidence buttons replay the corresponding interval; a return button restores the completed sequence. Goal/save evidence uses the existing cinematic finish chapter. Exports include the current recap and its cited facts. English and Spanish preserve citation identities. On API failure the existing local event fallback remains available; a backend recap is not fabricated. With Foundry enabled, these facts support the generated interpretation.

## Multi-agent execution trace

The configured default now uses `microsoft-foundry-multi-agent`. `trace.workflow` is optional for backward compatibility and carries snapshot ID, running/approved/fallback status, steps, handoffs, review issues, revision count and actual model request count. Pending responses include live progress. Cached completed responses set `trace.calls=0` while preserving the original workflow's `modelCalls` and known token usage.

The workflow has separate role prompts, schemas and handoff contexts; normal execution is three calls, at most six including one analyst contract correction and one writer revision with re-review. Its total deadline is ninety seconds. The independent reviewer sees all visible facts; the writer initially sees only the analyst selection. A model approval is required in addition to code validation before publication. Neither constitutes proof of semantic truth. See [workflow documentation](../multi-agent.md) for transitions, caps, failure behavior and limitations.

## Access, limits and operations

The application entry point now requires configured local/Entra authentication. Local browser access uses a revocable HttpOnly session; cookie-authenticated POSTs require the session CSRF header. Bearer tokens use strict Entra issuer/audience/client/scope validation. `/api/feed` requires the same identity, caps active streams and closes at session expiry.

HTTP rate limits return 429 with Retry-After; AI job/provider budget exhaustion instead returns measured fallback with reason=capacity. Intermediate snapshots outside a useful buildup checkpoint return reason=collecting. The API still serves fresh measured evidence for every event. Authenticated readiness and operator-only JSON/Prometheus metrics expose operational state. See [enterprise controls](../enterprise-readiness.md) and the updated OpenAPI contract for exact routes, configuration and limitations.

Public hackathon mode (`PUBLIC_DEMO=true`) permits anonymous viewer analysis and SSE access; `/api/auth/me` returns `guest: true`. Monitoring remains operator-only. Anonymous quotas use the socket peer IP; global Foundry limits remain active. Entra sign-in is optional for private deployments.

Public workspace entry: `POST /api/auth/demo` (only with `PUBLIC_DEMO=true`) returns an expiring `demo: true` operator inspection session. No password is accepted or required. The session shares the caller IP quota, exposes aggregate monitoring and requires CSRF for subsequent cookie POSTs. It does not expose Azure management permissions.
