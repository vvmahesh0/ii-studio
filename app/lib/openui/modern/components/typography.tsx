"use client";

import { defineComponent } from "@openuidev/react-lang";
import { z } from "zod";

const HeadingSchema = z.object({
  text: z.string(),
  level: z.enum(["h1", "h2", "h3", "h4"]).optional(),
  size: z.enum(["sm", "md", "lg", "xl"]).optional(),
});

const headingClasses: Record<string, string> = {
  sm: "text-base leading-snug font-semibold tracking-tight",
  md: "text-xl leading-snug font-semibold tracking-tight",
  lg: "text-2xl leading-tight font-semibold tracking-tight",
  xl: "text-3xl leading-tight font-semibold tracking-tight",
};

export const Heading = defineComponent({
  name: "Heading",
  props: HeadingSchema,
  description:
    'Heading(text, level, size). Semantic level h1-h4 is independent of visual size sm/md/lg/xl. Default h1 uses lg, h2 uses md, h3/h4 use sm. xl is reserved for short hero headings.',
  component: function TypographyView({ props }) {
    const level = props.level ?? "h2";
    const size = props.size ?? (level === "h1" ? "lg" : level === "h2" ? "md" : "sm");
    const cls = headingClasses[size];
    switch (level) {
      case "h1":
        return <h1 className={cls}>{props.text}</h1>;
      case "h3":
        return <h3 className={cls}>{props.text}</h3>;
      case "h4":
        return <h4 className={cls}>{props.text}</h4>;
      default:
        return <h2 className={cls}>{props.text}</h2>;
    }
  },
});

const BlockquoteSchema = z.object({
  text: z.string(),
  cite: z.string().optional(),
});

export const Blockquote = defineComponent({
  name: "Blockquote",
  props: BlockquoteSchema,
  description: "Styled blockquote. Optional cite for attribution.",
  component: ({ props }) => (
    <figure>
      <blockquote className="mt-6 border-l-2 pl-6 italic text-muted-foreground">
        {props.text}
      </blockquote>
      {props.cite && (
        <figcaption className="mt-1 pl-6 text-sm text-muted-foreground">
          — {props.cite}
        </figcaption>
      )}
    </figure>
  ),
});

const InlineCodeSchema = z.object({
  code: z.string(),
});

export const InlineCode = defineComponent({
  name: "InlineCode",
  props: InlineCodeSchema,
  description: "Inline code snippet rendered with monospace font.",
  component: ({ props }) => (
    <code className="relative rounded bg-muted px-[0.3rem] py-[0.2rem] font-mono text-sm font-semibold">
      {props.code}
    </code>
  ),
});
