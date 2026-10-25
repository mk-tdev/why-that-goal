import { configuredFoundry } from '../server/foundry';
import { analyze } from '../server/pipeline';
const adapter = configuredFoundry();
if (!adapter) throw new Error('Foundry not configured');
const result = await analyze(
  { scenarioId: 'quick-break', through: 19, receivedThrough: 19, audience: 'fan', language: 'en' },
  adapter,
  adapter.timeoutMs ?? 20000,
);
console.log(
  JSON.stringify(
    {
      mode: result.mode,
      reason: result.reason,
      provider: result.provider,
      trace: result.trace,
      story: result.buildup,
      recap: result.recap,
    },
    null,
    2,
  ),
);
if (result.mode !== 'model-selected') process.exitCode = 1;
