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

## Future Foundry adapter boundary

`IntelligenceAdapter.select({ evidence, tools, signal })` returns unknown data, validated as exactly `{ factIds: string[] }`. It may select at most six unique, available facts. Empty selection is allowed only when the packet contains no facts. No generated prose, numbers, coordinates, timestamps or additional fields are accepted. The renderer-facing values are hydrated from trusted evidence after validation. This makes factual selection enforceable; it does not evaluate whether a selected fact is tactically useful.

The pipeline makes one adapter invocation, with a default five-second deadline. Timeout, throw or invalid output returns a clearly marked deterministic fallback. The adapter receives an abort signal and must honor it for network operations; an in-process deadline cannot forcibly terminate an arbitrary adapter that ignores cancellation. The live HTTP handler supplies no adapter and cannot enable one through request input or environment variables.

For Foundry setup at the end:

1. Add the server-only Foundry SDK adapter and deployment configuration; use an appropriate server credential/identity.
2. Map the bounded tools and selection schema to model/tool calls. Bound internal calls and tokens inside that adapter; one pipeline invocation does not by itself bound provider-internal tool rounds.
3. Add explicit opt-in server wiring, cost controls and tracing. Keep credentials out of Vite/frontend variables.
4. Test real provider behavior and failures, grounding, usefulness, latency and cost on held-out scenarios.
5. Introduce a separate typed interpretation/narrative contract if free-form explanation is needed. Citation membership alone cannot validate prose or causal claims.
6. Configure the same-origin API routing and authentication for the chosen production hosting arrangement. The Vite development and preview proxy is already connected.

No Foundry endpoint, model version or SDK API is assumed to be verified by this implementation.

## Validation boundaries

Tests exercise the real local HTTP server, strict input parsing, temporal and receipt cutoffs, corrections/voided goals, missing tracking, defensive copies, selection validation, timeout cancellation, provider errors and EN/ES numeric consistency. Provider behavior is exercised through test-only in-process adapters, not a Foundry emulator or live Foundry deployment. This is backend readiness groundwork, not completed AI reasoning or a final hackathon submission.

## Evidence-based buildup narratives

The response now includes `buildup` (title, summary, limitation and exact fact IDs). Trusted rules generate signed pass progress, receiving-run displacement and nearest-opponent gap change at a fixed destination. Each interval is covered by tracking within the request snapshot. Missing coverage omits the claim; withdrawn events remain excluded. Runs exclude the previous recorded carrier and intervening recorded ball actions, but are not derived from an independently measured possession feed. Home attacks toward x=105 and away toward x=0 in these fixtures.

Fan view selects the first and final passing connections, the largest measured receiving run and the greatest gap change. Analyst view retains all available buildup facts. Selection is a transparent heuristic, not a learned importance score. Space may close or stay steady; run/gap coincidence is not presented as proven causation. EN/ES outputs use the same numeric evidence. Evidence buttons play the cited interval through the existing cinematic run, space or pass renderer. Foundry remains disconnected.
