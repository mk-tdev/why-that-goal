import { scenarios } from '../src/core/scenarios';
import { streamFeed } from './feed';
import { createServer } from 'node:http';
import { ContractError } from './contracts';
import { type IntelligenceAdapter } from './pipeline';
import { createAnalysisService } from './analysisService';
export function createApiServer(
  feedOptions: {
    intervalMs?: number;
    speed?: number;
    adapter?: IntelligenceAdapter;
  } = {},
) {
  const analysis = createAnalysisService(feedOptions.adapter);
  return createServer(async (req, res) => {
    const send = (status: number, body: unknown) => {
      res.writeHead(status, {
        'Content-Type': 'application/json',
        'Cache-Control': 'no-store',
        'X-Content-Type-Options': 'nosniff',
      });
      res.end(JSON.stringify(body));
    };
    if (req.method === 'GET' && req.url === '/api/health')
      return send(200, {
        status: 'ok',
        foundry: feedOptions.adapter ? 'configured' : 'disconnected',
      });

    if (
      req.headers.origin &&
      ![
        'http://127.0.0.1:5173',
        'http://127.0.0.1:5174',
        'http://localhost:5174',
        'http://localhost:5173',
        'http://127.0.0.1:4173',
        'http://localhost:4173',
      ].includes(req.headers.origin)
    )
      return send(403, { error: 'browser_origin_not_enabled' });
    const url = new URL(req.url ?? '/', 'http://localhost');
    if (url.pathname === '/api/feed') {
      if (req.method !== 'GET') return send(405, { error: 'method_not_allowed' });
      const scenario = scenarios.find((s) => s.id === url.searchParams.get('scenarioId'));
      if (
        !scenario ||
        [...url.searchParams.keys()].some((k) => k !== 'scenarioId') ||
        url.searchParams.getAll('scenarioId').length !== 1
      )
        return send(400, { error: 'invalid_feed_request' });
      streamFeed(scenario, res, feedOptions.intervalMs, feedOptions.speed);
      return;
    }
    if (req.url !== '/api/analyze') return send(404, { error: 'not_found' });
    if (req.method !== 'POST') return send(405, { error: 'method_not_allowed' });
    if (req.headers['content-type']?.split(';')[0] !== 'application/json')
      return send(415, { error: 'json_required' });
    try {
      const chunks: Buffer[] = [];
      let size = 0;
      for await (const chunk of req) {
        size += chunk.length;
        if (size > 8192) {
          send(413, { error: 'body_too_large' });
          return;
        }
        chunks.push(Buffer.from(chunk));
      }
      const input: unknown = JSON.parse(Buffer.concat(chunks).toString('utf8'));
      send(200, await analysis(input));
    } catch (error) {
      if (res.headersSent) return;
      send(error instanceof SyntaxError || error instanceof ContractError ? 400 : 500, {
        error:
          error instanceof ContractError
            ? error.message
            : error instanceof SyntaxError
              ? 'invalid_json'
              : 'internal_error',
      });
    }
  });
}
