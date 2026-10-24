import type { ServerResponse } from 'node:http';
import type { MatchEvent, Scenario } from '../src/core/model';
export type FeedFrame = {
  scenarioId: string;
  time: number;
  events: MatchEvent[];
  complete: boolean;
};
export function feedFrame(s: Scenario, time: number, delivered: Set<string>): FeedFrame {
  const at = Math.min(s.duration, Math.max(0, time));
  const events = s.events.filter(
    (e) => e.at <= at && e.receivedAt <= at && !delivered.has(`${e.id}@${e.version}`),
  );
  events.forEach((e) => delivered.add(`${e.id}@${e.version}`));
  return { scenarioId: s.id, time: at, events, complete: at >= s.duration };
}
export function streamFeed(s: Scenario, res: ServerResponse, intervalMs = 100, speed = 1) {
  res.writeHead(200, {
    'Content-Type': 'text/event-stream',
    'Cache-Control': 'no-cache, no-transform',
    Connection: 'keep-alive',
    'X-Accel-Buffering': 'no',
  });
  res.flushHeaders();
  const started = performance.now(),
    delivered = new Set<string>();
  const send = () => {
    const frame = feedFrame(s, ((performance.now() - started) / 1000) * speed, delivered);
    const writable = res.write(`data: ${JSON.stringify(frame)}\n\n`);
    if (frame.complete || !writable) {
      clearInterval(timer);
      res.end();
    }
  };
  const timer = setInterval(send, intervalMs);
  res.on('close', () => clearInterval(timer));
  send();
}
