export type Rect = { x: number; y: number; width: number; height: number };
export const overlaps = (a: Rect, b: Rect) =>
  a.x < b.x + b.width && a.x + a.width > b.x && a.y < b.y + b.height && a.y + a.height > b.y;
/** Find the nearest legal label box; omit a label when no uncluttered position exists. */
export function placeLabel(
  anchor: { x: number; y: number },
  bounds: Rect,
  blocked: Rect[],
  width = 150,
  height = 32,
): Rect | null {
  const candidates: Rect[] = [];
  for (const radius of [55, 90, 135, 185, 240])
    for (let i = 0; i < 12; i++) {
      const angle = -Math.PI / 2 + (i * Math.PI) / 6;
      const x = Math.max(
        bounds.x,
        Math.min(bounds.x + bounds.width - width, anchor.x + Math.cos(angle) * radius - width / 2),
      );
      const y = Math.max(
        bounds.y,
        Math.min(
          bounds.y + bounds.height - height,
          anchor.y + Math.sin(angle) * radius - height / 2,
        ),
      );
      const box = { x, y, width, height };
      if (
        width <= bounds.width &&
        height <= bounds.height &&
        !blocked.some((b) => overlaps(box, b))
      )
        candidates.push(box);
    }
  return (
    candidates.sort(
      (a, b) =>
        Math.hypot(a.x + width / 2 - anchor.x, a.y + height / 2 - anchor.y) -
        Math.hypot(b.x + width / 2 - anchor.x, b.y + height / 2 - anchor.y),
    )[0] ?? null
  );
}
