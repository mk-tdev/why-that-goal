# Foundry simulation — 25 October 2026

Run `postman simulation run postman/simulations/foundry.sim.yaml --port 4900 --output ndjson`, then `node --import tsx scripts/check-foundry-simulation.ts`. The real adapter runs against the local Responses stand-in using a fake bearer token; no Azure credentials are sent.

The Foundry member served success, 429, 503, invalid-citation and delayed-response cases; the simulation log recorded all five POST requests. The actual client returned a model story for success and preserved deterministic goal recaps for each failure. No member was silent. Unsupported routes return 501. The handler checks deployment, store=false and structured-output format. The response envelope follows Microsoft Responses documentation and the observed live output. Owning-team mock discovery was skipped because no signed-in Postman owning workspace was available; this is an authored local stand-in.

CLI 1.74.0 required a manifest file path, not a mock directory, in the simulation member. Initial mock generation under the filesystem sandbox hit a macOS keychain error; the simulation ran with local execution permission. No simulation was published or deployed.

This proves local HTTP wiring and failure behavior; it does not establish Azure authentication or model quality. Separate live results are recorded in docs/evaluations/foundry.json. Do not commit raw simulation logs, which contain full synthetic prompts.

## Multi-agent extension — 25 October 2026

The same manifest now routes strict `analysis`, `storytelling` and `evidence_check` Responses schemas. Run `node --import tsx scripts/check-multi-agent-simulation.ts` after starting the simulation. The recorded run exercised all three roles (15 served requests total in that run), including normal approval, a structurally valid false-save draft repaired after review, reviewer rejection, invalid analyst output, 429, 503 and timeout. The real client returned a three-call approved story for success, a five-call approved repair for the semantic fault, and measured fallback for all rejection/failure cases. No member was silent. This is deterministic fault simulation, not evidence that a real model always detects those errors.

## Validation repair — 25 October 2026

Reused this authored stand-in (no owning-team mock discovered/pulled or resources published). The updated coordinator ran over real HTTP through success, false-save semantic repair, combined analyst-terminal-omission plus writer-number/citation-contract repair, explicit rejection, invalid IDs, 429, 503 and timeout. All eight assertions/paths passed; the single Foundry member served 21 recorded request events and was not silent. The new contract-repair route only supplies a valid repair when the writer receives its rejected draft and the specific host error. The runtime validators and final reviewer remain active; rejected/unsupported results still fall back. Raw request logs remain local in /tmp, not committed. This proves wiring and bounded handling against the stand-in, not real model reliability.
