import { z } from "zod";
import {
  FLOW_REVISION,
  nodeSchema,
  edgeSchema,
  diagramSchema,
  clarificationSchema,
  graphIssues,
  type Diagram,
  type Clarification,
} from "./contract.ts";
const recordSchema = z.discriminatedUnion("type", [
  z
    .object({
      type: z.literal("diagram"),
      title: z.string().min(1).max(180),
      direction: z.enum(["DOWN", "RIGHT"]),
      assumptions: z.array(z.string().max(300)).max(8).optional(),
    })
    .strict(),
  nodeSchema.extend({ type: z.literal("node") }),
  edgeSchema.extend({ type: z.literal("edge") }),
  clarificationSchema,
  z.object({ type: z.literal("done") }).strict(),
]);
export class FlowRecordStream {
  private buffer = "";
  document: Diagram = {
    revision: FLOW_REVISION,
    title: "",
    direction: "RIGHT",
    assumptions: [],
    nodes: [],
    edges: [],
  };
  clarification: Clarification | null = null;
  errors: string[] = [];
  done = false;
  private metadata = false;
  private changed: (d: Diagram) => void;
  constructor(changed: (d: Diagram) => void = () => {}) {
    this.changed = changed;
  }
  push(text: string) {
    this.buffer += text;
    if (this.buffer.length > 64000)
      throw new Error("The diagram output is too large.");
    let end;
    while ((end = this.buffer.indexOf("\n")) >= 0) {
      const line = this.buffer.slice(0, end);
      this.buffer = this.buffer.slice(end + 1);
      this.line(line);
    }
  }
  private line(raw: string) {
    const line = raw.trim();
    if (!line || line === "```" || line === "```json" || line === "```jsonl")
      return;
    if (this.done) {
      this.errors.push("Return no records after done.");
      return;
    }
    try {
      const r = recordSchema.parse(JSON.parse(line));
      if (r.type === "clarification") {
        if (this.metadata || this.clarification)
          throw new Error("Clarification must be the only response.");
        this.clarification = r;
        return;
      }
      if (this.clarification)
        throw new Error("Clarification must be the only response.");
      if (r.type === "diagram") {
        if (this.metadata)
          throw new Error("Return one diagram metadata record.");
        this.metadata = true;
        this.document = {
          ...this.document,
          title: r.title,
          direction: r.direction,
          assumptions: r.assumptions ?? [],
        };
      } else {
        if (!this.metadata) throw new Error("Begin with diagram metadata.");
        if (r.type === "node") {
          const { type: _, ...node } = r;
          void _;
          if (this.document.nodes.some((n) => n.id === node.id))
            throw new Error("Node IDs must be unique.");
          this.document = {
            ...this.document,
            nodes: [...this.document.nodes, node],
          };
        }
        if (r.type === "edge") {
          const { type: _, ...edge } = r;
          void _;
          if (this.document.edges.some((e) => e.id === edge.id))
            throw new Error("Edge IDs must be unique.");
          this.document = {
            ...this.document,
            edges: [...this.document.edges, edge],
          };
        }
        if (r.type === "done") this.done = true;
      }
      if (this.document.nodes.length > 30 || this.document.edges.length > 60)
        throw new Error(
          "Limit diagrams to 30 steps and 60 arrows; offer to split larger requests.",
        );
      if (!this.errors.length) this.changed(this.document);
    } catch (e) {
      this.errors.push(
        e instanceof z.ZodError
          ? "A record has unsupported or missing fields."
          : e instanceof Error
            ? e.message
            : "Invalid diagram record.",
      );
    }
  }
  finish() {
    if (this.buffer.trim()) this.line(this.buffer);
    this.buffer = "";
    if (this.clarification && !this.errors.length)
      return { clarification: this.clarification, document: null, errors: [] };
    const checked = diagramSchema.safeParse(this.document);
    const errors = [
      ...this.errors,
      ...(!this.done ? ["Finish the diagram with a done record."] : []),
      ...(checked.success
        ? graphIssues(checked.data)
        : ["The diagram exceeds limits or has invalid settings."]),
    ];
    return {
      clarification: null,
      document: checked.success ? checked.data : null,
      errors: [...new Set(errors)],
    };
  }
}
