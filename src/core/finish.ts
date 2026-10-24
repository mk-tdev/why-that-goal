import type { Scenario } from './model';
const clamp = (n: number) => Math.max(0, Math.min(1, n));
const smooth = (n: number) => {
  const u = clamp(n);
  return u * u * (3 - 2 * u);
};
export const NET_CONTACT_DELAY = 2.09 / 24;
export function finishState(s: Scenario, t: number) {
  const shot = s.events.find((e) => e.type === 'shot') ?? s.events.at(-1)!;
  const outcome = s.events.find((e) => e.type === 'goal' || e.type === 'save') ?? s.events.at(-1)!;
  const launch = shot.type === 'shot' ? shot.at + 0.12 : Infinity;
  const elapsed = t - launch;
  const extension = smooth(elapsed / 0.32);
  const landing = smooth((elapsed - 0.42) / 0.48);
  return {
    shot,
    outcome,
    extension,
    landing,
    keeperLift: elapsed <= 0 ? 0 : Math.sin(Math.PI * clamp(elapsed / 0.9)) * 0.5,
    keeperRoll: extension * (1.45 + 0.05 * landing) * (outcome.from.y < 34 ? 1 : -1),
    reaction: outcome.type === 'goal' ? smooth((t - outcome.at - 0.3) / 0.65) : 0,
    impact: t - outcome.at - NET_CONTACT_DELAY,
  };
}
/** Localised damped deformation of the back net, pinned to the frame. */
export function netDisplacement(
  impact: number,
  height: number,
  lateral: number,
  hitHeight: number,
  hitLateral: number,
) {
  if (impact <= 0 || height <= 0 || height >= 2.44 || Math.abs(lateral) >= 3.66) return 0;
  const radius = Math.hypot(height - hitHeight, lateral - hitLateral);
  const arrived = impact - radius / 0.9;
  if (arrived <= 0) return 0;
  return (
    0.42 *
    Math.sin(arrived * 15) *
    Math.exp(-arrived * 3.2) *
    Math.exp(-radius * 1.1) *
    Math.sin((Math.PI * height) / 2.44) *
    Math.cos((Math.PI * lateral) / 7.32)
  );
}
