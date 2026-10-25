# Judge access and Foundry capacity review — 25 October 2026

Public app: https://why-that-goal.blacksand-18241469.southeastasia.azurecontainerapps.io

Public video: https://www.youtube.com/watch?v=qVZuNPllBsk (YouTube displayed 1:50 and played in the existing browser session). Independent signed-out video playback is still to be confirmed; existing browser sessions were signed in, so their playback is not proof of anonymous access. The application's HTTP checks below use no browser/account credentials.

## Azure configuration inspected

- Azure subscription: Enabled at inspection. This does not prove future funding or credit balance.
- Foundry account: Succeeded; `wtg-insights` deployment Running/Succeeded.
- Model: `gpt-6-luna`, version `2026-09-22`, GlobalStandard, capacity 100.
- Deployment-reported limit: **100 requests / 60 seconds; 100,000 tokens / 60 seconds**. These are configured limits, not a report of remaining tokens or guaranteed throughput. Other consumers can share quota.
- Container App: ready revision `why-that-goal--0000003`, all ingress traffic to the latest revision, public HTTPS, managed identity, multi-agent inference enabled.
- Scale: 0–1 replicas, 0.25 vCPU / 0.5 GiB. Kept the existing low-cost configuration. A cold start is possible; no always-on replica or paid monitoring service was added.

## Fixed: permanent app-budget exhaustion

Previously, the shared Foundry client stopped after 200 requests over the entire process lifetime, with recovery only on restart. A server that stayed warm through judging could therefore lose AI generation indefinitely.

The client now admits **12 requests per rolling minute and 200 per rolling hour**, with at most two active upstream requests. Calls expire automatically from both windows. The provider's 429 `Retry-After` is honored without automatic paid retries. Tests exercise minute/hour recovery, blocked provider cooldown, and budget races during concurrent token acquisition. Operations pulse and operator JSON metrics display remaining local capacity and retry timing.

A normal workflow uses three requests, at most six with correction/re-review. The hourly limit admits roughly 33 worst-case or 66 normal uncached workflows; cached narratives use no additional model calls. The minute gate still limits bursts. These are admission estimates, not throughput or model-quality guarantees. Separate audience/language/checkpoint variants can require separate generations. A completed cached result remains available when new generation is throttled; fresh evidence and labeled fallback continue to work.

Azure's reported RPM exceeds the app's limit, so no deployment-capacity increase is needed for the paced walkthrough. Token bursts, provider contention, abuse, model review rejection and cold starts can still produce delay/fallback. The app does not maintain a separate Azure TPM meter, distributed budget or durable billing cap. Process budgets reset on scale-to-zero/restart. No finite point-in-time check can guarantee uninterrupted inference through 11 November.

## Reproducible evidence

- `npm run audit:licenses`: all 133 locked entries, zero unresolved; notices are included in the public app and runtime container.
- `npm test`: 101 passing checks, including access, CSRF, revocation, static notice serving and recovering transport limits.
- Production frontend build and Linux/amd64 container build pass; the container build verifies license notices before pruning development packages.
- [Deployment report](evaluations/deployment.json): anonymous replay, no session cookie/sign-in requirement, passwordless inspection workspace, security boundaries, paced event stream and managed-identity three-role goal recap.
- [Judge walkthrough report](evaluations/judging-access.json): goal/save/failed attack outcomes, cited replay evidence, review status and local remaining capacity. Cache use and failures are recorded explicitly. The report's `passed` value is authoritative; this document does not substitute for it.
- Postman public health assertion on the new revision: status 200 and `foundry=configured` passed (one assertion, exit 0; 151 ms in that request). Health alone does not prove successful inference; the walkthrough checks do.

**Observed model variability:** the [initial walkthrough](evaluations/judging-access-initial.json) approved the goal but rejected save/interception output, keeping correct measured outcomes and replay evidence. After the failed-result cache expired, subsequent bounded workflows approved both; the interception required a semantic correction and re-review. The final three-case report reads those labeled cached approvals and leaves **180/200 hourly calls available** at its timestamp. No narrative validators were weakened, no prompt was changed for these cases and no automatic paid retry was added. This is evidence of both successful inference and intermittent guarded fallback, not an all-attempt success rate or a fix for model nondeterminism.


Run the public checks deliberately; uncached inference may be billed:

```sh
node --import tsx scripts/check-deployment.ts https://why-that-goal.blacksand-18241469.southeastasia.azurecontainerapps.io
node --import tsx scripts/check-judging.ts https://why-that-goal.blacksand-18241469.southeastasia.azurecontainerapps.io
```

## During judging

Keep Azure resources, the model deployment, managed-identity grants and billing active through **11 November 2026, 3:59 PM Singapore**. Before submission, run one paced walkthrough and inspect Operations pulse. If quota is temporarily exhausted, wait for the displayed window rather than repeatedly restarting or increasing limits. A fallback is labeled honestly; it is not evidence of a successful model run.

There is no external uptime alert or unattended monitor configured. This review and its reports are point-in-time evidence. If the app cannot obtain approved output, inspect the reported reason, Azure deployment health/quota and identity permissions before claiming Foundry availability. Avoid blanket public load testing or unbounded retries that consume the judging budget.

Portal updates and personal eligibility/rights declarations remain separate from these technical checks. Use [the field guide](submission.md) and the now-linked public video to complete the existing project entry.
