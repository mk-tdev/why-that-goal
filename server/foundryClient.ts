import { DefaultAzureCredential } from '@azure/identity';
import { ProviderFailure } from './contracts';
export type FoundryOptions = {
  endpoint: string;
  deployment: string;
  getToken?: (signal: AbortSignal) => Promise<string>;
  maxCalls?: number;
  requestsPerMinute?: number;
  timeoutMs?: number;
  allowLocalTestEndpoint?: boolean;
};
export type ModelCall = {
  agent: string;
  instructions: string;
  schema: object;
  input: unknown;
  signal: AbortSignal;
  maxOutputTokens?: number;
};
export type ModelResult = { value: unknown; inputTokens: number; outputTokens: number };
export type ModelClient = { run(call: ModelCall): Promise<ModelResult> };
/** Shared transport and process budget. Each agent invocation counts as a separate paid request. */
export function createFoundryClient(options: FoundryOptions): ModelClient {
  const url = new URL(options.endpoint);
  if (
    !(
      url.protocol === 'https:' &&
      url.hostname.endsWith('.services.ai.azure.com') &&
      url.pathname === '/openai/v1/responses' &&
      !url.search &&
      !url.username &&
      !url.password
    ) &&
    !(options.allowLocalTestEndpoint && url.hostname === '127.0.0.1' && url.protocol === 'http:')
  )
    throw new Error('Invalid Foundry Responses endpoint');
  if (!/^[a-zA-Z0-9_-]{1,100}$/.test(options.deployment))
    throw new Error('Invalid deployment name');
  const credential = options.getToken ? null : new DefaultAzureCredential();
  const getToken =
    options.getToken ??
    (async (signal: AbortSignal) => {
      const token = await credential!.getToken('https://ai.azure.com/.default', {
        abortSignal: signal,
      });
      if (!token) throw new Error('Azure authentication unavailable');
      return token.token;
    });
  let calls = 0,
    active = 0,
    blockedUntil = 0;
  let recent: number[] = [];
  return {
    async run(call) {
      const now = Date.now();
      recent = recent.filter((t) => now - t < 60000);
      if (call.signal.aborted) throw new ProviderFailure('timeout', 0);
      if (
        now < blockedUntil ||
        active >= 2 ||
        calls >= (options.maxCalls ?? 200) ||
        recent.length >= (options.requestsPerMinute ?? 12)
      )
        throw new ProviderFailure('provider-error', 0);
      active++;
      const signal = AbortSignal.any([
        call.signal,
        AbortSignal.timeout(options.timeoutMs ?? 18000),
      ]);
      let sent = false;
      try {
        const token = await getToken(signal);
        if (signal.aborted) throw new Error('Cancelled');
        // Recheck after asynchronous authentication so concurrent token acquisition cannot exceed budgets.
        if (
          calls >= (options.maxCalls ?? 200) ||
          recent.length >= (options.requestsPerMinute ?? 12)
        )
          throw new ProviderFailure('provider-error', 0);
        calls++;
        recent.push(Date.now());
        sent = true;
        const response = await fetch(url, {
          method: 'POST',
          signal,
          redirect: 'error',
          headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
          body: JSON.stringify({
            model: options.deployment,
            store: false,
            reasoning: { effort: 'low' },
            max_output_tokens: call.maxOutputTokens ?? 1600,
            instructions: call.instructions,
            input: JSON.stringify(call.input),
            text: {
              format: { type: 'json_schema', name: call.agent, strict: true, schema: call.schema },
            },
          }),
        });
        if (!response.ok) throw new Error(`Foundry HTTP ${response.status}`);
        const body = (await response.json()) as {
          status?: string;
          output?: { type: string; content?: { type: string; text?: string }[] }[];
          usage?: { input_tokens?: number; output_tokens?: number };
        };
        if (body.status !== 'completed') {
          const failure = new ProviderFailure('invalid-output', 1);
          failure.inputTokens = body.usage?.input_tokens;
          failure.outputTokens = body.usage?.output_tokens;
          throw failure;
        }
        const raw = (body.output ?? [])
          .filter((o) => o.type === 'message')
          .flatMap((o) => o.content ?? [])
          .filter((c) => c.type === 'output_text')
          .map((c) => c.text ?? '')
          .join('');
        let value: unknown;
        try {
          value = JSON.parse(raw);
        } catch {
          throw new ProviderFailure('invalid-output', 1);
        }
        return {
          value,
          inputTokens: body.usage?.input_tokens ?? 0,
          outputTokens: body.usage?.output_tokens ?? 0,
        };
      } catch (error) {
        blockedUntil = Date.now() + 20000;
        if (error instanceof ProviderFailure) throw error;
        console.warn(
          'Foundry request failed:',
          error instanceof Error &&
            /^(Foundry HTTP \d+|Incomplete model output)$/.test(error.message)
            ? error.message
            : 'authentication, timeout or response failure',
        );
        throw new ProviderFailure(signal.aborted ? 'timeout' : 'provider-error', sent ? 1 : 0);
      } finally {
        active--;
      }
    },
  };
}
