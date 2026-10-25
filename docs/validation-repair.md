# Evidence-preserving explanation repair — 25 October 2026

The hourly monitor observed two `invalid-output` fallbacks for the quick-break goal despite working public access and three responding roles. Those monitor summaries did not retain the drafts, so they cannot establish one precise cause for both failures. Fresh diagnosis also reproduced an analyst omitting the required terminal citation before its contract repair; older recorded failures show unsupported causal wording and incomplete per-target citations. Generation is nondeterministic, so a later approval alone is not a fix.

## Changes

- Constrain model output schemas to exact visible fact IDs; terminal recaps are required only for terminal snapshots, recap arrays match the existing one-to-four limit, revision schemas preserve the original card count, and reviews enumerate the exact targets and issue bounds.
- Give the analyst a typed evidence guide, an explicit terminal-citation slot requirement, its rejected plan and the actual host contract error on the one permitted repair.
- Give the writer short observation-focused guidance, per-fact support limits and its rejected draft plus the specific host error for format repairs. Reviewer corrections still preserve accepted targets and return the full merged draft to review.
- Ask the reviewer to audit all target clauses in a complete pass with concise actionable feedback; a re-review still checks the full original snapshot and current citation dependencies.

These are upstream generation/repair changes. `validateNarrative`, `validatePlan`, `validateReview`, snapshot isolation and accepted-target merge checks were not relaxed. A disagreeing, incomplete or unavailable reviewer still withholds AI prose. No automatic provider retries, extra writer revision, cache bypass or quota increase was added. Normal execution uses three calls; at most six with analyst correction and writer revision/re-review.

## Validation

- 104 automated checks pass, including new rejected-plan and rejected-draft feedback regressions, snapshot-specific generation constraints, invented/future evidence, wrong outcomes, incomplete review, persistent disagreement and accepted-card protection.
- Production frontend and Linux/amd64 container builds pass; 133-entry dependency notice audit remains clean.
- The existing Postman simulation ran eight scenarios over the actual Responses HTTP transport. Its member served 21 requests, including combined contract repair and false-save repair; malformed evidence, rejection, 429/503 and timeout still preserve fallback. See its context file for scope.
- [Fresh real Foundry evaluation](evaluations/validation-repair-live.json) records seven predeclared uncached local-coordinator workflows: repeated goal, analyst, save, interception, Spanish analyst and an early snapshot. It retains every result rather than rerunning failures until green. All seven passed in the recorded run, using 23 calls in total; the Spanish analyst case required one semantic revision. The report's final `passed` flag and cases are authoritative; this is authored integration coverage, not an independent accuracy benchmark or controlled before/after experiment.
- [Deployed access report](evaluations/deployment.json) and [goal/save/interception walkthrough](evaluations/judging-access.json) verify the hosted managed-identity path separately. API polls read completed results from cache; `generationObserved` distinguishes a newly observed pending workflow from an already cached approval.

A model can still produce an unsupported interpretation or reject a valid one. Safe fallback remains part of correct behavior; these changes reduce avoidable contract mistakes and improve correction context rather than guaranteeing approval or weakening the evidence standard.

## Deployed result

Revision `why-that-goal--0000004` passed the public access/session/feed checks. Its goal, save and interception workflows were all approved with three model calls each; save/interception generation was observed pending-to-approved in the walkthrough, and the goal was generated in the preceding deployment check then read from cache in the walkthrough. Every recap retained valid clickable evidence. These are actual managed-identity calls, separate from local credentials and simulation. The local monitor incident state was marked recovered after these checks.
