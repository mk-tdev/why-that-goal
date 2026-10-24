import { test } from 'node:test';
import assert from 'node:assert/strict';
import { scenarios } from './scenarios';
import { buildGuide } from './guide';
import { ballMotion } from './motion';
import { inspectSpace } from './spatial';

for (const scene of scenarios) {
  test(`${scene.id}: chapters remain inside the replay and cite real source versions`, () => {
    const steps = buildGuide(scene);
    assert.equal(steps.length, 5);
    for (const step of steps) {
      assert.ok(step.start >= 0 && step.end <= scene.duration && step.start < step.end);
      assert.ok(scene.events.includes(step.event));
      assert.ok(Number.isFinite(step.anchor.x) && Number.isFinite(step.anchor.y));
    }
    const finish = steps.at(-1)!;
    assert.equal(
      finish.metric,
      scene.events.some((e) => e.type === 'goal')
        ? 'Goal'
        : scene.events.some((e) => e.type === 'save')
          ? 'Saved'
          : 'Intercepted',
    );
  });
  test(`${scene.id}: highlighted runner never carries the ball in the chapter`, () => {
    const run = buildGuide(scene).find((s) => s.kind === 'run')!;
    for (let t = run.start; t <= run.end; t += 1 / 60)
      assert.notEqual(ballMotion(scene, t).owner, run.player);
  });
  test(`${scene.id}: space comparison uses the same target and the measured direction`, () => {
    const step = buildGuide(scene).find((s) => s.kind === 'space')!;
    assert.deepEqual(step.anchor, step.event.to);
    assert.equal(
      step.before,
      inspectSpace(scene, step.event, step.start).receiver.receiverDistance,
    );
    assert.equal(step.after, inspectSpace(scene, step.event, step.end).receiver.receiverDistance);
    if (step.title.includes('opens')) assert.ok(step.after! > step.before!);
    if (step.title.includes('closes')) assert.ok(step.after! < step.before!);
  });
}
