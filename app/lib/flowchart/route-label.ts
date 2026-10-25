import type { EdgeRoute } from "./contract.ts";
/** Keep manual labels visible even on arrows that originally had no label. */
export function routeLabelBox(route: EdgeRoute, text: string) {
  if (!text) return undefined;
  const width = Math.max(route.label?.width ?? 0, text.length * 6.5 + 16);
  if (route.label)
    return {
      ...route.label,
      width,
      x: route.label.x - (width - route.label.width) / 2,
    };
  let a = route.points[0],
    b = route.points[1] ?? a,
    longest = -1;
  for (let i = 1; i < route.points.length; i++) {
    const p = route.points[i - 1],
      q = route.points[i],
      length = Math.hypot(q.x - p.x, q.y - p.y);
    if (length > longest) {
      a = p;
      b = q;
      longest = length;
    }
  }
  if (!a || !b) return undefined;
  return {
    x: (a.x + b.x) / 2 - width / 2,
    y: (a.y + b.y) / 2 - 12,
    width,
    height: 24,
  };
}
