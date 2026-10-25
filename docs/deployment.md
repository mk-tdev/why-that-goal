# Public hackathon deployment

Judge URL: **https://why-that-goal.blacksand-18241469.southeastasia.azurecontainerapps.io**

Judges need no account, password, Microsoft tenant or consent screen. The frontend, evidence API and paced synthetic feed share one HTTPS origin. Microsoft Foundry and the analysis → storytelling → evidence-check agents run on the server. The local development server is not needed for the public site.

## Low-cost choice

| Option | Hosting cost model | Fit for this app |
| --- | --- | --- |
| Azure Container Apps Consumption — deployed | Scale to zero; subscription-wide monthly grant of 180,000 vCPU-seconds, 360,000 GiB-seconds and 2 million HTTP requests | Keeps SSE, async jobs and managed-identity Foundry inference together. Reuses an existing registry. |
| Azure App Service F1 | Free tier with 60 CPU minutes/day and shared capacity | Possible small demo, but a hard daily CPU allowance is less suitable for an unpredictable judging session. |
| Render Free | Free web service; idle service sleeps after 15 minutes and may take around a minute to wake | Possible, but would require separate Azure credential setup and has a more visible cold start. |

Sources checked 25 October 2026: [Container Apps pricing](https://azure.microsoft.com/en-us/pricing/details/container-apps/), [billing rules](https://learn.microsoft.com/en-us/azure/container-apps/billing), [App Service Linux pricing](https://azure.microsoft.com/en-gb/pricing/details/app-service/linux/), [Render Free limitations](https://render.com/docs/free).

The deployment uses 0.25 vCPU / 0.5 GiB, zero minimum replicas and one maximum replica. If the entire monthly grant were unused, these resource sizes correspond to about 200 active replica-hours before compute exceeds that grant. Other apps in the subscription share it. Light judging traffic may therefore incur no extra compute charge; this is not a guaranteed zero-dollar bill. Network egress, any registry storage over its included allowance, and **Foundry model tokens** are separate. The existing registry continues its existing Basic-tier charge; this deployment creates no second registry. No dedicated workload pool, custom domain, new database, or paid Log Analytics workspace was created.

Scale-to-zero can produce a cold start, and clears in-memory caches, sessions, quotas and counters. The one-replica cap preserves the prototype's process-local coordination. It is not a distributed production service. The 200-call process budget and twelve-model-calls/minute throttle limit bursts, but restart/scale-to-zero resets the process budget: it is **not** a durable monthly spending cap. Measured fallbacks keep the replay usable when generation is unavailable or rejected.

## Azure resources and access

Nonsecret resource settings are in [`deploy/azure.json`](../deploy/azure.json):

- Resource group: `rg-why-that-goal` (also contains the existing Foundry resource).
- Environment: `cae-why-that-goal`, Consumption, Southeast Asia; no log ingestion destination.
- App: `why-that-goal`; managed HTTPS ingress; Azure platform authentication is not enabled.
- Runtime identity: `id-why-that-goal`; `AZURE_CLIENT_ID` selects it in `DefaultAzureCredential`.
- Existing registry: `acrvillageshadows23894.azurecr.io`; app image repository `why-that-goal`.
- Foundry: existing `why-that-goal` resource and `wtg-insights` deployment.

The user explicitly approved two persistent identity grants: `AcrPull` on the existing registry (role ID `7f951dda-4ed3-4680-a7ca-43fe172d538d`) and `Cognitive Services OpenAI User` on the specific Foundry account (role ID `5e0bd9bd-7b93-4f28-af87-19fc36ad61bd`). No Owner, subscription-wide model permission or API key is needed by the app. The registry pull role can read images throughout that registry; it cannot push them.

The operator password hash is an Azure Container Apps secret. Its private password remains in ignored `research/local-access.txt`; neither it nor `.env` is committed or copied into the image. Viewer sessions are unnecessary for judges. Operator login retains HTTPS-only HttpOnly cookies, CSRF and role checks.

The built frontend is served by the production Node process with content types, cache rules, CSP and source/secret-file isolation. `HOST=0.0.0.0`, `PORT=8080` and `STATIC_DIRECTORY=/app/dist` are image defaults. Startup/readiness/liveness probes call `/api/health` without running inference.

`TRUST_AZURE_INGRESS=true` trusts **only the rightmost** valid `X-Forwarded-For` IP, which [Azure Container Apps appends](https://learn.microsoft.com/en-us/azure/container-apps/ingress-overview). It must stay disabled for direct/untrusted hosting. No additional CDN/proxy is deployed. Request/job/feed quotas remain per caller IP; model budgets remain per process. IP addresses are used as bounded in-memory keys, not emitted in audit logs.

## Rebuild and deploy

Prerequisites: Azure CLI logged into the configured subscription, Docker, Node 24, existing environment/identity and the approved grants. This is a manual deployment; GitHub pushes run validation but do not automatically change the hosted app.

```sh
npm ci
npm test
npm run build
# Generates/preserves the private local operator credential if missing.
npm run setup:auth
az acr login -n acrvillageshadows23894
# Use a fresh tag for each build, then deploy its immutable digest.
docker build --platform linux/amd64 -t acrvillageshadows23894.azurecr.io/why-that-goal:YOUR_TAG .
docker push acrvillageshadows23894.azurecr.io/why-that-goal:YOUR_TAG
python3 scripts/deploy-azure.py --image acrvillageshadows23894.azurecr.io/why-that-goal@sha256:YOUR_DIGEST
node --import tsx scripts/check-deployment.ts https://why-that-goal.blacksand-18241469.southeastasia.azurecontainerapps.io
```

The deploy script reads only the operator hash from ignored `.env`, creates a permission-restricted temporary manifest, deletes it after the CLI completes, and prints only the app hostname/state/revision. Foundry settings come from the nonsecret deployment configuration. `.dockerignore` excludes local credentials, private research, Git history and artifacts. The runtime container is unprivileged and contains production dependencies.

If recreating the environment, use `az containerapp env create -g rg-why-that-goal -n cae-why-that-goal -l southeastasia --logs-destination none --enable-workload-profiles true`. A newly created environment may have a different domain; update `publicOrigin` before deploying. Do not recreate resources casually during judging.

## Verification and operations

The public check runs real HTTPS requests for anonymous entry, protected metrics, blocked private files, allowed/rejected origins, a terminal goal analysis with a reviewed three-agent trace, a cited recap and a complete paced SSE stream. It can make bounded paid Foundry calls on a cache miss. The retained report is [`evaluations/deployment.json`](evaluations/deployment.json). The initial deployed workflow completed all three model roles and was approved in 12.6 seconds. The final assertion run reused that cached narrative (zero new model calls) and received 191 SSE frames. The test harness initially used incorrect agent-name labels; correcting those assertions did not change the model output. This is integration proof, not a load/availability certification or independent semantic benchmark.

Operator sign-in → Operator → Operations pulse shows process-local requests, denials, throttles, AI calls, latency and fallbacks. `/api/ops/metrics` and `/api/ops/prometheus` remain protected. Azure live console logs are available through `az containerapp logs show -g rg-why-that-goal -n why-that-goal --follow`; permanent export, external uptime monitoring and a pager are not configured.

To pause public hosting, open the Container App in the Azure portal and choose **Stop**; choose **Start** to resume. The installed CLI does not expose app stop/start commands; the documented [Stop REST operation](https://learn.microsoft.com/en-us/rest/api/resource-manager/containerapps/container-apps/stop?view=rest-resource-manager-containerapps-2025-07-01) is available for scripting. This does not stop charges for other existing services. To retire the hackathon app, delete only the named Container App and its unused environment/identity after review; **do not delete the resource group**, which contains Foundry. The shared registry serves another project and must be retained.
