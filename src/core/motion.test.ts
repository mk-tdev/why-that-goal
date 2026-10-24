import test from 'node:test';
import assert from 'node:assert/strict';
import { scenarios } from './scenarios';
import { ballMotion, flightFor, playerMotion } from './motion';
import { distance, interpolate } from './model';

test('all player runs stay below the authored sprint limit without teleporting', () => {
  for (const s of scenarios)
    for (const p of s.players) {
      const frames = s.tracks[p.id];
      for (let i = 1; i < frames.length; i++) {
        const dt = frames[i].at - frames[i - 1].at;
        if (dt > 0)
          assert.ok(distance(frames[i].point, frames[i - 1].point) / dt <= 8.51, `${s.id}/${p.id}`);
      }
    }
});
test('ball and players meet at release and pass reception', () => {
  for (const s of scenarios)
    for (const e of s.events) {
      const f = flightFor(e, s.events);
      if (!f) continue;
      assert.ok(distance(interpolate(s.tracks[f.owner], f.start), f.from) < 0.02);
      assert.ok(distance(ballMotion(s, f.start).point, f.from) < 0.02);
      assert.ok(distance(ballMotion(s, f.end).point, f.to) < 0.02);
      if (f.receiver) assert.ok(distance(interpolate(s.tracks[f.receiver], f.end), f.to) < 0.02);
    }
});
test('ball position and height are continuous across every kick and outcome', () => {
  for (const s of scenarios)
    for (const e of s.events) {
      const f = flightFor(e, s.events);
      if (!f) continue;
      for (const t of [f.start, f.end]) {
        const a = ballMotion(s, t - 0.0001),
          b = ballMotion(s, t + 0.0001);
        assert.ok(distance(a.point, b.point) < 0.025, `${s.id} position ${t}`);
        assert.ok(Math.abs(a.height - b.height) < 0.025, `${s.id} height ${t}`);
      }
    }
});
test('long switches rise above the field while ground passes stay low', () => {
  for (const s of scenarios)
    for (const e of s.events.filter((e) => e.type === 'pass')) {
      const f = flightFor(e, s.events)!;
      const ball = ballMotion(s, (f.start + f.end) / 2);
      assert.ok(f.loft ? ball.height > 1 : ball.height <= 0.12);
    }
});
test('shots travel at the intended horizontal speed and terminate at their outcome', () => {
  for (const s of scenarios.filter((s) => s.events.some((e) => e.type === 'shot'))) {
    const shot = s.events.find((e) => e.type === 'shot')!,
      f = flightFor(shot, s.events)!;
    assert.ok(Math.abs(distance(f.from, f.to) / (f.end - f.start) - 24) < 1e-8);
    assert.equal(
      ballMotion(s, f.end + 0.2).phase,
      s.events.some((e) => e.type === 'save') ? 'parry' : 'net',
    );
  }
});
test('motion is deterministic when scrubbing backwards and does not depend on render history', () => {
  const s = scenarios[0],
    first = playerMotion(s, 'N-9', 11);
  playerMotion(s, 'N-9', 18);
  assert.deepEqual(playerMotion(s, 'N-9', 11), first);
  assert.deepEqual(ballMotion(s, 7), ballMotion(s, 7));
});

test('authored runs keep player bodies separated throughout the sequences', () => {
  for (const s of scenarios)
    for (let t = 0; t < s.duration; t += 0.1) {
      const points = s.players.map((p) => interpolate(s.tracks[p.id], t));
      for (let i = 0; i < points.length; i++)
        for (let j = i + 1; j < points.length; j++)
          assert.ok(distance(points[i], points[j]) > 0.75, `${s.id}: overlap at ${t}`);
    }
});
