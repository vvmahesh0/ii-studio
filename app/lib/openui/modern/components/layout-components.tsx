"use client";
import { defineComponent } from "@openuidev/react-lang";
import { z } from "zod";
import {
  Card as Surface,
  CardHeader,
  CardTitle,
  CardDescription,
  CardContent,
} from "@/components/modern/ui/card";
import { ContentChildUnion } from "../unions";
import { Glyph } from "../../components/glyph";
import { cn } from "cn";
const nodes = z.array(ContentChildUnion);
const space = (value = 4) => Math.max(0, Math.min(24, value)) * 4;
export const Page = defineComponent({
  name: "Page",
  props: z.object({ children: nodes, gap: z.number().optional() }),
  description:
    "Root page container; stacks content vertically. Gap is in 4px units.",
  component: ({ props, renderNode }) => (
    <div
      className="flex min-w-0 flex-col"
      style={{ gap: space(props.gap ?? 6) }}
    >
      {renderNode(props.children)}
    </div>
  ),
});
export const Column = defineComponent({
  name: "Column",
  props: z.object({ children: nodes, gap: z.number().optional() }),
  description: "Vertical layout for any registered content.",
  component: ({ props, renderNode }) => (
    <div className="flex min-w-0 flex-col" style={{ gap: space(props.gap) }}>
      {renderNode(props.children)}
    </div>
  ),
});
export const Section = defineComponent({
  name: "Section",
  props: z.object({ children: nodes, gap: z.number().optional() }),
  description: "Semantic section that stacks children vertically.",
  component: ({ props, renderNode }) => (
    <section
      className="flex min-w-0 flex-col"
      style={{ gap: space(props.gap) }}
    >
      {renderNode(props.children)}
    </section>
  ),
});
export const Row = defineComponent({
  name: "Row",
  props: z.object({
    children: nodes,
    gap: z.number().optional(),
    align: z.enum(["start", "center", "end", "stretch"]).optional(),
    justify: z.enum(["start", "center", "end", "between"]).optional(),
    wrap: z.boolean().optional(),
  }),
  description:
    "Horizontal layout: children, numeric gap, align, justify, wrap. Use Grid for equal-width cards.",
  component: ({ props, renderNode }) => (
    <div
      className="flex min-w-0"
      style={{
        gap: space(props.gap),
        alignItems: props.align ?? "center",
        justifyContent:
          props.justify === "between" ? "space-between" : props.justify,
        flexWrap: props.wrap ? "wrap" : undefined,
      }}
    >
      {renderNode(props.children)}
    </div>
  ),
});
export const Grid = defineComponent({
  name: "Grid",
  props: z.object({
    children: nodes,
    columns: z.number().optional(),
    minWidth: z.number().optional(),
    gap: z.number().optional(),
  }),
  description:
    "Equal-width grid: children, columns (1-12), minWidth in px (default 220), gap in 4px units. Use for KPI cards and pricing plans.",
  component: function LayoutComponentsView({ props, renderNode }) {
    const count = Math.min(12, Math.max(1, Math.round(props.columns ?? 3)));
    const gap = space(props.gap);
    return (
      <div
        className="grid min-w-0"
        style={{
          gap,
          gridTemplateColumns: `repeat(auto-fit, minmax(min(100%, max(${Math.max(120, props.minWidth ?? 220)}px, (100% - ${(count - 1) * gap}px) / ${count})), 1fr))`,
        }}
      >
        {renderNode(props.children)}
      </div>
    );
  },
});
export const Card = defineComponent({
  name: "Card",
  props: z.object({
    children: nodes,
    title: z.string().optional(),
    description: z.string().optional(),
    tone: z.enum(["default", "muted", "accent"]).optional(),
  }),
  description:
    "Card(children, title, description, tone). Nestable shadcn surface with optional header. tone default/muted/accent; use accent for at most one recommended or featured item, muted for supporting content. No padding argument.",
  component: ({ props, renderNode }) => (
    <Surface className={cn("min-w-0", props.tone === "muted" && "ii-card-muted", props.tone === "accent" && "ii-card-accent")}>
      {props.title && (
        <CardHeader>
          <CardTitle>{props.title}</CardTitle>
          {props.description && (
            <CardDescription>{props.description}</CardDescription>
          )}
        </CardHeader>
      )}
      <CardContent className="flex min-w-0 flex-col gap-4">
        {renderNode(props.children)}
      </CardContent>
    </Surface>
  ),
});
export const Icon = defineComponent({
  name: "Icon",
  props: z.object({
    name: z.string(),
    size: z.enum(["sm", "md", "lg"]).optional(),
  }),
  description: "Decorative lucide icon by kebab-case name.",
  component: ({ props }) => (
    <span className="inline-flex shrink-0 text-muted-foreground" aria-hidden>
      <Glyph
        name={props.name}
        size={{ sm: 16, md: 20, lg: 28 }[props.size ?? "md"]}
      />
    </span>
  ),
});
