# Foundry setup for Why That Goal

The app currently runs entirely locally: synthetic SSE events, geometric evidence, deterministic explanations and recaps. Creating Azure resources does **not** connect this app. No Foundry SDK, model deployment or credentials are enabled by this change.

## Prepare the resources when ready

1. Use an Azure subscription you control and open [Microsoft Foundry](https://ai.azure.com). Confirm you have permission to create a Foundry resource/project and deploy a model. Microsoft's [resource quickstart](https://learn.microsoft.com/en-us/azure/foundry/tutorials/quickstart-create-foundry-resources?view=foundry) lists the required roles; ask your subscription administrator if creation is unavailable.
2. Create a dedicated resource group (suggested: `rg-why-that-goal`), Foundry resource and project (suggested: `why-that-goal`). Select a region with model availability and quota for your subscription; do not assume a particular region supports every model.
3. Deploy one small text model first. Microsoft's current quickstart uses `gpt-5-mini`; use it if available, or choose a supported small model with structured output suitable for our evidence selection. Prefer usage-based capacity for this prototype, review the displayed deployment pricing and quota before creating it, and record the **deployment name**, not just the model family. Suggested deployment name: `wtg-insights`.
4. Copy the project endpoint from the project overview. It has the form `https://<resource>.services.ai.azure.com/api/projects/<project>`. Keep the endpoint, deployment name, region and subscription/resource names for integration. Never paste API keys into chat or commit them.
5. For local development, use Microsoft Entra authentication (`az login`) and an appropriately scoped project role. Microsoft's [TypeScript quickstart](https://learn.microsoft.com/en-us/azure/foundry/quickstarts/get-started-code) uses `@azure/ai-projects` and `@azure/identity`. We will add these on the server during integration, not in the browser. For hosting, use a managed identity with the required project permissions.

These are preparation steps, not commands to run against this repo yet. Any future environment variable names will be defined with the actual adapter; the app does not currently read Foundry settings.

## What we still implement before enabling it

- Implement the existing server `IntelligenceAdapter` against the deployed model. Supply only the time-bounded evidence snapshot, audience and language; require selection of valid fact IDs.
- Preserve trusted geometry, versioned citations, replay coordinates and deterministic fallback. The model must not invent distances, event IDs, outcomes or causal certainty.
- Add server-only configuration and explicit opt-in. Keep `/api/health` honest about enabled status. Set request timeout, output limits and bounded retries; reuse results for unchanged evidence. Never call the model on each 100 ms feed tick.
- Test malformed output, unsupported citations, timeout/rate limits, all six goal/save/interception sequences, and no future-event leakage. Run an independent evaluation set before making quality claims.
- Record token usage and latency, then estimate cost from measured requests and the chosen deployment's current rates. Provisioning a project alone is not an application integration test.

No agent service, vector database, search index or video processing is needed for the first adapter: our backend already supplies structured evidence. Add services only when a measured product need warrants them.
