import test from 'node:test';
import assert from 'node:assert/strict';
import { scenarios } from './scenarios';
import { finishState, netDisplacement, NET_CONTACT_DELAY } from './finish';
import { ballMotion } from './motion';

test('keeper reacts after the strike, extends, then lands', () => {
  const s = scenarios[0],
    shot = s.events.find((e) => e.type === 'shot')!;
  assert.equal(finishState(s, shot.at).extension, 0);
  assert.ok(finishState(s, shot.at + 0.3).keeperLift > 0);
  assert.equal(finishState(s, shot.at + 2).landing, 1);
  assert.ok(Math.abs(finishState(s, shot.at + 2).keeperLift) < 1e-8);
});
test('goal celebrations never precede the goal and never occur after a save', () => {
  for (const s of scenarios) {
    const e = s.events.find((e) => e.type === 'goal' || e.type === 'save')!;
    assert.equal(finishState(s, e.at).reaction, 0);
    assert.equal(finishState(s, e.at + 2).reaction, e.type === 'goal' ? 1 : 0);
  }
});
test('ball reaches the back net at contact and rebounds continuously', () => {
  const s = scenarios[0],
    e = s.events.find((e) => e.type === 'goal')!;
  const t = e.at + NET_CONTACT_DELAY;
  assert.ok(Math.abs(ballMotion(s, t).point.x - 107.09) < 1e-8);
  assert.ok(
    Math.abs(ballMotion(s, t - 0.000001).point.x - ballMotion(s, t + 0.000001).point.x) < 0.00003,
  );
  assert.ok(ballMotion(s, t + 0.5).point.x < ballMotion(s, t).point.x);
});
test('net is still before impact, deforms locally and settles with pinned edges', () => {
  assert.equal(netDisplacement(-0.1, 0.5, -2, 0.5, -2), 0);
  assert.ok(netDisplacement(0.1, 0.5, -2, 0.5, -2) > 0);
  assert.equal(netDisplacement(0.1, 1.8, 2, 0.5, -2), 0);
  assert.equal(netDisplacement(0.2, 0, -2, 0.5, -2), 0);
  assert.equal(netDisplacement(0.2, 2.44, -2, 0.5, -2), 0);
  assert.ok(Math.abs(netDisplacement(4, 0.5, -2, 0.5, -2)) < 0.0001);
});
