import test from 'node:test';
import assert from 'node:assert/strict';
import { projectToSegment, inspectSpace } from './spatial';
import { scenarios } from './scenarios';

test('segment projection clamps before and after endpoints', () => {
  assert.deepEqual(projectToSegment({ x: -5, y: 4 }, { x: 0, y: 0 }, { x: 10, y: 0 }), {
    x: 0,
    y: 0,
  });
  assert.deepEqual(projectToSegment({ x: 20, y: 4 }, { x: 0, y: 0 }, { x: 10, y: 0 }), {
    x: 10,
    y: 0,
  });
  assert.deepEqual(projectToSegment({ x: 5, y: 4 }, { x: 0, y: 0 }, { x: 10, y: 0 }), {
    x: 5,
    y: 0,
  });
});
test('zero length event yields its endpoint', () =>
  assert.deepEqual(projectToSegment({ x: 10, y: 20 }, { x: 3, y: 4 }, { x: 3, y: 4 }), {
    x: 3,
    y: 4,
  }));
test('nearest lane defender uses current tracking and excludes teammates', () => {
  const scene = structuredClone(scenarios[0]);
  const pass = scene.events[1];
  for (const p of scene.players) scene.tracks[p.id] = [{ at: 0, point: { x: 0, y: 0 } }];
  scene.tracks['A-2'] = [
    { at: 0, point: pass.from },
    { at: 4, point: { x: pass.from.x, y: pass.from.y + 2 } },
  ];
  scene.tracks['N-1'] = [{ at: 0, point: pass.from }];
  assert.equal(inspectSpace(scene, pass, 0).lane.player.id, 'A-2');
  assert.equal(inspectSpace(scene, pass, 0).lane.laneDistance, 0);
  assert.ok(inspectSpace(scene, pass, 4).lane.laneDistance > 0);
});
