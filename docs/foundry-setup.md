# Foundry setup for Why That Goal

The app now supports server-side Foundry generation through the resource Responses API. The verified deployment is `wtg-insights`, model `gpt-6-luna` (version `2026-09-22`), Global Standard in Southeast Asia. Verification date: 25 October 2026. No API keys are needed for local development.

## Connect this checkout

1. Sign in with `az login` using the Azure account with access to the resource. Azure CLI is already installed on the development machine.
2. Copy `.env.example` to `.env`; set `FOUNDRY_ENABLED=true`, your full resource Responses endpoint, and `FOUNDRY_DEPLOYMENT=wtg-insights`. The local ignored `.env` has already been configured for this checkout. Never put credentials in frontend variables.
3. Run `npm run dev:api` and `npm run dev`. The API reports Foundry configured. Use `npm run check:foundry` to verify an actual generation; health alone does not establish connectivity.
4. Open the notebook. Measured evidence appears immediately; the app polls while Foundry writes. The AI story and recap replace the baseline once the same snapshot is ready. Both link to trusted replay evidence.
5. Set `FOUNDRY_ENABLED=false` and restart the API to return to deterministic mode.

The adapter uses `@azure/identity` and the documented Responses REST API with Entra bearer authentication. On Azure hosting, use a managed identity with the appropriate inference role. No roles were changed during this integration.

See [intelligence contract](api/intelligence.md) for the validation boundaries, local call budgets, timeouts, caching and production limitations.

The following resource-creation notes are retained for setting up another environment.

## Prepare the resources when ready

1. Use an Azure subscription you control and open [Microsoft Foundry](https://ai.azure.com). Confirm you have permission to create a Foundry resource/project and deploy a model. Microsoft's [resource quickstart](https://learn.microsoft.com/en-us/azure/foundry/tutorials/quickstart-create-foundry-resources?view=foundry) lists the required roles; ask your subscription administrator if creation is unavailable.
2. Create a dedicated resource group (suggested: `rg-why-that-goal`), Foundry resource and project (suggested: `why-that-goal`). Select a region with model availability and quota for your subscription; do not assume a particular region supports every model.
3. Deploy one small text model first. Microsoft's current quickstart uses `gpt-5-mini`; use it if available, or choose a supported small model with structured output suitable for our evidence selection. Prefer usage-based capacity for this prototype, review the displayed deployment pricing and quota before creating it, and record the **deployment name**, not just the model family. Suggested deployment name: `wtg-insights`.
4. Copy the project endpoint from the project overview. It has the form `https://<resource>.services.ai.azure.com/api/projects/<project>`. Keep the endpoint, deployment name, region and subscription/resource names for integration. Never paste API keys into chat or commit them.
5. For local development, use Microsoft Entra authentication (`az login`) and an appropriately scoped project role. Microsoft's [TypeScript quickstart](https://learn.microsoft.com/en-us/azure/foundry/quickstarts/get-started-code) uses `@azure/ai-projects` and `@azure/identity`. We will add these on the server during integration, not in the browser. For hosting, use a managed identity with the required project permissions.

For this repository, use the environment variables listed above; they are read by the API process only.

## Remaining work

- Independently evaluate model usefulness, language fidelity, outcome accuracy and unsupported interpretations on held-out synthetic attacks. Citation membership is not semantic validation.
- Add hosted identity, access controls, distributed rate limits, operational tracing and Azure deployment infrastructure.
- Measure end-to-end live-feed behavior under concurrent users and failures, then price measured token usage at the deployment's current rates.
- Independently evaluate the new analyst/storyteller/reviewer workflow on held-out attacks; see [agent orchestration](multi-agent.md). All roles currently use one deployment through separate model invocations.

## Orchestration mode

When enabled, Foundry defaults to the three-agent workflow. Set `FOUNDRY_ORCHESTRATION=single-agent` for the original baseline and restart the API. Each reviewed story normally uses three requests, with a maximum of six including bounded contract correction and one writer revision. Measured evidence continues immediately while agents work.

## Workspace access

The API now requires authentication. Run `npm run setup:auth` once for local access and read the ignored `research/local-access.txt` file. This checkout is already configured. Authentication does not change the Azure identity used by Foundry: `az login` remains the development model credential, and model tokens never reach the browser. Entra production sign-in is a separate application registration; see [enterprise setup](enterprise-readiness.md).
