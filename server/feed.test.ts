import test from 'node:test';
import assert from 'node:assert/strict';
import { scenarios } from '../src/core/scenarios';
import { feedFrame } from './feed';
import { createApiServer } from './http';
import { analyze } from './pipeline';

test('feed gates event and receipt time and emits each revision once', () => {
  const s = structuredClone(scenarios[0]);
  s.events[0].receivedAt = 7;
  const sent = new Set<string>();
  const early = feedFrame(s, 6, sent);
  assert.ok(early.events.every((e) => e.at <= 6 && e.receivedAt <= 6));
  assert.ok(!early.events.some((e) => e.id === s.events[0].id));
  assert.ok(feedFrame(s, 7, sent).events.some((e) => e.id === s.events[0].id));
  assert.equal(feedFrame(s, 7, sent).events.length, 0);
  assert.equal(feedFrame(s, s.duration, sent).complete, true);
  assert.equal(sent.size, s.events.length);
});
test('real SSE stream delivers ordered frames, then completes with a recap for every fixture', async () => {
  const server = createApiServer({ intervalMs: 2, speed: 250 });
  await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', resolve));
  const address = server.address();
  assert.ok(address && typeof address !== 'string');
  const base = `http://127.0.0.1:${address.port}`;
  try {
    for (const s of scenarios) {
      const response = await fetch(`${base}/api/feed?scenarioId=${s.id}`);
      assert.equal(response.headers.get('content-type'), 'text/event-stream');
      const frames = (await response.text())
        .trim()
        .split('\n\n')
        .map((line) => JSON.parse(line.slice(6)));
      const ids = frames.flatMap((f) => f.events.map((e: { id: string }) => e.id));
      assert.equal(new Set(ids).size, s.events.length);
      assert.equal(ids.length, s.events.length);
      assert.equal(frames.at(-1).complete, true);
      assert.equal(frames.at(-1).time, s.duration);
      for (let i = 0; i < frames.length; i++) {
        const f = frames[i];
        assert.ok(i === 0 || f.time >= frames[i - 1].time);
        assert.ok(
          f.events.every(
            (e: { at: number; receivedAt: number }) => e.at <= f.time && e.receivedAt <= f.time,
          ),
        );
      }
      assert.ok(
        (
          await analyze({
            scenarioId: s.id,
            through: s.duration,
            receivedThrough: s.duration,
            audience: 'fan',
            language: 'en',
          })
        ).recap,
      );
    }
    assert.equal((await fetch(`${base}/api/feed?scenarioId=unknown`)).status, 400);
    assert.equal((await fetch(`${base}/api/feed?scenarioId=quick-break&speed=100`)).status, 400);
    assert.equal(
      (
        await fetch(`${base}/api/feed?scenarioId=quick-break`, {
          headers: { Origin: 'https://example.com' },
        })
      ).status,
      403,
    );
    const controller = new AbortController();
    const stream = await fetch(`${base}/api/feed?scenarioId=quick-break`, {
      signal: controller.signal,
    });
    await stream.body!.getReader().read();
    controller.abort();
  } finally {
    await new Promise<void>((resolve) => server.close(() => resolve()));
  }
});
