# Enterprise controls and validation

The [public hackathon deployment](deployment.md) now runs on Azure Container Apps Consumption with managed-identity Foundry inference and open judge access. Hosted monitoring remains process-local; no paid log ingestion or pager is configured.

This release adds working access control, caller limits, operational telemetry and reserved-case evaluation around the connected Foundry agents. It is a single-process prototype with concrete enterprise foundations, not an independently certified or production-scale service.

## Access model

**Hackathon default: `PUBLIC_DEMO=true`. Judges open the replay, evidence, live feed and Foundry explanations without accounts, cookies or a sign-in step. Anonymous viewers cannot access operator tools or monitoring. Set `PUBLIC_DEMO=false` to require authentication for all use. Anonymous caller quotas use the socket peer IP; visitors behind a shared proxy share that quota until a trusted ingress identity design is configured. Global Foundry budgets still apply.**

The running API always loads authentication configuration. `AUTH_MODE=local` provides optional operator password access in the public demo; `AUTH_MODE=entra` is optional for a private enterprise deployment. Production still requires HTTPS and explicit origins. The lower-level server factory can omit authentication for loopback tests, but the application entry point cannot disable it through configuration.

For local use, run `npm run setup:auth` once. It generates separate operator/viewer passwords, stores scrypt hashes in ignored `.env`, and puts credentials in ignored `research/local-access.txt` with owner-only permissions. Do not publish either file. Existing credentials are preserved on repeat runs. The browser receives a random opaque HttpOnly, SameSite=Strict cookie and a CSRF token kept in memory. The server stores only a hash of the session token; sessions expire after fifteen minutes by default, rotate on sign-in, and are revoked on sign-out. Sign-out remains available even after request quota exhaustion. Passwords, cookies, bearer tokens and CSRF values are not logged.

The frontend password field is custom styled. Viewer access permits replay, evidence and analysis; operator access also enables the production console and service metrics. APIs enforce the monitoring permission regardless of frontend controls. The event stream uses the same session cookie, is access-checked before starting, and closes at session expiry. The browser returns to sign-in on session expiry/401.

## Microsoft Entra configuration

The code supports single-tenant delegated API access through MSAL Browser and server-side JOSE JWT verification. **No tenant app registration, consent, role assignment or real Entra browser sign-in was performed in this change.** The local checkout currently permits public demo access with optional operator password sessions; JWT security tests use real RSA signatures and test keys, not a live tenant.

To optionally enable Entra for a private deployment, first set `PUBLIC_DEMO=false`, then:

1. Register a single-tenant application (or separate SPA/API registrations). Expose an API scope named `access_as_user`; set the API's requested access-token version to v2. Use `api://<API application ID>` as the default application ID URI.
2. Register the exact frontend SPA redirect `https://<app-host>/redirect.html`. In development the exact localhost URL/port must also be registered. The bundled MSAL v5 redirect bridge is a separate Vite build entry. Serve it and its bundled assets from the application origin with `Cache-Control: no-store`; do not apply Cross-Origin-Opener-Policy to the bridge page.
3. Set `AUTH_MODE=entra`, `ENTRA_TENANT_ID`, `ENTRA_CLIENT_ID` (authorized SPA client), `ENTRA_API_AUDIENCE` (API application GUID), and `ENTRA_API_SCOPE=access_as_user`. Configure `APP_ORIGINS` as explicit frontend origins. Production startup requires HTTPS origins and Entra mode; cookies use Secure and the `__Host-` prefix there.
4. Define an app role `WTG.Operator` on the API for operations access and assign it only to intended operators. Other valid delegated callers receive viewer access. Configure user assignment, MFA/Conditional Access and consent policy in the tenant according to your organization. These external policies are not created or enforced by this repository.
5. Verify actual sign-in, scope consent, role assignment, logout, blocked users, token renewal and redirect behavior on the deployed origin before claiming SSO readiness.

The API verifies signature via the configured tenant's Microsoft signing keys, RS256 algorithm, issuer, API audience, token dates, tenant, authorized client (`azp`), v2 token version, delegated scope and subject. Graph tokens, ID tokens, another tenant/client/audience, altered signatures and missing scope are rejected. Only delegated access is supported here; app-only Prometheus scraping needs a separately designed service-identity authorization path. Account revocation in Entra is not instantly propagated to already minted fifteen-minute local sessions. Session/limiter state is process-local and is cleared on restart.

References: [Microsoft claim validation](https://learn.microsoft.com/en-us/entra/identity-platform/claims-validation), [MSAL v5 redirect bridge](https://learn.microsoft.com/en-us/entra/msal/javascript/browser/redirect-bridge), [JOSE key resolver](https://github.com/panva/jose/blob/main/docs/jwks/remote/interfaces/RemoteJWKSet.md).

## Backpressure and inference controls

| Control | Current process-local default |
|---|---|
| Password sign-in attempts | 5/minute per socket IP |
| Authenticated API requests | 120/minute per principal |
| New AI jobs | 8/minute per principal; duplicate polls reuse a job |
| Feed starts | 10/minute per principal |
| Concurrent event streams | 2/principal, 20/process |
| Active inference jobs | 2/process |
| Foundry upstream requests | 12/minute, 200/process before restart |
| Per workflow | Normally 3 calls; at most 6 with bounded repairs |
| Deadlines | 18 seconds per model call; 90 seconds per workflow |

HTTP limits return `429` and `Retry-After`. The client pauses polling accordingly. Model/job budget exhaustion keeps measured evidence and recap available, with explicit `capacity` fallback; the frontend retries capacity after a minute. Forwarded-IP headers are not trusted. Limiter memory is bounded; unknown callers cannot evict active counters to bypass limits.

To preserve inference for the decisive outcome, the API generates at most one meaningful nonterminal buildup checkpoint per scenario/audience/language within the ten-minute cache window, beginning after two completed passes, plus the terminal outcome. Other moments return current measured explanations with `reason=collecting`. This is deliberate inference scheduling; it does not slow event delivery or suppress measured facts. Evidence and output snapshots remain isolated. All users currently access the same fictional immutable fixture library; this is not a multi-tenant upload/data platform.

Before scaling out, move sessions, quotas and job coordination to shared infrastructure and partition caches/authorization by tenant and dataset. An ingress/WAF should protect untrusted traffic. Current counters do not establish a global spending ceiling or distributed rate limit.

## Operations and monitoring

- `/api/health` is a public liveness/configuration check. It makes no model call.
- `/api/ready` requires authentication and reports readiness/draining plus `modelConnectivity=not_probed`; configured does not mean the model is reachable.
- `/api/ops/metrics` is operator-only JSON: request/error/denial/limit counts, per-route p95, active/completed/approved/fallback jobs, known model calls and token usage, inference p95 and threshold alerts.
- `/api/ops/prometheus` is an operator-protected text exporter for counters/gauges. It is not a deployed scraper or external uptime monitor.
- Operator mode shows **Operations pulse**, refreshing every thirty seconds. Token/call totals reflect completed workflows; failed requests can incur usage that the provider did not report.
- Structured stdout records generated request IDs, normalized route names, status, timing, login/logout outcomes and workflow completion/fallback reason. It excludes bodies, query strings, headers, secrets, user identities and generated prose. The request ID links an inference job to its initiating HTTP request; repeated polls are distinct HTTP requests.

Threshold alerts: fallback fraction above 25% after at least three completions, API 5xx fraction above 5% after at least ten requests, or both AI job slots occupied. The active-capacity signal means busy, not an outage. No Azure Monitor/Application Insights resource, retention pipeline or pager notification is configured yet. Forward stdout and collect metrics on deployment, with an explicit retention/access policy and on-call routing.

## Stronger evaluations

`npm run evaluate:enterprise` runs forty deterministic stress snapshots across four new authored attacks: a goal with closing space, an opening-space save, an interception and an away-team finish with no receiving run. These are separate from the six demo fixtures. Assertions cover exact outcomes, event/receipt visibility, missing tracking, duplicate events and independently calculated pass distance. Additional tests cover withdrawn outcomes and provider failure. The new fixtures exposed and fixed away-team recovery and shot-distance assumptions in the baseline. They are reserved development cases, not blinded external data.

`npm run evaluate:enterprise -- --live` makes bounded paid calls (at most thirty) and records narratives, citations, model/review traces, tokens and latency. Gates are defined in the script before execution: all deterministic checks, at most six calls/twenty-thousand known tokens per workflow, at least 75% approved outputs and p95 generation under thirty seconds. These are engineering gates for this prototype, not a production release or semantic-accuracy certificate. Lexical outcome screening is labeled as such; human semantic review remains pending. See [live report](evaluations/enterprise-live.json).

`npm run check:load` sends fifty real loopback HTTP requests against authentication, limits and a controlled failing provider. Twenty simultaneous identical requests must share one job; excess traffic must be limited, and unauthenticated requests must not invoke inference. It records latency and metrics in [the load report](evaluations/enterprise-load.json). It does not measure Foundry or Azure concurrency capacity.

The final recorded live run approved all four reserved outcomes, with p95 approximately 21 seconds, 27,689 known input tokens and 4,541 output tokens. The controlled local HTTP run measured 27 ms p95, ten throttled requests, ten unauthorized denials and one deduplicated provider invocation. Four samples and one local load run do not establish availability or broad model quality.

Browser verification covered operator/viewer sign-in, role restrictions even with a saved operator preference, logout, and session revocation after server restart. A live quick-break checkpoint was approved; its terminal narrative exhausted review and used the measured fallback. The [operations screenshot](screenshots/enterprise-operations.png) records both outcomes honestly. The checkpoint policy kept this sequence within the upstream request budget; semantic rejection can still occur. All 92 automated tests and the production build pass.

## Enterprise-prize demonstration

Show an unauthenticated request denied, sign in as viewer versus operator, follow a real Foundry story through agent review, then show measured fallback under a simulated provider failure. Inspect request IDs, known usage, rate-limit signals and a reserved-case report. The business case is a studio workflow that exposes provenance, operational health and failure behavior instead of silently publishing unsupported AI text.

Remaining deployment work: real Entra registration/consent verification, managed identity, shared session/limiter/job state, hosted telemetry and alert routing, disaster recovery, tenant/data isolation for customer uploads, independent human model evaluation, and actual hosted load/security testing. This release strengthens the enterprise case without claiming those items are complete.
