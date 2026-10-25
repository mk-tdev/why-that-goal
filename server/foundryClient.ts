import { DefaultAzureCredential } from '@azure/identity';
import { ProviderFailure } from './contracts';
export type FoundryOptions = {
  endpoint: string;
  deployment: string;
  getToken?: (signal: AbortSignal) => Promise<string>;
  maxCalls?: number;
  budgetWindowMs?: number;
  now?: () => number;
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
export type FoundryCapacity = {
  scope: 'process-local';
  callsPerMinute: number;
  callsPerWindow: number;
  windowSeconds: number;
  remainingMinute: number;
  remainingWindow: number;
  activeRequests: number;
  retryAfterSeconds: number;
};
export type ModelClient = {
  run(call: ModelCall): Promise<ModelResult>;
  capacity?: () => FoundryCapacity;
};
/** Rolling, automatically recovering process budgets. Each agent invocation is a paid request. */
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
  const clock = options.now ?? Date.now;
  const windowMs = options.budgetWindowMs ?? 3600000;
  const maxCalls = options.maxCalls ?? 200;
  const perMinute = options.requestsPerMinute ?? 12;
  let active = 0,
    blockedUntil = 0;
  let recent: number[] = [],
    budget: number[] = [];
  function capacity(): FoundryCapacity {
    const now = clock();
    recent = recent.filter((t) => now - t < 60000);
    budget = budget.filter((t) => now - t < windowMs);
    const until = Math.max(
      blockedUntil,
      recent.length >= perMinute ? (recent[0] ?? now) + 60000 : 0,
      budget.length >= maxCalls ? (budget[0] ?? now) + windowMs : 0,
      active >= 2 ? now + 1000 : 0,
    );
    return {
      scope: 'process-local',
      callsPerMinute: perMinute,
      callsPerWindow: maxCalls,
      windowSeconds: windowMs / 1000,
      remainingMinute: Math.max(0, perMinute - recent.length),
      remainingWindow: Math.max(0, maxCalls - budget.length),
      activeRequests: active,
      retryAfterSeconds: Math.max(0, Math.ceil((until - now) / 1000)),
    };
  }
  return {
    capacity,
    async run(call) {
      const available = capacity();
      if (call.signal.aborted) throw new ProviderFailure('timeout', 0);
      if (
        available.retryAfterSeconds > 0 ||
        active >= 2 ||
        available.remainingWindow === 0 ||
        available.remainingMinute === 0
      )
        throw new ProviderFailure('capacity', 0);
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
        const afterAuth = capacity();
        if (
          afterAuth.remainingWindow === 0 ||
          afterAuth.remainingMinute === 0 ||
          clock() < blockedUntil
        )
          throw new ProviderFailure('capacity', 0);
        recent.push(clock());
        budget.push(clock());
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
        if (response.status === 429) {
          const header = response.headers.get('retry-after');
          const seconds =
            header && /^\d+(\.\d+)?$/.test(header)
              ? Number(header)
              : header
                ? (Date.parse(header) - clock()) / 1000
                : 20;
          blockedUntil =
            clock() +
            Math.min(3600000, Math.max(1000, (Number.isFinite(seconds) ? seconds : 20) * 1000));
          throw new ProviderFailure('capacity', 1);
        }
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
        // Locally exhausted budgets have their own expiry; do not prolong them on each poll.
        if (!(error instanceof ProviderFailure && error.reason === 'capacity'))
          blockedUntil = Math.max(blockedUntil, clock() + 20000);
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
