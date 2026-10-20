import test from 'node:test';
import assert from 'node:assert/strict';
import { distance, visibleEvents, matchState, interpolate, exportOverlay } from './model';
import { scenarios } from './scenarios';

const scenario = scenarios[0];
test('the score never includes a future goal', () => {
  assert.equal(matchState(scenario.events, 15.99).home, 0);
  assert.equal(matchState(scenario.events, 16).home, 1);
});
test('duplicate arrivals do not double count goals or passes', () => {
  const s = matchState([...scenario.events, ...scenario.events], 20);
  assert.equal(s.home, 1);
  assert.equal(s.passes, 3);
  assert.equal(s.shots, 1);
});
test('a late correction replaces the goal only after it arrives', () => {
  const original = scenario.events.at(-1)!;
  const corrected = { ...original, version: 2, receivedAt: 20, outcome: 'voided' as const };
  const events = [corrected, ...scenario.events];
  assert.equal(matchState(events, 19).home, 1);
  assert.equal(matchState(events, 20).home, 0);
  assert.equal(visibleEvents(events, 20).at(-1)?.version, 2);
});
test('late events are not visible before receipt', () => {
  const late = { ...scenario.events[1], receivedAt: 10 };
  assert.equal(visibleEvents([late], 9).length, 0);
  assert.equal(visibleEvents([late], 10).length, 1);
});
test('passing distance uses metres in a 105 by 68 coordinate system', () => {
  assert.equal(distance({ x: 1, y: 1 }, { x: 4, y: 5 }), 5);
});
test('tracking interpolation clamps and interpolates between timestamped frames', () => {
  const f = [
    { at: 0, point: { x: 0, y: 0 } },
    { at: 10, point: { x: 20, y: 10 } },
  ];
  assert.deepEqual(interpolate(f, 5), { x: 10, y: 5 });
  assert.deepEqual(interpolate(f, -1), { x: 0, y: 0 });
  assert.deepEqual(interpolate(f, 11), { x: 20, y: 10 });
});
test('a saved shot does not become a goal', () =>
  assert.equal(matchState(scenarios[2].events, 30).home, 0));
test('overlay export includes only events visible at the selected time', () => {
  const payload = exportOverlay(scenario, 8, 'analyst', 'es');
  assert.equal(payload.overlays.length, 3);
  assert.ok(payload.overlays.every((o) => o.start <= 8));
  assert.equal(payload.mode, 'deterministic-template');
});
test('all event references resolve and synthetic coordinates stay on the pitch', () => {
  for (const s of scenarios)
    for (const e of s.events) {
      assert.ok(s.players.some((p) => p.id === e.player));
      if (e.recipient) assert.ok(s.players.some((p) => p.id === e.recipient));
      for (const pt of [e.from, e.to])
        assert.ok(pt.x >= 0 && pt.x <= 105 && pt.y >= 0 && pt.y <= 68);
    }
});
