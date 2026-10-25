import { z } from "zod";
export const FLOW_REVISION = "flow-v1";
export const kinds = [
  "start",
  "end",
  "process",
  "decision",
  "input-output",
  "note",
] as const;
const id = z.string().trim().min(1).max(80);
export const nodeSchema = z
  .object({ id, kind: z.enum(kinds), label: z.string().trim().min(1).max(180) })
  .strict();
export const edgeSchema = z
  .object({
    id,
    source: id,
    target: id,
    label: z.string().trim().max(100).optional(),
  })
  .strict();
export const diagramSchema = z
  .object({
    revision: z.literal(FLOW_REVISION),
    title: z.string().trim().min(1).max(180),
    direction: z.enum(["DOWN", "RIGHT"]),
    assumptions: z.array(z.string().max(300)).max(8),
    nodes: z.array(nodeSchema).max(30),
    edges: z.array(edgeSchema).max(60),
  })
  .strict();
export const clarificationSchema = z
  .object({
    type: z.literal("clarification"),
    question: z.string().trim().min(1).max(500),
    options: z.array(z.string().max(150)).max(4).optional(),
  })
  .strict();
export type Diagram = z.infer<typeof diagramSchema>;
export type FlowNode = z.infer<typeof nodeSchema>;
export type FlowEdge = z.infer<typeof edgeSchema>;
export type Clarification = z.infer<typeof clarificationSchema>;
export type Positions = Record<string, { x: number; y: number }>;
export type EdgeRoute = {
  points: { x: number; y: number }[];
  label?: { x: number; y: number; width: number; height: number };
};
export type FlowSnapshot = {
  document: Diagram;
  positions: Positions;
  routes?: Record<string, EdgeRoute>;
  routeKey?: string;
  viewport: { x: number; y: number; zoom: number; initialized?: boolean };
};

export function graphIssues(d: Diagram): string[] {
  const errors: string[] = [];
  const unique = (ids: string[], name: string) => {
    if (new Set(ids).size !== ids.length)
      errors.push(`${name} IDs must be unique.`);
  };
  unique(
    d.nodes.map((n) => n.id),
    "Node",
  );
  unique(
    d.edges.map((e) => e.id),
    "Edge",
  );
  const nodes = new Map(d.nodes.map((n) => [n.id, n]));
  const starts = d.nodes.filter((n) => n.kind === "start"),
    ends = d.nodes.filter((n) => n.kind === "end");
  if (starts.length !== 1) errors.push("Use exactly one Start.");
  if (!ends.length) errors.push("Include at least one End.");
  const triples = new Set<string>();
  for (const e of d.edges) {
    if (!nodes.has(e.source) || !nodes.has(e.target))
      errors.push(`Arrow ${e.id} references a missing step.`);
    if (e.source === e.target)
      errors.push(
        `Arrow ${e.id} must not connect a step to itself; show the retry steps.`,
      );
    const key = JSON.stringify([
      e.source,
      e.target,
      e.label?.toLowerCase() ?? "",
    ]);
    if (triples.has(key)) errors.push(`Duplicate connection ${e.id}.`);
    triples.add(key);
  }
  for (const n of d.nodes) {
    const outgoing = d.edges.filter((e) => e.source === n.id);
    if (n.kind === "start" && d.edges.some((e) => e.target === n.id))
      errors.push(
        "Start must have no incoming arrows; retry a process step instead.",
      );
    if (n.kind === "end" && outgoing.length)
      errors.push(`End ${n.id} must have no outgoing arrows.`);
    if (n.kind === "decision") {
      const labels = outgoing.map((e) => e.label?.trim().toLowerCase() ?? "");
      if (
        outgoing.length < 2 ||
        labels.some((l) => !l) ||
        new Set(labels).size !== labels.length
      )
        errors.push(
          `Decision ${n.id} needs at least two distinctly labeled branches.`,
        );
    }
  }
  function reachable(seed: string[], reverse = false) {
    const seen = new Set(seed),
      queue = [...seed];
    for (let i = 0; i < queue.length; i++)
      for (const e of d.edges) {
        if ((reverse ? e.target : e.source) !== queue[i]) continue;
        const next = reverse ? e.source : e.target;
        if (!seen.has(next)) {
          seen.add(next);
          queue.push(next);
        }
      }
    return seen;
  }
  const fromStart = reachable(starts.map((n) => n.id)),
    toEnd = reachable(
      ends.map((n) => n.id),
      true,
    );
  for (const n of d.nodes.filter((n) => n.kind !== "note")) {
    if (!fromStart.has(n.id))
      errors.push(`Step ${n.id} is unreachable from Start.`);
    if (!toEnd.has(n.id)) errors.push(`Step ${n.id} has no route to an End.`);
  }
  return [...new Set(errors)];
}
export function topology(d: Diagram) {
  return JSON.stringify([
    d.direction,
    d.nodes.map((n) => [n.id, n.kind]).sort(),
    d.edges.map((e) => [e.id, e.source, e.target]).sort(),
  ]);
}
export function connectedPreview(d: Diagram): Diagram | null {
  const start = d.nodes.find((n) => n.kind === "start");
  if (!start) return null;
  const seen = new Set([start.id]);
  for (let i = 0; i < d.nodes.length; i++)
    for (const e of d.edges)
      if (seen.has(e.source) && d.nodes.some((n) => n.id === e.target))
        seen.add(e.target);
  const nodes = d.nodes.filter((n) => seen.has(n.id)),
    edges = d.edges.filter((e) => seen.has(e.source) && seen.has(e.target));
  return nodes.length >= 3 && edges.length >= 2 ? { ...d, nodes, edges } : null;
}
export function dimensions(n: FlowNode) {
  const lines = Math.ceil(n.label.length / (n.kind === "decision" ? 19 : 27));
  return {
    width: 220,
    height:
      n.kind === "decision"
        ? Math.max(150, 80 + lines * 18)
        : Math.max(
            n.kind === "start" || n.kind === "end" ? 62 : 82,
            34 + lines * 19,
          ),
  };
}

/** Routes are reusable only while geometry stays unchanged. Labels may change freely. */
export function geometryKey(document: Diagram, positions: Positions) {
  return JSON.stringify([
    document.direction,
    document.nodes.map((n) => [n.id, positions[n.id], dimensions(n)]),
    document.edges.map((e) => [e.id, e.source, e.target]),
  ]);
}
