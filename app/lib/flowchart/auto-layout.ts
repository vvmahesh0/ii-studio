import ELK, { type ElkNode } from "elkjs/lib/elk-api";
import {
  type Diagram,
  type Positions,
  type EdgeRoute,
  geometryKey,
} from "./contract";
import { layoutGraph } from "./layout-graph";
let engine: InstanceType<typeof ELK> | undefined;
export function prepareLayout() {
  engine ??= new ELK({ workerUrl: "/vendor/elk-worker.min.js" });
  return engine;
}
export async function layoutDiagram(
  document: Diagram,
): Promise<{
  positions: Positions;
  routes: Record<string, EdgeRoute>;
  routeKey: string;
  elapsedMs: number;
}> {
  const started = performance.now();
  const result: ElkNode = await prepareLayout().layout(layoutGraph(document));
  const positions = Object.fromEntries(
    (result.children ?? []).map((n) => [n.id, { x: n.x ?? 0, y: n.y ?? 0 }]),
  );
  const routes: Record<string, EdgeRoute> = {};
  for (const edge of result.edges ?? []) {
    const section = edge.sections?.[0],
      label = edge.labels?.[0];
    if (section)
      routes[edge.id] = {
        points: [
          section.startPoint,
          ...(section.bendPoints ?? []),
          section.endPoint,
        ],
        ...(label && label.x !== undefined && label.y !== undefined
          ? {
              label: {
                x: label.x,
                y: label.y,
                width: label.width ?? 0,
                height: label.height ?? 24,
              },
            }
          : {}),
      };
  }
  return {
    positions,
    routes,
    routeKey: geometryKey(document, positions),
    elapsedMs: performance.now() - started,
  };
}
