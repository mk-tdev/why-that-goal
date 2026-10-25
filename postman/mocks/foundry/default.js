// Contract-shaped Responses API stand-in. Never receives real Azure credentials.
const http = require('http');
http
  .createServer(async (req, res) => {
    if (req.method !== 'POST' || !req.url.endsWith('/openai/v1/responses')) {
      res.writeHead(501);
      res.end();
      return;
    }
    if (req.url.includes('rate-limit')) {
      res.writeHead(429);
      res.end('{}');
      return;
    }
    if (req.url.includes('unavailable')) {
      res.writeHead(503);
      res.end('upstream unavailable');
      return;
    }
    if (req.url.includes('slow')) {
      await new Promise((r) => setTimeout(r, 500));
      res.end('{}');
      return;
    }
    let input = req.body;
    if (!input) {
      let text = '';
      for await (const chunk of req) text += chunk;
      input = JSON.parse(text);
    }
    if (typeof input === 'string') input = JSON.parse(input);
    if (
      input.model !== 'wtg-insights' ||
      input.store !== false ||
      input.text?.format?.type !== 'json_schema'
    ) {
      res.writeHead(400);
      res.end('{}');
      return;
    }
    const payload = JSON.parse(input.input);
    const { evidence, terminalRecap } = payload;
    const role = input.text.format.name;
    const terminalId = payload.terminalFactId ?? terminalRecap?.terminalFactId;
    const factIds = [...new Set([evidence.facts[0].id, ...(terminalId ? [terminalId] : [])])];
    let value;
    if (role === 'analysis') {
      value = {
        factIds,
        findings: [
          { kind: terminalId ? 'outcome' : 'context', factIds: [terminalId ?? factIds[0]] },
        ],
      };
    } else if (role === 'evidence_check') {
      const decision = req.url.includes('reject')
        ? 'reject'
        : payload.draft.story.summary.includes('goalkeeper saved')
          ? 'revise'
          : 'approve';
      value = {
        decision,
        coveredTargets: payload.targets,
        issues:
          decision === 'approve'
            ? []
            : [
                {
                  target: 'story',
                  reason: 'wrong-outcome',
                  detail: 'The terminal evidence records a goal, not a save.',
                  factIds: [terminalRecap.terminalFactId],
                },
              ],
      };
    } else {
      const faulty = req.url.includes('semantic-fault') && !payload.feedback?.length;
      value = {
        factIds,
        story: {
          title: 'Evidence in the attack',
          summary: faulty
            ? 'The goalkeeper saved the shot.'
            : 'The available evidence describes the recorded play.',
        },
        recap: terminalRecap
          ? {
              title: 'The recorded finish',
              summary: 'Inspect the decisive event to understand the outcome.',
              cards: [
                {
                  title: 'Decisive evidence',
                  text: 'The terminal event records how this attack ended.',
                  factIds: [terminalRecap.terminalFactId],
                },
              ],
            }
          : null,
      };
    }
    if (req.url.includes('invalid')) value.factIds = ['fabricated-evidence'];
    res.setHeader('Content-Type', 'application/json');
    res.end(
      JSON.stringify({
        id: 'resp_simulated',
        status: 'completed',
        output: [
          { type: 'message', content: [{ type: 'output_text', text: JSON.stringify(value) }] },
        ],
        usage: { input_tokens: 100, output_tokens: 50 },
      }),
    );
  })
  .listen(process.env.PORT || 4500);
