# Evidence-led agent collaboration

Why That Goal uses three specialized Foundry agents and a typed TypeScript coordinator. Each agent has its own instructions, output schema and context. All roles currently use the same `wtg-insights` model deployment; they are separate invocations, not separate model families. This is custom orchestration over Microsoft Foundry Responses, not Microsoft Agent Framework, A2A or MCP integration.

## Responsibilities and handoffs

1. **Match analyst** chooses up to six versioned facts and groups them into progression, receiving-run, space-change, outcome or context findings. Trusted code checks that each finding matches the relevant measurement type and sign. The terminal outcome must be selected when available. The coordinator hydrates the selected IDs through `getFact` before passing them to the writer. Invalid analysis can receive one contract-correction attempt.
2. **Storyteller** receives the validated plan and hydrated facts, plus the requested audience/language and any terminal recap. It writes the story and cited recap. It cannot approve its own text. Number-free plain prose, bounded strings and valid citations are checked in code.
3. **Evidence reviewer** receives the full original time-bounded snapshot, the analyst plan and the draft. It checks the story, recap summary and every card for attribution, outcome, time, citation support, language and causal overclaims. It must explicitly cover every target. It can approve, request revision with concrete issues/citations, or reject.

A revision hands reviewer issues back to the storyteller, adding any requested supporting facts to the writer's available evidence. The coordinator merges changes only into reviewer-flagged targets, preserves accepted sections and card order, and then rechecks the complete draft. The revised draft returns to the reviewer. A second adverse review, explicit rejection, invalid review, timeout or provider error withholds the AI text and publishes the existing measured fallback. There is one storyteller revision at most; a host format correction consumes that same budget. No failed provider request is automatically retried.

The normal route costs three model requests. One analyst correction plus a writer revision/review can raise this to six. Limits: ninety-second workflow deadline, eighteen-second individual request deadline, twelve upstream requests per minute and two hundred per API process before restart. Inference uses low reasoning effort; output ceilings are 1100 tokens for analysis, 1800 for storytelling and 2800 for review. These are ceilings, not a promise of response latency or cost. Partial/failed generations can still incur usage charges. The controls are local process limits, not distributed production governance.

## Shared state and inspection

Each workflow owns an immutable evidence snapshot, hashed snapshot ID, validated plan, draft, review feedback and bounded transition history. No state is shared between different scenario/time/language/audience requests. The API's existing result cache deduplicates polls; the browser keeps live measurements available while generation runs.

`trace.workflow` exposes agent status/attempt, elapsed time, evidence lookups, known token usage, handoff reasons, review issues and final approval/fallback. Pending responses include the latest progress. Expand **Agent collaboration** in the notebook to inspect it without covering the pitch. This is an execution trace with concise outcome summaries, not private model chain of thought.

Set `FOUNDRY_ORCHESTRATION=single-agent` and restart the API for the retained one-call baseline. The default is multi-agent when Foundry is enabled. Disabling Foundry still uses the deterministic engine.

## What we can substantiate

- Unit/integration tests enforce role order, selected-versus-full evidence contexts, revision feedback, rejection, independent review of the revision, bounded attempts, snapshot isolation and safe timeout handling.
- `postman simulation run postman/simulations/foundry.sim.yaml --port 4900 --output ndjson`, followed by `node --import tsx scripts/check-multi-agent-simulation.ts`, runs the real HTTP client through all three roles. The semantic-fault scenario changes a goal story to a false save, then requires review and repair. Reject, malformed analysis, 429, 503 and timeout scenarios preserve fallback.
- `npm run evaluate:agents` makes paid live model calls for three authored goal/save/interception cases, compares single/multi outputs and usage, and injects one controlled semantic outcome error into a writer draft. See `evaluations/multi-agent.json`. The initial development failure is retained in `evaluations/multi-agent-initial.json` to document the token-exhaustion failure and configuration change.

A small authored comparison and a fault injection are not an independent benchmark. More agents are slower and use more tokens than one call; the concrete benefit being tested is a separate review-and-correction gate that the baseline lacks. Model review can miss or invent problems, especially when all roles use the same model. Category eligibility and awards remain the judges' decision.

Microsoft describes sequential and handoff patterns in its [orchestration overview](https://learn.microsoft.com/en-us/agent-framework/workflows/orchestrations/). Our coordinator implements explicit transitions in TypeScript; we do not claim use of that framework. Two development iterations, including reviewer disagreement, remain in the evaluation folder. Reasoning/output budget behavior follows the [Foundry reasoning documentation](https://learn.microsoft.com/en-us/azure/foundry/openai/how-to/reasoning).

## Latest live comparison

The final recorded development run produced reviewed AI output for all three authored cases. The baseline is the retained one-call prompt, so this comparison changes prompts as well as orchestration; it is not a controlled causal ablation.

| Case | Single-agent result | Single latency | Multi-agent result | Multi latency | Multi calls | Writer revisions |
|---|---|---|---|---|---|---|
| quick-break | fallback | 3.1s | model-selected | 9.9s | 3 | 0 |
| cutback-save | model-selected | 3.6s | model-selected | 15.3s | 4 | 0 |
| counter-cut-out | model-selected | 3.5s | model-selected | 19.1s | 5 | 1 |

The controlled false-save story passed the baseline's structural/provenance gate. The real Foundry reviewer flagged the wrong outcome and missing citations, the writer repaired the flagged targets, and re-review approved publication. That workflow used 5 calls and 23.6s. This demonstrates one recovery path, not a measured false-claim detection rate. All outputs and failures are preserved in the linked JSON reports.

## Enterprise scheduling

The authenticated API now runs one useful nonterminal checkpoint per scenario/audience/language cache window (after two completed passes) and the terminal outcome, while intermediate moments use current measured explanations. This prevents per-event inference from consuming the model budget before the recap. Direct evaluation calls still run a complete workflow for the supplied snapshot. Access, per-caller limits and monitoring are documented in [enterprise controls](enterprise-readiness.md).
