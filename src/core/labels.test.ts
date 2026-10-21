import test from 'node:test';
import assert from 'node:assert/strict';
import { placeLabel, overlaps } from './labels';
import { footPose, ballMotion } from './motion';
import { scenarios } from './scenarios';
import { distance } from './model';

test('labels stay in the viewport and avoid players, ball and previous labels', () => {
  const bounds = { x: 12, y: 100, width: 700, height: 300 };
  const obstacles = [
    { x: 280, y: 180, width: 100, height: 130 },
    { x: 390, y: 160, width: 80, height: 100 },
  ];
  for (const anchor of [
    { x: 330, y: 220 },
    { x: 338, y: 228 },
    { x: 350, y: 230 },
  ]) {
    const box = placeLabel(anchor, bounds, obstacles)!;
    assert.ok(box);
    assert.ok(
      box.x >= bounds.x &&
        box.y >= bounds.y &&
        box.x + box.width <= 712 &&
        box.y + box.height <= 400,
    );
    assert.ok(!obstacles.some((b) => overlaps(box, b)));
    obstacles.push(box);
  }
});
test('labels disappear rather than cover a fully occupied viewport', () => {
  const bounds = { x: 0, y: 0, width: 300, height: 200 };
  assert.equal(placeLabel({ x: 150, y: 100 }, bounds, [bounds]), null);
});
test('two-link gait keeps the ankle above turf through stance and recovery', () => {
  for (const speed of [0, 0.2, 1, 4, 8])
    for (let travel = 0; travel < 4; travel += 0.01)
      for (const side of [0, 1]) {
        const p = footPose(travel, speed, side);
        const ankle = 0.94 + p.settle - 0.4 * Math.cos(p.hip) - 0.4 * Math.cos(p.hip + p.knee);
        assert.ok(Math.abs(ankle - (0.14 + p.lift)) < 1e-8);
        assert.ok(ankle >= 0.1399);
      }
});
test('carrying touches have no discontinuous jumps as players begin moving', () => {
  for (const s of scenarios)
    for (let t = 0.001; t < s.duration; t += 0.001) {
      const a = ballMotion(s, t),
        b = ballMotion(s, t - 0.001);
      if (a.phase === 'carry' && b.phase === 'carry' && a.owner === b.owner)
        assert.ok(distance(a.point, b.point) < 0.02, `${s.id} at ${t}`);
    }
});
