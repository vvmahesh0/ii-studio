import { z } from "zod";

const size = z.number().finite().min(0.01).max(20000);
const coordinate = z.number().finite().min(-20000).max(20000);
const color = z
  .object({
    r: z.number().min(0).max(1),
    g: z.number().min(0).max(1),
    b: z.number().min(0).max(1),
    a: z.number().min(0).max(1),
  })
  .strict();
const paint = z
  .object({
    fill: color.optional(),
    stroke: color.optional(),
    strokeWidth: z.number().min(0).max(100).optional(),
    radius: z.number().min(0).max(1000).optional(),
    opacity: z.number().min(0).max(1).optional(),
    shadow: z
      .object({
        x: coordinate,
        y: coordinate,
        blur: z.number().min(0).max(200),
        color,
      })
      .strict()
      .optional(),
  })
  .strict();
const layout = z
  .object({
    axis: z.enum(["horizontal", "vertical", "none"]),
    padding: z.tuple([
      z.number().min(0).max(1000),
      z.number().min(0).max(1000),
      z.number().min(0).max(1000),
      z.number().min(0).max(1000),
    ]),
    gap: z.number().min(0).max(1000),
    align: z.enum(["start", "center", "end"]),
    justify: z.enum(["start", "center", "end", "between"]),
    clip: z.boolean(),
  })
  .strict();
const typography = z
  .object({
    family: z.string().min(1).max(100),
    weight: z.number().min(100).max(900),
    size: z.number().min(1).max(200),
    lineHeight: z.number().min(1).max(500),
    letterSpacing: z.number().min(-10).max(100),
    align: z.enum(["left", "center", "right"]),
  })
  .strict();
export type Color = z.infer<typeof color>;
export type Layout = z.infer<typeof layout>;
export type DesignNode = {
  id: string;
  name: string;
  kind: "frame" | "text" | "shape" | "vector" | "instance";
  x: number;
  y: number;
  width: number;
  height: number;
  sizing: { width: "fixed" | "hug" | "fill"; height: "fixed" | "hug" | "fill" };
  absolute: boolean;
  style: z.infer<typeof paint>;
  layout?: Layout;
  text?: string;
  typography?: z.infer<typeof typography>;
  svg?: string;
  componentRef?: string;
  overrides?: Record<string, string>;
  children: DesignNode[];
};
const node: z.ZodType<DesignNode> = z.lazy(() =>
  z
    .object({
      id: z.string().min(1).max(500),
      name: z.string().min(1).max(200),
      kind: z.enum(["frame", "text", "shape", "vector", "instance"]),
      x: coordinate,
      y: coordinate,
      width: size,
      height: size,
      sizing: z
        .object({
          width: z.enum(["fixed", "hug", "fill"]),
          height: z.enum(["fixed", "hug", "fill"]),
        })
        .strict(),
      absolute: z.boolean(),
      style: paint,
      layout: layout.optional(),
      text: z.string().max(10000).optional(),
      typography: typography.optional(),
      svg: z.string().max(500000).optional(),
      componentRef: z.string().max(500).optional(),
      overrides: z
        .record(z.string().regex(/^\d+(\.\d+)*$/), z.string().max(10000))
        .optional(),
      children: z.array(node).max(500),
    })
    .strict(),
);
export const documentSchema = z
  .object({
    format: z.literal("ii-studio-design"),
    version: z.literal(1),
    source: z
      .object({
        artifactId: z.string().max(200).optional(),
        generationId: z.string().max(200).optional(),
        library: z.enum(["default", "modern"]),
      })
      .strict(),
    viewport: z.object({ width: size, height: size }).strict(),
    components: z.array(node).max(20).default([]),
    root: node,
    warnings: z.array(z.string().max(1000)).max(500).default([]),
  })
  .strict();
export type DesignDocument = z.infer<typeof documentSchema>;
export const MAX_BYTES = 4 * 1024 * 1024;
export const PAYLOAD_MARKER = "II_STUDIO_DESIGN_V1";
export function parsePayload(input: string): unknown {
  if (input.length > MAX_BYTES || utf8Bytes(input) > MAX_BYTES)
    throw new Error("Design payload exceeds the 4 MB limit.");
  let text = input.trim();
  if (!text) throw new Error("Paste a design copied from II studio.");
  if (text.startsWith("II_STUDIO_DESIGN_")) {
    const line = text.indexOf("\n");
    if (line < 0 || text.slice(0, line).trim() !== PAYLOAD_MARKER)
      throw new Error("This design format version is not supported. Update the II studio plugin.");
    text = text.slice(line + 1);
  } else if (!text.startsWith("{")) {
    throw new Error("This is ordinary text. Use Copy for Figma in II studio.");
  }
  let raw: unknown;
  try { raw = JSON.parse(text); }
  catch { throw new Error("This design is incomplete or malformed. Copy it again from II studio."); }
  if (!raw || typeof raw !== "object" || !("format" in raw) || raw.format !== "ii-studio-design")
    throw new Error("This is not an II studio design payload.");
  if (!("version" in raw) || raw.version !== 1)
    throw new Error("This design format version is not supported. Update the II studio plugin.");
  return raw;
}
export function serializePayload(doc: DesignDocument) {
  const value = PAYLOAD_MARKER + "\n" + JSON.stringify(validateDocument(doc));
  if (utf8Bytes(value) > MAX_BYTES) throw new Error("Design payload exceeds the 4 MB limit.");
  return value;
}
export function utf8Bytes(value: string) {
  return encodeURIComponent(value).replace(/%[A-F\d]{2}/gi, "x").length;
}
export function validateDocument(input: unknown): DesignDocument {
  const serialized = typeof input === "string" ? input : JSON.stringify(input);
  if (
    !serialized ||
    serialized.length > MAX_BYTES ||
    utf8Bytes(serialized) > MAX_BYTES
  )
    throw new Error("Design payload exceeds the 4 MB limit.");
  const raw = typeof input === "string" ? parsePayload(input) : input;
  // Bound depth before recursive schema parsing, including malicious non-node objects.
  let count = 0;
  const seen = new Set<object>();
  function bound(value: unknown, depth: number) {
    if (depth > 70) throw new Error("Design nesting exceeds 70 levels.");
    if (value && typeof value === "object") {
      if (seen.has(value)) throw new Error("Circular payload.");
      seen.add(value);
      if (++count > 15000) throw new Error("Payload is too complex.");
      for (const child of Object.values(value)) bound(child, depth + 1);
      seen.delete(value);
    }
  }
  bound(raw, 0);
  const doc = documentSchema.parse(raw);
  const ids = new Set<string>();
  let nodes = 0;
  const definitions = new Set(doc.components.map((c) => c.id));
  const masters = new Map(doc.components.map(c => [c.id,c]));
  let expanded = 0;
  function cost(n: DesignNode): number {
    if(n.kind === "instance") return cost(masters.get(n.componentRef!)!);
    return 1 + (n.svg ? (n.svg.match(/<[a-z][\w:-]*(?=[\s/>])/gi)?.length ?? 0) : 0) + n.children.reduce((s,c)=>s+cost(c),0);
  }
  function check(n: DesignNode, inComponent = false) {
    if (++nodes > 2000) throw new Error("Design exceeds 2000 layers.");
    if (ids.has(n.id)) throw new Error(`Duplicate layer ID: ${n.id}`);
    ids.add(n.id);
    if (n.kind === "text" && (!n.typography || n.text === undefined))
      throw new Error("Text requires content and typography.");
    if (n.kind === "vector" && (!n.svg || !safeSvg(n.svg)))
      throw new Error("Vector must contain a safe, self-contained SVG.");
    if (n.svg && (n.svg.match(/[a-z]/gi)?.length ?? 0) + (n.svg.match(/[-+]?(?:\d*\.)?\d+(?:e[-+]?\d+)?/gi)?.length ?? 0) > 50000)
      throw new Error("Vector geometry is too complex. Simplify the design.");
    if (n.kind !== "vector" && n.svg)
      throw new Error("SVG is only allowed on vectors.");
    if (n.kind !== "frame" && n.children.length)
      throw new Error("Only frames can contain children.");
    if (
      n.kind === "instance" &&
      (inComponent || !definitions.has(n.componentRef ?? ""))
    )
      throw new Error("Missing component reference or nested instance.");
    if (n.kind !== "instance" && (n.componentRef || n.overrides))
      throw new Error("Only instances can reference components.");
    if(n.kind === "instance") for(const path of Object.keys(n.overrides ?? {})) {
      let target: DesignNode | undefined = masters.get(n.componentRef!);
      for(const segment of path.split(".")) target = target?.children[Number(segment)];
      if(!target || target.kind !== "text") throw new Error("Invalid instance text path.");
    }
    for (const c of n.children) check(c, inComponent);
  }
  for (const c of doc.components) {
    if (c.kind !== "frame") throw new Error("Components must be frames.");
    check(c, true);
  }
  check(doc.root);
  for(const c of doc.components) expanded += cost(c);
  expanded += cost(doc.root);
  if(expanded > 8000) throw new Error("Design exceeds the 8000 native-layer budget, including SVG and component instances.");
  if (doc.root.kind !== "frame")
    throw new Error("The document root must be a frame.");
  return doc;
}
export function safeSvg(svg: string) {
  const allowed = new Set(["svg","g","path","rect","circle","ellipse","line","polyline","polygon","title","desc"]);
  const tags = [...svg.matchAll(/<\s*\/?\s*([a-z][\w:-]*)/gi)];
  return (
    /^\s*<svg[\s>]/i.test(svg) &&
    tags.length <= 4000 && tags.every(t=>allowed.has(t[1].toLowerCase())) &&
    !/<\s*(script|foreignObject|image|use|iframe|style|animate|set)\b|\bon\w+\s*=|(?:href|src)\s*=|url\s*\(|<!DOCTYPE|<!ENTITY/i.test(
      svg,
    )
  );
}
export function walk(n: DesignNode): DesignNode[] {
  return [n, ...n.children.flatMap(walk)];
}
